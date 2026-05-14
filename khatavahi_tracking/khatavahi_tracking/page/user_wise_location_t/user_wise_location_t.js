frappe.pages["user-wise-location-t"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "User Wise Location Tracking",
		single_column: true,
	});

	page.set_title(__("User Wise Location Tracking"));

	let $content = $('<div class="log-content"></div>').appendTo(page.main);

	// Fix z-index overlap between Leaflet controls and Frappe dropdowns
	frappe.dom.set_style(`
		.leaflet-top, .leaflet-bottom {
			z-index: 5 !important;
		}
		.leaflet-pane {
			z-index: 1 !important;
		}
		.user-logs-container {
			position: relative;
			z-index: 1;
		}
	`);

	let user_field = page.add_field({
		fieldname: "user",
		label: __("User"),
		fieldtype: "MultiSelectList",
		options: "User",
		get_data: function (txt) {
			return frappe.db.get_link_options("User", txt);
		},
		onchange: function () {
			fetch_logs_if_valid();
		},
	});

	let from_date_field = page.add_field({
		fieldname: "from_date",
		label: __("From Date"),
		fieldtype: "Date",
		onchange: function () {
			fetch_logs_if_valid();
		},
	});

	let to_date_field = page.add_field({
		fieldname: "to_date",
		label: __("To Date"),
		fieldtype: "Date",
		onchange: function () {
			fetch_logs_if_valid();
		},
	});

	function fetch_logs_if_valid() {
		let users = user_field.get_value();
		if (users) {
			get_user_logs(users);
		} else {
			$content.empty();
		}
	}

	function get_user_logs(users) {
		let filters = {};

		if (users && users.length > 0) {
			// MultiSelectList returns an array of values natively
			let user_array = Array.isArray(users) ? users : users.split(",").map((u) => u.trim());
			filters["user"] = ["in", user_array];
		}

		let from_date = from_date_field.get_value();
		let to_date = to_date_field.get_value();

		if (from_date && to_date) {
			filters["posting_date"] = ["between", [from_date, to_date]];
		} else if (from_date) {
			filters["posting_date"] = [">=", from_date];
		} else if (to_date) {
			filters["posting_date"] = ["<=", to_date];
		}

		// Only fetch if at least one user is selected
		if (!filters.user) return;

		// Fetch logs and visits
		Promise.all([
			new Promise((resolve) => {
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "User Log KBS",
						filters: filters,
						fields: ["name", "user", "posting_date", "posting_time", "latitude", "longitude"],
						order_by: "posting_date desc, posting_time desc",
						limit_page_length: 1000,
					},
					callback: (r) => resolve(r.message || []),
				});
			}),
			new Promise((resolve) => {
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Client Visit",
						filters: filters,
						fields: [
							"name",
							"user",
							"posting_date",
							"checking_time",
							"checking_latitude",
							"checking_longitude",
							"party_name",
							"visit_for",
						],
						order_by: "posting_date desc, checking_time desc",
						limit_page_length: 1000,
					},
					callback: (r) => resolve(r.message || []),
				});
			}),
			new Promise((resolve) => {
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Client Location",
						fields: ["party_name", "latitude", "longitude"],
						limit_page_length: 1000,
					},
					callback: (r) => resolve(r.message || []),
				});
			}),
		]).then(([logs, visits, locations]) => {
			render_user_logs(logs, visits, locations);
		});
	}

	function render_user_logs(logs, visits = [], locations = []) {
		$content.empty();

		if (logs.length === 0 && visits.length === 0) {
			$content.html(
				`<div class="text-muted text-center" style="padding: 20px;">${__("No logs or visits found for the selected user(s) and date range.")}</div>`,
			);
			return;
		}

		let html = `
			<div class="row">
				<div class="col-md-12">
					<div style="margin-bottom: 15px; text-align: right; display: flex; justify-content: flex-end; gap: 10px;">
						<button class="btn btn-primary btn-sm" id="start-animation-btn">
							<i class="fa fa-play" style="margin-right: 5px;"></i> ${__("Start Moving Direction")}
						</button>
						<button class="btn btn-danger btn-sm" id="stop-animation-btn" disabled>
							<i class="fa fa-stop" style="margin-right: 5px;"></i> ${__("Stop Route")}
						</button>
					</div>
					<div id="user-location-map" style="min-height: 500px; border: 1px solid #d1d8dd; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); position: relative; z-index: 0;"></div>
				</div>
			</div>
			
			<div class="row" style="margin-top: 25px;">
				<div class="col-md-12">
					<div class="collapse-header" style="cursor: pointer; padding: 12px 15px; background: #f8f9fa; border: 1px solid #d1d8dd; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
						<div style="display: flex; align-items: center; gap: 10px;">
							<i class="fa fa-list-ul text-muted"></i>
							<h6 style="margin: 0; font-weight: 600; color: #36414c;">${__("Log Entries")} (${logs.length})</h6>
						</div>
						<i class="fa fa-chevron-down collapse-icon text-muted"></i>
					</div>
					<div class="collapse-content" style="display: none; border: 1px solid #d1d8dd; border-top: none; padding: 0; border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; overflow: hidden;">
						<div style="max-height: 500px; overflow-y: auto;">
							<table class="table table-bordered table-hover" style="margin-bottom: 0; border: none;">
								<thead style="position: sticky; top: 0; background: #ffffff; z-index: 10;">
									<tr>
										<th style="border-top: none;">${__("User")}</th>
										<th style="border-top: none;">${__("Date")}</th>
										<th style="border-top: none;">${__("Time")}</th>
										<th style="border-top: none;">${__("Latitude")}</th>
										<th style="border-top: none;">${__("Longitude")}</th>
									</tr>
								</thead>
								<tbody>`;

		logs.forEach((log) => {
			html += `<tr>
				<td>${log.user}</td>
				<td>${frappe.datetime.str_to_user(log.posting_date)}</td>
				<td>${log.posting_time}</td>
				<td><span class="text-muted">${log.latitude || ""}</span></td>
				<td><span class="text-muted">${log.longitude || ""}</span></td>
			</tr>`;
		});

		html += `</tbody></table></div></div></div></div>`;

		let $wrapper = $(`<div class="user-logs-container" style="padding: 15px;">${html}</div>`);

		// Add collapse functionality
		$wrapper.find('.collapse-header').on('click', function () {
			let $content = $(this).next('.collapse-content');
			let $icon = $(this).find('.collapse-icon');
			if ($content.is(':visible')) {
				$content.slideUp(200);
				$(this).css('border-radius', '4px');
				$icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
			} else {
				$content.slideDown(200);
				$(this).css('border-radius', '4px 4px 0 0');
				$icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
			}
		});

		// Hover effect for header
		$wrapper.find('.collapse-header').hover(
			function () { $(this).css('background', '#f1f2f4'); },
			function () { $(this).css('background', '#f8f9fa'); }
		);

		$content.append($wrapper);

		if (logs.length > 0 || visits.length > 0) {
			render_map(logs, visits, locations);
		}
	}

	function render_map(logs = [], visits = [], locations = []) {
		if ((!logs || logs.length === 0) && (!visits || visits.length === 0)) return;

		// Load Leaflet dynamically via CDN since map.bundle.js might not exist in all Frappe versions
		let loadLeaflet = new Promise((resolve, reject) => {
			if (window.L) {
				resolve();
			} else {
				$("<link/>", {
					rel: "stylesheet",
					type: "text/css",
					href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
				}).appendTo("head");

				$.getScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js")
					.done(resolve)
					.fail(reject);
			}
		});

		loadLeaflet
			.then(() => {
				const mapContainer = document.getElementById("user-location-map");
				if (!mapContainer) return;

				// Destroy existing map if re-render
				if (mapContainer._leaflet_map) {
					mapContainer._leaflet_map.remove();
				}

				// Initialize map
				const map = L.map(mapContainer, {
					zoomControl: true,
					attributionControl: true,
				});

				mapContainer._leaflet_map = map;

				// Google tiles
				L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
					maxZoom: 20,
					subdomains: ["mt0", "mt1", "mt2", "mt3"],
					attribution: "© Google Maps",
				}).addTo(map);

				// Marker icon helper
				const markerIcon = (color) =>
					L.icon({
						iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
						shadowUrl:
							"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
						iconSize: [25, 41],
						iconAnchor: [12, 41],
						popupAnchor: [1, -34],
						shadowSize: [41, 41],
					});

				let all_points = [];



				// Render client locations
				if (locations && locations.length > 0) {
					let location_map = {};
					locations.forEach((loc) => {
						location_map[loc.party_name] = loc;
					});

					let rendered_client_locations = new Set();

					visits.forEach((visit) => {
						let client_loc = location_map[visit.party_name];
						if (client_loc && client_loc.latitude && client_loc.longitude) {
							let client_pos = [parseFloat(client_loc.latitude), parseFloat(client_loc.longitude)];

							// Only add the office marker once per customer
							if (!rendered_client_locations.has(visit.party_name)) {
								let popupText = `
									<div style="padding: 5px; min-width: 150px;">
										<b style="color: #2e67d2; font-size: 14px;">${__("Client Office Location")}</b><br>
										<hr style="margin: 5px 0;">
										<b>${__("Customer")}:</b> ${visit.party_name}
									</div>
								`;

								L.marker(client_pos, {
									icon: markerIcon("blue"),
									zIndexOffset: 500,
								})
									.addTo(map)
									.bindPopup(popupText);

								all_points.push(client_pos);
								rendered_client_locations.add(visit.party_name);
							}

							// Draw connection line for every individual visit
							if (visit.checking_latitude && visit.checking_longitude) {
								let checkin_pos = [parseFloat(visit.checking_latitude), parseFloat(visit.checking_longitude)];
								L.polyline([checkin_pos, client_pos], {
									color: "#2e67d2",
									weight: 2,
									dashArray: "5, 10",
									opacity: 0.5,
								}).addTo(map);
							}
						}
					});
				}

				// Group logs by user and date
				let grouped_logs = {};

				// Reverse logs to draw chronological paths
				let reversed_logs = [...logs].reverse();

				reversed_logs.forEach((log) => {
					if (!log.latitude || !log.longitude) return;

					// Key by both user and date so paths don't connect across different users
					let group_key = log.user + "|" + log.posting_date;
					if (!grouped_logs[group_key]) {
						grouped_logs[group_key] = [];
					}
					grouped_logs[group_key].push(log);
				});

				// Distinct colors for different unique paths
				const colors = [
					"#4285F4",
					"#EA4335",
					"#FBBC05",
					"#34A853",
					"#8E24AA",
					"#F4511E",
					"#3949AB",
					"#00ACC1",
				];
				let colorIndex = 0;

				Object.keys(grouped_logs).forEach((group_key) => {
					let path_logs = grouped_logs[group_key];
					if (path_logs.length === 0) return;

					let points = path_logs.map((log) => [
						parseFloat(log.latitude),
						parseFloat(log.longitude),
					]);
					all_points.push(...points);

					let lineColor = colors[colorIndex % colors.length];
					colorIndex++;

					let user_id = path_logs[0].user;
					let posting_date = path_logs[0].posting_date;
					let formatted_date = frappe.datetime.str_to_user(posting_date);

					// Ensure there are at least 2 points to draw a polyline
					if (points.length > 1) {
						let polyline = L.polyline(points, {
							color: lineColor,
							weight: 5,
							opacity: 0.9,
							smoothFactor: 1,
						}).addTo(map);

						// Tooltip showing User and Date
						polyline.bindTooltip(`<b>${user_id}</b><br>${formatted_date}`, {
							sticky: true,
							className: "map-path-tooltip",
						});
					}

					// Start marker for the path
					let startLog = path_logs[0];
					let startPopUpText = `<b>${__("Start Location")}</b><br><b>${__("User")}:</b> ${user_id}<br><b>${__("Date")}:</b> ${frappe.datetime.str_to_user(startLog.posting_date)}<br><b>${__("Time")}:</b> ${startLog.posting_time}`;
					L.marker(points[0], { icon: markerIcon("green") })
						.addTo(map)
						.bindPopup(startPopUpText);

					// Intermediate points displayed as small circles with tooltips
					for (let i = 1; i < path_logs.length - 1; i++) {
						let midLog = path_logs[i];
						let midTooltipText = `<b>${__("User")}:</b> ${user_id}<br><b>${__("Time")}:</b> ${midLog.posting_time}`;
						L.circleMarker(
							[parseFloat(midLog.latitude), parseFloat(midLog.longitude)],
							{
								radius: 5,
								color: lineColor,
								fillColor: "#ffffff",
								fillOpacity: 1,
								weight: 2,
							},
						)
							.addTo(map)
							.bindTooltip(midTooltipText);
					}

					// End marker for the path (if different from start)
					if (points.length > 1) {
						let endLog = path_logs[path_logs.length - 1];
						let endPopUpText = `<b>${__("End Location")}</b><br><b>${__("User")}:</b> ${user_id}<br><b>${__("Date")}:</b> ${frappe.datetime.str_to_user(endLog.posting_date)}<br><b>${__("Time")}:</b> ${endLog.posting_time}`;
						L.marker(points[points.length - 1], { icon: markerIcon("red") })
							.addTo(map)
							.bindPopup(endPopUpText);
					}
				});

				// Fit bounds
				if (all_points.length > 0) {
					map.fitBounds(L.latLngBounds(all_points), { padding: [40, 40] });
				}

				// Animation Logic
				let animatedMarkers = [];
				let animationRunning = false;
				let animationFrames = [];

				function stopAnimations() {
					animationRunning = false;
					animationFrames.forEach(id => cancelAnimationFrame(id));
					animationFrames = [];
					animatedMarkers.forEach(m => {
						if (map.hasLayer(m)) map.removeLayer(m);
					});
					animatedMarkers = [];
				}

				$('#start-animation-btn').off('click').on('click', function () {
					$(this).prop('disabled', true);
					$('#stop-animation-btn').prop('disabled', false);

					stopAnimations();
					animationRunning = true;

					Object.keys(grouped_logs).forEach((group_key) => {
						let path_logs = grouped_logs[group_key];
						if (path_logs.length < 2) return;
						let points = path_logs.map(log => [parseFloat(log.latitude), parseFloat(log.longitude)]);

						let movingMarker = L.marker(points[0], {
							icon: L.icon({
								iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
								shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
								iconSize: [25, 41],
								iconAnchor: [12, 41],
								popupAnchor: [1, -34],
								shadowSize: [41, 41]
							}),
							zIndexOffset: 1000
						}).addTo(map);

						let user_id = path_logs[0].user;
						movingMarker.bindTooltip(`<b>${user_id}</b>`, { permanent: true, direction: 'right' });

						animatedMarkers.push(movingMarker);

						let i = 0;
						let durationPerPoint = 1300; // time it takes to move between two points (ms)

						function move() {
							if (i >= points.length - 1 || !animationRunning) return;
							let start = points[i];
							let end = points[i + 1];
							let startTime = performance.now();

							function frame(time) {
								if (!animationRunning) return;
								let elapsed = time - startTime;
								let progress = Math.min(elapsed / durationPerPoint, 1);

								// Calculate current position
								let lat = start[0] + (end[0] - start[0]) * progress;
								let lng = start[1] + (end[1] - start[1]) * progress;
								movingMarker.setLatLng([lat, lng]);

								if (progress < 1) {
									let reqId = requestAnimationFrame(frame);
									animationFrames.push(reqId);
								} else {
									i++;
									move();
								}
							}
							let reqId = requestAnimationFrame(frame);
							animationFrames.push(reqId);
						}
						move();
					});
				});

				$('#stop-animation-btn').off('click').on('click', function () {
					$(this).prop('disabled', true);
					$('#start-animation-btn').prop('disabled', false);
					stopAnimations();
				});

			})
			.catch((err) => {
				console.error("Failed to load Leaflet:", err);
				frappe.msgprint(__("Error loading map library."));
			});
	}
};
