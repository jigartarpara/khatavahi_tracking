import frappe
from frappe.utils import nowdate, getdate
from datetime import datetime
import frappe.desk.form.assign_to

def execute():
    """
    Creates tasks based on Client Visit Schedule for today.
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
            
        subject = f"{user} need to visit {customer} on {formatted_date}"
        
        existing_task = frappe.db.exists(
            "Task",
            {
                "subject": subject,
                "exp_start_date": today_date,
                "status": ["!=", "Cancelled"]
            }
        )
        
        if not existing_task:
            try:
                task = frappe.get_doc({
                    "doctype": "Task",
                    "subject": subject,
                    "status": "Open",
                    "priority": "Medium"
                })

                task.insert(ignore_permissions=True)
                
                # Assign to the user
                frappe.desk.form.assign_to.add({
                    "assign_to": [user],
                    "doctype": "Task",
                    "name": task.name,
                    "description": "Auto-assigned from Client Visit Schedule",
                    "notify": True
                })
                
                frappe.db.commit()
                frappe.logger().info(f"[Client Visit Task Creator] Created and assigned task {task.name} for {customer} to {user} for {formatted_date}")
                
            except Exception as e:
                frappe.log_error(
                    title=f"Task Creation Failed for {customer}",
                    message=frappe.get_traceback()
                )
                frappe.logger().error(f"[Client Visit Task Creator] Failed to create task for {customer}. Error: {e}")
        else:
            frappe.logger().info(f"[Client Visit Task Creator] Task already exists for {customer} on {formatted_date}. Skipping.")
