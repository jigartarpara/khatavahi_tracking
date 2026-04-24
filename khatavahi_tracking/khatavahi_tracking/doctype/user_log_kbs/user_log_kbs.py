import frappe
from frappe.model.document import Document

class UserLogKBS(Document):
	def validate(self):
		if self.user and not self.sales_person:
			employee = frappe.db.get_value("Employee", {"user_id": self.user}, "name")
			if employee:
				sales_person_id = frappe.db.get_value("Sales Person", {"employee": employee}, "name")
				if sales_person_id:
					self.sales_person = sales_person_id
