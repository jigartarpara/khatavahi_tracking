// Copyright (c) 2026, Khatavahi BI Solutions and contributors
// For license information, please see license.txt
frappe.provide("erpnext.support");
frappe.ui.form.on("Support Visit", {
	setup: function (frm) {
		frm.set_query("contact_person", erpnext.queries.contact_query);
		frm.set_query("customer_address", erpnext.queries.address_query);
	},
	onload: function (frm) {
		if (!frm.doc.status) {
			frm.set_value({ status: "Draft" });
		}
		if (frm.doc.__islocal) {
			frm.set_value({ mntc_date: frappe.datetime.get_today() });
		}
	},
	customer: function (frm) {
		erpnext.utils.get_party_details(frm);
		frm.events.customer_address(frm);
	},
	customer_address: function (frm) {
		erpnext.utils.get_address_display(frm, "customer_address", "address_display");
	},
	contact_person: function (frm) {
		erpnext.utils.get_contact_details(frm);
	}
});

erpnext.support.SupportVisit = class SupportVisit extends frappe.ui.form.Controller {
	refresh() {
		frappe.dynamic_link = { doc: this.frm.doc, fieldname: "customer", doctype: "Customer" };
	}
}

extend_cscript(cur_frm.cscript, new erpnext.support.SupportVisit({ frm: cur_frm }));