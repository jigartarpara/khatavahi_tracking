# Copyright (c) 2026, Khatavahi Tracking and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_days, nowdate, getdate


class UserCheckinKBS(Document):
	pass


def auto_checkout_missing_users():
	previous_date = add_days(getdate(nowdate()), -1)

	# Get all distinct users who have ANY log entry for the previous day
	all_users_with_logs = frappe.db.get_all(
		"User Log KBS",
		filters={"posting_date": previous_date},
		fields=["user"],
		distinct=True
	)

	if not all_users_with_logs:
		frappe.logger().info(
			f"[Auto Checkin/Checkout] No log entries found for {previous_date}. Nothing to process."
		)
		return

	for entry in all_users_with_logs:
		user = entry.get("user")

		# ── 1. Auto IN: if no IN entry exists, use the first log of the day ──
		in_exists = frappe.db.exists(
			"User Checkin KBS",
			{"user": user, "log_type": "IN", "date": previous_date},
		)

		if not in_exists:
			first_log = frappe.db.get_all(
				"User Log KBS",
				filters={"user": user, "posting_date": previous_date},
				fields=["user", "posting_date", "posting_time", "latitude", "longitude"],
				order_by="posting_time asc",
				limit=1
			)

			if first_log:
				first = first_log[0]
				try:
					doc = frappe.get_doc({
						"doctype": "User Checkin KBS",
						"user": first.get("user"),
						"log_type": "IN",
						"date": first.get("posting_date"),
						"time": first.get("posting_time"),
						"auto_checkin": 1,
						"latitude": first.get("latitude") or "",
						"longitude": first.get("longitude") or "",
					})
					doc.insert(ignore_permissions=True)
					frappe.db.commit()
					frappe.logger().info(
						f"[Auto Checkin] Created IN entry for user {first.get('user')} on {first.get('posting_date')} at {first.get('posting_time')}."
					)
				except Exception as e:
					frappe.log_error(
						title=f"Auto Checkin Failed for {user}",
						message=frappe.get_traceback(),
					)
					frappe.logger().error(
						f"[Auto Checkin] Failed to create IN entry for user {user} on {previous_date}. Error: {e}"
					)

		# ── 2. Auto OUT: if no OUT entry exists, use the last log of the day ──
		out_exists = frappe.db.exists(
			"User Checkin KBS",
			{"user": user, "log_type": "OUT", "date": previous_date},
		)

		if not out_exists:
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
