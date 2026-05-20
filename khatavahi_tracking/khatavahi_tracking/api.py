import frappe
from khatavahi_tracking.version import __version__
from frappe.utils import today, now
from erpnext.controllers.taxes_and_totals import get_itemised_tax_breakup_data as get_breakup_data

@frappe.whitelist(allow_guest=True)
def get_version():
    return __version__

@frappe.whitelist()
def get_itemised_tax_breakup_data(doctype, name):
    doc = frappe.get_doc(doctype, name)
    doc.check_permission("read")
    return get_breakup_data(doc)