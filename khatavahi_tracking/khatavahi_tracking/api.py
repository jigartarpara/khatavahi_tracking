import frappe
from khatavahi_tracking.version import __version__
from frappe.utils import today, now

@frappe.whitelist(allow_guest=True)
def get_version():
    return __version__

@frappe.whitelist(allow_guest=True)
def is_valid_session(user_sid, user=None, latitude=None, longitude=None):
	if not user_sid or user_sid == "Guest":
		return False

	table = frappe.qb.DocType("Sessions")
	user_details = frappe.qb.from_(table).where(table.sid == user_sid).where(table.status == "Active").select(table.user).run(as_dict=True)

	if user_details:
		return user_details[0].user
	
	if user:
		last_checkin = frappe.get_all("User Checkin KBS", 
			filters={"user": user, "date": today()},
			fields=["name", "log_type"],
			order_by="creation desc",
			limit=1
		)

		if last_checkin and last_checkin[0].log_type == "IN":
			try:
				doc = frappe.get_doc({
					"doctype": "User Checkin KBS",
					"user": user,
					"log_type": "OUT",
					"date": today(),
					"time": now().split(' ')[1],
					"latitude": latitude,
					"longitude": longitude,
					"session_destroy": 1
				})
				doc.insert(ignore_permissions=True)
				frappe.db.commit()
			except Exception as e:
				frappe.log_error(title="Auto Logout Checkout Error", message=frappe.get_traceback())
	
	return False
