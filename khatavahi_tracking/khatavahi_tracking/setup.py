import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def after_migrate():
    create_custom_fields_logic()

def create_custom_fields_logic():
    custom_fields = {
        "Sales Order": [
            {
                "fieldname": "book_order",
                "label": "Book Order",
                "fieldtype": "Link",
                "options": "Book Order",
                "insert_after": "customer",
                "read_only": 1
            }
        ]
    }
    create_custom_fields(custom_fields)
