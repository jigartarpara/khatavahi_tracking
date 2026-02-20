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

			if (log.latitude && log.longitude) {
				map_points.push([parseFloat(log.latitude), parseFloat(log.longitude)]);
			}
		});

		// Sort map points so the line is drawn from Oldest to Newest
		map_points.reverse();
		// Also reverse logs to match
		logs.reverse();

		html += `</tbody></table></div>
			<div class="col-md-6">
				<div id="user-location-map" style="min-height: 500px; border: 1px solid #d1d8dd; border-radius: 4px;"></div>
			</div>
		</div>`;
		
		let $wrapper = $(`<div class="user-logs-container" style="padding: 15px;">${html}</div>`);
		$content.append($wrapper);

		if (map_points.length > 0) {
			render_map(map_points, logs);
		}
	}

	function render_map(points = [], logs = []) {
		if (!points || points.length === 0) return;

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

			// Route polyline
			let polyline = null;
			if (points.length > 1) {
				polyline = L.polyline(points, {
					color: '#4285F4',
					weight: 5,
					opacity: 0.9,
					smoothFactor: 1
				}).addTo(map);
			}

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

			// Start marker - Green
			let startPopUpText = `<b>${__('Start Location')}</b>`;
			if(logs.length > 0 && logs[0].posting_date) {
				startPopUpText += `<br><b>${__('Date')}:</b> ${frappe.datetime.str_to_user(logs[0].posting_date)}<br><b>${__('Time')}:</b> ${logs[0].posting_time}`;
			}

			L.marker(points[0], { icon: markerIcon('green') })
				.addTo(map)
				.bindPopup(startPopUpText);

			// End marker (if different) - Red
			if (points.length > 1) {
				let endPopUpText = `<b>${__('End Location')}</b>`;
				let endLog = logs[logs.length-1];
				if(endLog && endLog.posting_date) {
					endPopUpText += `<br><b>${__('Date')}:</b> ${frappe.datetime.str_to_user(endLog.posting_date)}<br><b>${__('Time')}:</b> ${endLog.posting_time}`;
				}

				L.marker(points[points.length - 1], { icon: markerIcon('red') })
					.addTo(map)
					.bindPopup(endPopUpText);
			}

			// Fit bounds
			if (polyline) {
				map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
			} else {
				map.setView(points[0], 15);
			}
		});
	}
}