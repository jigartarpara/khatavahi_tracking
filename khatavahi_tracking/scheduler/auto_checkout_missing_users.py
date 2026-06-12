import frappe
from frappe.utils import add_days, nowdate, getdate, today

def execute():
	previous_date = add_days(getdate(nowdate()), -1)

	all_users_with_logs = frappe.db.get_all(
		"User Log KBS",
		filters={"posting_date": previous_date},
		fields=["user"],
		distinct=True
	)

	if not all_users_with_logs:
		frappe.logger().info(
			f"[Auto Checkout] No log entries found for {previous_date}. Nothing to process."
		)
		return

	for entry in all_users_with_logs:
		user = entry.get("user")

		out_exists = frappe.db.get_value(
			"User Checkin KBS",
			{"user": user, "date": previous_date},
			"log_type",
			order_by="creation desc"
		)
		
		if out_exists != 'OUT':
			last_log = frappe.db.get_all(
				"User Log KBS",
				filters={"user": user, "posting_date": previous_date},
				fields=["user", "posting_date", "posting_time", "latitude", "longitude"],
				order_by="posting_time desc",
				limit=1
			)

			if last_log:
				last = last_log[0]
				try:
					doc = frappe.get_doc({
						"doctype": "User Checkin KBS",
						"user": last.get("user"),
						"log_type": "OUT",
						"date": last.get("posting_date"),
						"time": last.get("posting_time"),
						"auto_checkout": 1,
						"latitude": last.get("latitude") or "",
						"longitude": last.get("longitude") or "",
					})
					doc.insert(ignore_permissions=True)
					frappe.db.commit()
					frappe.logger().info(
						f"[Auto Checkout] Created OUT entry for user {last.get('user')} on {last.get('posting_date')} at {last.get('posting_time')}."
					)
				except Exception as e:
					frappe.log_error(
						title=f"Auto Checkout Failed for {user}",
						message=frappe.get_traceback(),
					)
					frappe.logger().error(
						f"[Auto Checkout] Failed to create OUT entry for user {user} on {previous_date}. Error: {e}"
					)
