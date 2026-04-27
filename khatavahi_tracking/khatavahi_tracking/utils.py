import frappe

def sync_book_order_status(doc, method):
	if not doc.get("book_order"):
		return

	if method == "on_cancel" or method == "on_trash" or doc.docstatus == 2:
		frappe.db.set_value("Book Order", doc.book_order, "status", "Pending")
		return

	status_map = {
		0: "Sales Order Draft",
		1: "Sales Order Submitted",
		2: "Sales Order Cancelled"
	}

	new_status = status_map.get(doc.docstatus)
	
	if new_status:
		frappe.db.set_value("Book Order", doc.book_order, "status", new_status)

@frappe.whitelist()
def make_sales_order(source_name):
	target_doc = frappe.new_doc("Sales Order")
	source_doc = frappe.get_doc("Book Order", source_name)
	
	target_doc.customer = source_doc.customer
	target_doc.delivery_date = source_doc.delivey_date
	target_doc.book_order = source_doc.name
	target_doc.selling_price_list = source_doc.default_price_list
	
	for item in source_doc.item:
		target_doc.append("items", {
			"item_code": item.item,
			"qty": item.qty,
			"uom": item.uom,
			"delivery_date": source_doc.delivey_date,
			"rate": item.price
		})

	if source_doc.sales_person_id:
		target_doc.append("sales_team", {
			"sales_person": source_doc.sales_person_id,
			"allocated_percentage": 100
		})
	
	target_doc.set_missing_values()
	return target_doc
