import frappe
from frappe.utils import nowdate, getdate
from datetime import datetime

def execute():
    """
    Creates Client Visit records based on Client Visit Schedule for today.
    """
    today_date = getdate(nowdate())
    formatted_date = today_date.strftime("%d-%m-%Y")
    day_name = today_date.strftime("%A").lower()
    
    # Get schedules where today's day is checked
    schedules = frappe.get_all(
        "Client Visit Schedule",
        filters={day_name: 1},
        fields=["name", "user", "customer"]
    )
    
    if not schedules:
        frappe.logger().info(f"[Client Visit Task Creator] No schedules found for {day_name.capitalize()}.")
        return

    for schedule in schedules:
        user = schedule.get("user")
        customer = schedule.get("customer")
        
        if not user or not customer:
            continue
            
        existing_visit = frappe.db.exists(
            "Client Visit",
            {
                "user": user,
                "visit_for": "Customer",
                "party_name": customer,
                "scheduled_date": today_date,
                "docstatus": ["!=", 2]
            }
        )
        
        if not existing_visit:
            try:
                cv = frappe.get_doc({
                    "doctype": "Client Visit",
                    "visit_for": "Customer",
                    "party_name": customer,
                    "user": user,
                    "status": "Pending",
                    "posting_date": today_date,
                    "scheduled_date": today_date
                })

                cv.insert(ignore_permissions=True)
                frappe.db.commit()
                frappe.logger().info(f"[Client Visit Task Creator] Created Client Visit {cv.name} for {customer} to {user} for {formatted_date}")
                
            except Exception as e:
                frappe.log_error(
                    title=f"Client Visit Creation Failed for {customer}",
                    message=frappe.get_traceback()
                )
                frappe.logger().error(f"[Client Visit Task Creator] Failed to create Client Visit for {customer}. Error: {e}")
        else:
            frappe.logger().info(f"[Client Visit Task Creator] Client Visit already exists for {customer} on {formatted_date}. Skipping.")
