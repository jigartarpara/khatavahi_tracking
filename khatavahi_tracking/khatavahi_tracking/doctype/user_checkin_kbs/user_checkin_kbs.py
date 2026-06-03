import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

class UserCheckinKBS(Document):
	def validate(self):
		if self.user and not self.sales_person:
			employee = frappe.db.get_value("Employee", {"user_id": self.user}, "name")
			if employee:
				sales_person_id = frappe.db.get_value("Sales Person", {"employee": employee}, "name")
				if sales_person_id:
					self.sales_person = sales_person_id

	def before_insert(self):
		if self.user and frappe.db.get_single_value("Tracking Setup KBS", "auto_create_employee_checkin"):
			self.create_employee_checkin()

	def create_employee_checkin(self):
		employee = frappe.db.get_value("Employee", {"user_id": self.user}, "name")
		if employee:
			current_time = now_datetime()
			
			ec = frappe.get_doc({
				"doctype": "Employee Checkin",
				"employee": employee,
				"log_type": self.log_type,
				"time": current_time,
				"device_id": "Khatavahi Tracking",
				"latitude": self.latitude,
				"longitude": self.longitude
			})
			ec.insert(ignore_permissions=True)