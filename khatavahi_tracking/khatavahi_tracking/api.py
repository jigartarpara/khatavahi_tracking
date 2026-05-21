import frappe
from khatavahi_tracking.version import __version__

@frappe.whitelist(allow_guest=True)
def get_version():
    return __version__