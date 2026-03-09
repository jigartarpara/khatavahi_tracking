# Copyright (c) 2026, Khatavahi Tracking and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import getdate

def execute():
	"""
	Backfill missing User Checkin KBS entries (IN and OUT) from historical User Log KBS data.
	Only processes records prior to today.
	"""
	from frappe.utils import nowdate
	today = nowdate()

	# Get all unique (user, posting_date) from User Log KBS
	logs = frappe.db.get_all(
		"User Log KBS",
		filters={"posting_date": ["<", today]},
		fields=["user", "posting_date"],
		order_by="posting_date desc"
	)

	# Use a set to track unique combinations to process
	processed_combinations = set()

	for log in logs:
		user = log.get("user")
		date = log.get("posting_date")
		
		if not user or not date:
			continue
			
		combo = (user, date)
		if combo in processed_combinations:
			continue
		
		processed_combinations.add(combo)

		# 1. Backfill IN: if no IN exists, get the first log of the day
		in_exists = frappe.db.exists(
			"User Checkin KBS",
			{"user": user, "log_type": "IN", "date": date}
		)

		if not in_exists:
			first_log = frappe.db.get_all(
				"User Log KBS",
				filters={"user": user, "posting_date": date},
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
				except Exception:
					frappe.log_error(f"Backfill IN failed for {user} on {date}")

		# 2. Backfill OUT: if no OUT exists, get the last log of the day
		out_exists = frappe.db.exists(
			"User Checkin KBS",
			{"user": user, "log_type": "OUT", "date": date}
		)

		if not out_exists:
			last_log = frappe.db.get_all(
				"User Log KBS",
				filters={"user": user, "posting_date": date},
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
				except Exception:
					frappe.log_error(f"Backfill OUT failed for {user} on {date}")
