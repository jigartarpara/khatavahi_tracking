frappe.pages['user-wise-location-t'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'User Wise Location Tracking',
		single_column: true
	});

	page.set_title(__('User Wise Location Tracking'));

	let $content = $('<div class="log-content"></div>').appendTo(page.main);

	let user_field = page.add_field({
		fieldname: 'user',
		label: __('User'),
		fieldtype: 'MultiSelectList',
		options: 'User',
		get_data: async function (txt) {
			return frappe.db.get_link_options("User")
		},
		onchange: function() {
			fetch_logs_if_valid();
		}
	});

	let from_date_field = page.add_field({
		fieldname: 'from_date',
		label: __('From Date'),
		fieldtype: 'Date',
		onchange: function() {
			fetch_logs_if_valid();
		}
	});

	let to_date_field = page.add_field({
		fieldname: 'to_date',
		label: __('To Date'),
		fieldtype: 'Date',
		onchange: function() {
			fetch_logs_if_valid();
		}
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
			let user_array = Array.isArray(users) ? users : users.split(',').map(u => u.trim());
			filters['user'] = ['in', user_array];
		}
		
		let from_date = from_date_field.get_value();
		let to_date = to_date_field.get_value();

		if (from_date && to_date) {
			filters['posting_date'] = ['between', [from_date, to_date]];
		} else if (from_date) {
			filters['posting_date'] = ['>=', from_date];
		} else if (to_date) {
			filters['posting_date'] = ['<=', to_date];
		}

		// Only fetch if at least one user is selected
		if(!filters.user) return;

		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'User Log KBS',
				filters: filters,
				fields: ['name', 'user', 'posting_date', 'posting_time', 'latitude', 'longitude'],
				order_by: 'posting_date desc, posting_time desc',
				limit_page_length: 1000
			},
			callback: function(r) {
				render_user_logs(r.message || []);
			}
		});
	}

	function render_user_logs(logs) {
		$content.empty();

		if (logs.length === 0) {
			$content.html(`<div class="text-muted text-center" style="padding: 20px;">${__('No logs found for the selected user(s) and date range.')}</div>`);
			return;
		}

		let html = `<div class="row">
			<div class="col-md-6" style="max-height: 500px; overflow-y: auto;">
				<table class="table table-bordered">
					<thead>
						<tr>
							<th>${__('User')}</th>
							<th>${__('Date')}</th>
							<th>${__('Time')}</th>
							<th>${__('Latitude')}</th>
							<th>${__('Longitude')}</th>
						</tr>
					</thead>
					<tbody>`;

		let map_points = [];

		logs.forEach(log => {
			html += `<tr>
				<td>${log.user}</td>
				<td>${frappe.datetime.str_to_user(log.posting_date)}</td>
				<td>${log.posting_time}</td>
				<td>${log.latitude || ''}</td>
				<td>${log.longitude || ''}</td>
			</tr>`;
		});

		html += `</tbody></table></div>
			<div class="col-md-6">
				<div id="user-location-map" style="min-height: 500px; border: 1px solid #d1d8dd; border-radius: 4px;"></div>
			</div>
		</div>`;
		
		let $wrapper = $(`<div class="user-logs-container" style="padding: 15px;">${html}</div>`);
		$content.append($wrapper);

		if (logs.length > 0) {
			render_map(logs);
		}
	}

	function render_map(logs = []) {
		if (!logs || logs.length === 0) return;

		// Load Leaflet dynamically via CDN since map.bundle.js might not exist in all Frappe versions
		let loadLeaflet = new Promise((resolve, reject) => {
			if (window.L) {
				resolve();
			} else {
				$('<link/>', {
					rel: 'stylesheet',
					type: 'text/css',
					href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
				}).appendTo('head');
				
				$.getScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
					.done(resolve)
					.fail(reject);
			}
		});

		loadLeaflet.then(() => {
			const mapContainer = document.getElementById('user-location-map');
			if (!mapContainer) return;

			// Destroy existing map if re-render
			if (mapContainer._leaflet_map) {
				mapContainer._leaflet_map.remove();
			}

			// Initialize map
			const map = L.map(mapContainer, {
				zoomControl: true,
				attributionControl: true
			});

			mapContainer._leaflet_map = map;

			// Google tiles
			L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
				maxZoom: 20,
				subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
				attribution: '© Google Maps'
			}).addTo(map);

			// Marker icon helper
			const markerIcon = (color) =>
				L.icon({
					iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
					shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
					iconSize: [25, 41],
					iconAnchor: [12, 41],
					popupAnchor: [1, -34],
					shadowSize: [41, 41]
				});

			// Group logs by user and date
			let grouped_logs = {};
			
			// Reverse logs to draw chronological paths
			let reversed_logs = [...logs].reverse();
			
			reversed_logs.forEach(log => {
				if (!log.latitude || !log.longitude) return;
				
				// Key by both user and date so paths don't connect across different users
				let group_key = log.user + '|' + log.posting_date;
				if (!grouped_logs[group_key]) {
					grouped_logs[group_key] = [];
				}
				grouped_logs[group_key].push(log);
			});

			// Distinct colors for different unique paths
			const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#8E24AA', '#F4511E', '#3949AB', '#00ACC1'];
			let colorIndex = 0;
			
			let all_points = [];

			Object.keys(grouped_logs).forEach(group_key => {
				let path_logs = grouped_logs[group_key];
				if(path_logs.length === 0) return;
				
				let points = path_logs.map(log => [parseFloat(log.latitude), parseFloat(log.longitude)]);
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
						smoothFactor: 1
					}).addTo(map);

					// Tooltip showing User and Date
					polyline.bindTooltip(`<b>${user_id}</b><br>${formatted_date}`, {
						sticky: true,
						className: 'map-path-tooltip'
					});
				}

				// Start marker for the path
				let startLog = path_logs[0];
				let startPopUpText = `<b>${__('Start Location')}</b><br><b>${__('User')}:</b> ${user_id}<br><b>${__('Date')}:</b> ${frappe.datetime.str_to_user(startLog.posting_date)}<br><b>${__('Time')}:</b> ${startLog.posting_time}`;
				L.marker(points[0], { icon: markerIcon('green') })
					.addTo(map)
					.bindPopup(startPopUpText);

				// End marker for the path (if different from start)
				if (points.length > 1) {
					let endLog = path_logs[path_logs.length - 1];
					let endPopUpText = `<b>${__('End Location')}</b><br><b>${__('User')}:</b> ${user_id}<br><b>${__('Date')}:</b> ${frappe.datetime.str_to_user(endLog.posting_date)}<br><b>${__('Time')}:</b> ${endLog.posting_time}`;
					L.marker(points[points.length - 1], { icon: markerIcon('red') })
						.addTo(map)
						.bindPopup(endPopUpText);
				}
			});

			// Fit bounds
			if (all_points.length > 0) {
				map.fitBounds(L.latLngBounds(all_points), { padding: [40, 40] });
			}
		}).catch(err => {
			console.error("Failed to load Leaflet:", err);
			frappe.msgprint(__('Error loading map library.'));
		});
	}
}