import frappe
from frappe.model.document import Document

class BookOrder(Document):
	def validate(self):
		if self.sales_person and not self.sales_person_id:
			employee = frappe.db.get_value("Employee", {"user_id": self.sales_person}, "name")
			if employee:
				sales_person_id = frappe.db.get_value("Sales Person", {"employee": employee}, "name")
				if sales_person_id:
					self.sales_person_id = sales_person_id
		
