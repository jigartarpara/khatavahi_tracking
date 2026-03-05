import frappe
from frappe import _
import math
from frappe.utils import getdate, now_datetime, get_time

def execute(filters=None):
	columns = get_columns()
	data = get_data(filters)
	return columns, data

def get_columns():
	return [
		{"label": _("Date"), "fieldname": "date", "fieldtype": "Date", "width": 120},
		{"label": _("User"), "fieldname": "user", "fieldtype": "Link", "options": "User", "width": 150},
		{"label": _("Travel KM"), "fieldname": "travel_km", "fieldtype": "Float", "width": 120}
	]

def get_data(filters):
	if not filters: filters = {}
	
	from_date = getdate(normalize(filters.get("from_date")) or frappe.utils.today())
	to_date = getdate(normalize(filters.get("to_date")) or frappe.utils.today())
	user = filters.get("user")

	checkin_filters = {"date": ["between", [from_date, to_date]]}
	if user:
		if isinstance(user, list):
			checkin_filters["user"] = ["in", user]
		else:
			checkin_filters["user"] = user

	checkins = frappe.get_all("User Checkin KBS", 
		filters=checkin_filters, 
		fields=["user", "date", "time", "log_type", "latitude", "longitude"],
		order_by="user, date, time asc"
	)

	if not checkins: return []

	log_filters = {"posting_date": ["between", [from_date, to_date]]}
	if user:
		if isinstance(user, list):
			log_filters["user"] = ["in", user]
		else:
			log_filters["user"] = user
	
	all_user_logs = frappe.get_all("User Log KBS",
		filters=log_filters,
		fields=["user", "posting_date", "posting_time", "latitude", "longitude"],
		order_by="user, posting_date, posting_time asc"
	)

	user_logs_map = {}
	for ul in all_user_logs:
		user_logs_map.setdefault((ul.user, ul.posting_date), []).append(ul)

	data = []
	grouped_checkins = {}
	for log in checkins:
		grouped_checkins.setdefault((log.user, log.date), []).append(log)

	current_today = getdate()

	for (user_id, log_date), logs in grouped_checkins.items():
		total_distance_meters = 0
		user_logs_for_day = user_logs_map.get((user_id, log_date), [])
		
		i = 0
		while i < len(logs):
			if logs[i].log_type == "IN":
				in_log = logs[i]
				out_log = None
				
				for j in range(i + 1, len(logs)):
					if logs[j].log_type == "OUT":
						out_log = logs[j]
						i = j
						break
				
				out_time = out_log.time if out_log else (now_datetime().time() if log_date == current_today else get_time("23:59:59"))
				start_t, end_t = get_time(in_log.time), get_time(out_time)

				session_logs = [ul for ul in user_logs_for_day if start_t <= get_time(ul.posting_time) <= end_t]

				points = []
				if in_log.latitude and in_log.longitude: points.append((in_log.latitude, in_log.longitude))
				for ul in session_logs:
					if ul.latitude and ul.longitude: points.append((ul.latitude, ul.longitude))
				if out_log and out_log.latitude and out_log.longitude: points.append((out_log.latitude, out_log.longitude))

				for k in range(len(points) - 1):
					total_distance_meters += calculate_distance(points[k][0], points[k][1], points[k+1][0], points[k+1][1])
			i += 1
		
		if total_distance_meters > 0:
			data.append({
				"date": log_date,
				"user": user_id,
				"travel_km": round(total_distance_meters / 1000.0, 2)
			})

	return data

def normalize(v):
	while isinstance(v, list):
		if not v: return None
		v = v[0]
	return v

def calculate_distance(lat1, lon1, lat2, lon2):
	"""
	Calculate the great circle distance between two points 
	on the earth (specified in decimal degrees) in meters
	"""
	if not all([lat1, lon1, lat2, lon2]):
		return 0
	
	try:
		lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
		
		# convert decimal degrees to radians 
		lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

		# haversine formula 
		dlon = lon2 - lon1 
		dlat = lat2 - lat1 
		a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
		c = 2 * math.asin(math.sqrt(a)) 
		r = 6371000 # Radius of earth in meters
		return c * r
	except (ValueError, TypeError):
		return 0
