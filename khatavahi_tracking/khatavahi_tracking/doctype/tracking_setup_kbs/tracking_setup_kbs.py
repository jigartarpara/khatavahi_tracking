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
    "Client Visit": {"select": 1, "read": 1, "write": 1, "create": 1, "delete": 1, "export": 1},
    "Book Order": {"select": 1, "read": 1, "write": 1, "create": 1, "delete": 1, "export": 1, "if_owner": 1},
    "Task": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1},
    "Property Setter": {"select": 1, "read": 1, "export": 1},
    "Global Defaults": {"select": 1, "read": 1, "export": 1},
    "Currency": {"select": 1, "read": 1, "export": 1}
}

SUPPORT_USER_PERMISSIONS = {
    "Tracking Setup KBS": {"select": 1, "read": 1, "export": 1},
    "User Checkin KBS": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1, "if_owner": 1},
    "User Log KBS": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1, "if_owner": 1},
    "Face Data": {"select": 1, "read": 1, "export": 1},
    "Task": {"select": 1, "read": 1, "write": 1, "create": 1, "export": 1},
    "Support Visit": {"select": 1, "read": 1, "write": 1, "create": 1, "submit": 1, "export": 1},
    "Global Defaults": {"select": 1, "read": 1, "export": 1},
    "Currency": {"select": 1, "read": 1, "export": 1}
}

class TrackingSetupKBS(Document):
	pass

@frappe.whitelist()
def apply_permission_to_all(role, user_type):
    from frappe.core.page.permission_manager.permission_manager import add, update
    
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
        is_if_owner = perm.get("if_owner", 0)
        
        if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0, "if_owner": is_if_owner}):
            add(doctype, role, 0)
            if is_if_owner:
                update(doctype, role, 0, "if_owner", 1, 0)
            
        for ptype, value in perm.items():
            if ptype == "if_owner":
                continue

            update(doctype, role, 0, ptype, value, is_if_owner)
    
    frappe.msgprint(f"Permissions applied successfully to Role: {role} as {user_type}")