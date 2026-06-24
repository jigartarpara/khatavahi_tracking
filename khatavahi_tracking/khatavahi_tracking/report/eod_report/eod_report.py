# Copyright (c) 2026, Khatavahi Tracking and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def execute(filters=None):
	if not filters:
		filters = {}

	user = filters.get("user")
	date = filters.get("date")

	if not user or not date:
		return [], []

	visits = frappe.get_all(
		"Client Visit",
		filters={"user": user, "posting_date": date, "docstatus": ["<", 2], "status": ["=", "Visited"]},
		fields=["name", "party_name", "visit_for", "checking_time", "checkout_time", "note"],
		order_by="checking_time asc"
	)

	data_list = get_data(visits)
	message, custom_summary = get_summary_html(user, date, visits) or (None, None)
	columns = get_columns()

	if data_list and custom_summary:
		for k, v in custom_summary.items():
			data_list[0][f"_summary_{k}"] = v

	return columns, data_list, message, None

def get_columns():
	return [
		{"fieldname": "time", "label": _("Time"), "fieldtype": "Data", "width": 120},
		{"fieldname": "party_name", "label": _("Party Name"), "fieldtype": "Data", "width": 190},
		{"fieldname": "note", "label": _("Note"), "fieldtype": "Data", "width": 250},
		{"fieldname": "photos", "label": _("Photos"), "fieldtype": "HTML", "width": 500},
		{"fieldname": "time_spent", "label": _("Time Spent"), "fieldtype": "Data", "width": 100}
	]
	
def get_data(visits):
	if not visits:
		return []

	visit_names = [v.name for v in visits]
	photos = frappe.get_all(
		"Client Photo Table", 
		filters={"parent": ["in", visit_names]}, 
		fields=["parent", "images"]
	)
	
	photos_map = {}
	for p in photos:
		if p.images:
			photos_map.setdefault(p.parent, []).append(p.images)

	data = []
	for v in visits:
		photos_html = "".join([
			f"<img src='{img}' style='width: 100px !important; height: 100px !important; max-height: 100px !important; object-fit: cover; margin: 5px' />"
			for img in photos_map.get(v.name, [])
		])
		time_str, time_spent_str = "", ""
		if v.checking_time and v.checkout_time:
			time_str = f"{format_time_str(v.checking_time, short=True)} - {format_time_str(v.checkout_time, short=True)}"
			
			diff_sec = (v.checkout_time - v.checking_time).total_seconds()
			if diff_sec < 0: diff_sec += 24 * 3600
			time_spent_str = format_duration_custom(diff_sec)
			
		elif v.checking_time:
			time_str = f"{format_time_str(v.checking_time, short=True)} -"
			
		data.append({
			"time": time_str,
			"party_name": v.party_name,
			"note": v.note,
			"photos": photos_html,
			"time_spent": time_spent_str
		})
		
	return data

def get_summary_html(user, date, visits):
	checkin_log = frappe.db.get_value("User Checkin KBS", {"user": user, "date": date, "log_type": "IN"}, "time", order_by="time asc")
	checkout_log = frappe.db.get_value("User Checkin KBS", {"user": user, "date": date, "log_type": "OUT"}, "time", order_by="time desc")
	
	if not checkin_log and not checkout_log and not visits:
		return
	
	total_work_seconds = 0
	if checkin_log and checkout_log:
		total_work_seconds = (checkout_log - checkin_log).total_seconds()
		if total_work_seconds < 0: total_work_seconds += 24 * 3600
			
	total_work_hours_str = format_duration_custom(total_work_seconds) if total_work_seconds else "-"
	
	time_spent_visits_sec = 0
	for v in visits:
		if v.checking_time and v.checkout_time:
			diff = (v.checkout_time - v.checking_time).total_seconds()
			if diff < 0: diff += 24 * 3600
			time_spent_visits_sec += diff
			
	time_spent_visits_str = format_duration_custom(time_spent_visits_sec) if time_spent_visits_sec else "-"
	
	user_full_name = frappe.db.get_value("User", user, "full_name") or user
	
	html = f"""
	<style>
		.eod-summary-table {{ width: 100%; max-width: 600px; margin-bottom: 20px; font-size: 14px; }}
		.eod-summary-table td {{ padding: 4px 8px; vertical-align: top; }}
		.eod-summary-label {{ font-weight: bold; width: 45%; text-transform: uppercase; }}
		
		/* Fix datatable filter row height when using cellHeight: 120 */
		.datatable .dt-row-filter, 
		.datatable .dt-row-filter .dt-cell {{ height: 40px !important; }}
		.datatable .dt-row-filter .dt-filter.dt-input {{ height: 100% !important; }}
	</style>
	<table class="eod-summary-table">
		<tr><td class="eod-summary-label">NAME:</td><td>{user_full_name}</td></tr>
		<tr><td class="eod-summary-label">CHECK-IN TIME:</td><td>{format_time_str(checkin_log) if checkin_log else "-"}</td></tr>
		<tr><td class="eod-summary-label">CHECK-OUT TIME:</td><td>{format_time_str(checkout_log) if checkout_log else "-"}</td></tr>
		<tr><td class="eod-summary-label">TOTAL WORK HOURS:</td><td>{total_work_hours_str}</td></tr>
		<tr><td colspan="2" style="height: 15px;"></td></tr>
		<tr><td class="eod-summary-label">NO. OF VISITS:</td><td>{len(visits)}</td></tr>
		<tr><td class="eod-summary-label">TIME SPENT DURING VISITS:</td><td>{time_spent_visits_str}</td></tr>
	</table>
	"""
	
	summary_data = {
		"user_full_name": user_full_name,
		"checkin_time": format_time_str(checkin_log) if checkin_log else "-",
		"checkout_time": format_time_str(checkout_log) if checkout_log else "-",
		"total_work_hours": total_work_hours_str,
		"no_of_visits": len(visits),
		"time_spent_visits": time_spent_visits_str
	}
	
	return html, summary_data

def format_time_str(t, short=False):
	if t is None or t == "": return ""
	total_seconds = int(t.total_seconds())
	hours, remainder = divmod(total_seconds, 3600)
	minutes, seconds = divmod(remainder, 60)
	
	if short:
		return f"{hours:02d}:{minutes:02d}"
		
	period = "am"
	if hours >= 12:
		period = "pm"
		if hours > 12: hours -= 12
	if hours == 0:
		hours = 12
		
	return f"{hours:02d}:{minutes:02d} {period}"

def format_duration_custom(seconds):
	if not seconds: return "0h 0m 0s"
	seconds = int(seconds)
	hours, remainder = divmod(seconds, 3600)
	minutes, seconds = divmod(remainder, 60)
	return f"{hours}h {minutes}m {seconds}s"