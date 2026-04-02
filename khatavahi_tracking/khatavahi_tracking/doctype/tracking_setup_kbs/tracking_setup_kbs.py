# Copyright (c) 2026, Khatavahi Tracking and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

SALES_USER_PERMISSIONS = {
    "Tracking Setup KBS": {"select": 1, "read": 1, "export": 1},
    "User Checkin KBS": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1, "if_owner": 1},
    "User Log KBS": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1, "if_owner": 1},
    "Face Data": {"select": 1, "read": 1, "export": 1},
    "Client Location": {"select": 1, "read": 1, "write": 1, "create": 1},
    "Client Visit": {"select": 1, "read": 1, "write": 1, "create": 1, "delete": 1, "export": 1, "if_owner": 1},
    "Book Order": {"select": 1, "read": 1, "write": 1, "create": 1, "delete": 1, "export": 1, "if_owner": 1},
    "Task": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1},
    "ToDo": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1},
    "Customer": {"select": 1, "read": 1, "export": 1},
    "Opportunity": {"select": 1, "read": 1, "export": 1},
    "Item": {"select": 1, "read": 1, "export": 1},
}

SUPPORT_USER_PERMISSIONS = {
    "Tracking Setup KBS": {"select": 1, "read": 1, "export": 1},
    "User Checkin KBS": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1, "if_owner": 1},
    "User Log KBS": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1, "if_owner": 1},
    "Face Data": {"select": 1, "read": 1, "export": 1},
    "Task": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1},
    "ToDo": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1},
    "Support Visit": {"select": 1, "read": 1, "write": 1, "create": 1, "submit": 1, "export": 1},
    "Customer": {"select": 1, "read": 1, "export": 1},
    "Item": {"select": 1, "read": 1, "export": 1},
}

class TrackingSetupKBS(Document):
	pass

@frappe.whitelist()
def apply_permission_to_all(role, user_type):
    if not role:
        frappe.throw("Please select a Role")
    
    if not user_type:
        frappe.throw("Please select a User Type")

    if user_type == "Sales User":
        permissions = SALES_USER_PERMISSIONS
    elif user_type == "Support User":
        permissions = SUPPORT_USER_PERMISSIONS
    else:
        frappe.throw("Invalid User Type")
    
    for doctype, perm in permissions.items():
        # Check if Custom DocPerm already exists
        existing_perm = frappe.get_all("Custom DocPerm", filters={
            "parent": doctype,
            "role": role,
            "permlevel": 0
        })
        
        if existing_perm:
            # Update existing permission
            doc = frappe.get_doc("Custom DocPerm", existing_perm[0].name)
            doc.update(perm)
            doc.save(ignore_permissions=True)
        else:
            # Create new Custom DocPerm
            perm_doc = frappe.get_doc({
                "doctype": "Custom DocPerm",
                "parent": doctype,
                "parenttype": "DocType",
                "parentfield": "permissions",
                "role": role,
                "permlevel": 0,
                **perm
            })
            perm_doc.insert(ignore_permissions=True)
    
    frappe.msgprint(f"Permissions applied successfully to Role: {role} as {user_type}")
