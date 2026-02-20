frappe.pages['user-wise-location-t'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'User Wise Location Tracking',
		single_column: true
	});

	page.set_title(__('User Wise Location Tracking'));
	
	frappe.require('map.bundle.js');

	let $content = $('<div class="log-content"></div>').appendTo(page.main);

	let user_field = page.add_field({
		fieldname: 'user',
		label: __('User'),
		fieldtype: 'Link',
		options: 'User',
		change: function() {
			let user = user_field.get_value();
			if (user) {
				get_user_logs(user);
			} else {
				$content.empty();
			}
		}
	});

	function get_user_logs(user) {
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'User Log KBS',
				filters: {
					'user': user
				},
				fields: ['name', 'user', 'posting_date', 'posting_time', 'latitude', 'longitude'],
				order_by: 'posting_date desc, posting_time desc',
				limit_page_length: 500
			},
			callback: function(r) {
				render_user_logs(r.message || []);
			}
		});
	}

	function render_user_logs(logs) {
		$content.empty();

		if (logs.length === 0) {
			$content.html(`<div class="text-muted text-center" style="padding: 20px;">${__('No logs found for this user.')}</div>`);
			return;
		}

		let html = `<div class="row">
			<div class="col-md-6">
				<table class="table table-bordered">
					<thead>
						<tr>
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

		frappe.require('map.bundle.js').then(() => {

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

			// Group logs by date
			let grouped_logs = {};
			
			// Reverse logs to draw chronological paths
			let reversed_logs = [...logs].reverse();
			
			reversed_logs.forEach(log => {
				if (!log.latitude || !log.longitude) return;
				let date_key = log.posting_date;
				if (!grouped_logs[date_key]) {
					grouped_logs[date_key] = [];
				}
				grouped_logs[date_key].push(log);
			});

			// Distinct colors for different dates
			const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#8E24AA', '#F4511E', '#3949AB', '#00ACC1'];
			let colorIndex = 0;
			
			let all_points = [];

			Object.keys(grouped_logs).forEach(date_key => {
				let day_logs = grouped_logs[date_key];
				if(day_logs.length === 0) return;
				
				let points = day_logs.map(log => [parseFloat(log.latitude), parseFloat(log.longitude)]);
				all_points.push(...points);

				let lineColor = colors[colorIndex % colors.length];
				colorIndex++;

				// Route polyline for the day
				if (points.length > 1) {
					let polyline = L.polyline(points, {
						color: lineColor,
						weight: 5,
						opacity: 0.9,
						smoothFactor: 1
					}).addTo(map);

					// Date indication on the line
					let formatted_date = frappe.datetime.str_to_user(date_key);
					polyline.bindTooltip(`<b>${formatted_date}</b>`, {
						sticky: true,
						className: 'map-date-tooltip'
					});
				}

				// Start marker for the day
				let startLog = day_logs[0];
				let startPopUpText = `<b>${__('Start Location')}</b><br><b>${__('Date')}:</b> ${frappe.datetime.str_to_user(startLog.posting_date)}<br><b>${__('Time')}:</b> ${startLog.posting_time}`;
				L.marker(points[0], { icon: markerIcon('green') })
					.addTo(map)
					.bindPopup(startPopUpText);

				// End marker for the day (if different from start)
				if (points.length > 1) {
					let endLog = day_logs[day_logs.length - 1];
					let endPopUpText = `<b>${__('End Location')}</b><br><b>${__('Date')}:</b> ${frappe.datetime.str_to_user(endLog.posting_date)}<br><b>${__('Time')}:</b> ${endLog.posting_time}`;
					L.marker(points[points.length - 1], { icon: markerIcon('red') })
						.addTo(map)
						.bindPopup(endPopUpText);
				}
			});

			// Fit bounds
			if (all_points.length > 0) {
				map.fitBounds(L.latLngBounds(all_points), { padding: [40, 40] });
			}
		});
	}
}