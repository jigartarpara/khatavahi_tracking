// Copyright (c) 2026, Khatavahi Tracking and contributors
// For license information, please see license.txt

frappe.ui.form.on("Book Order", {
	refresh(frm) {
		if (frm.doc.docstatus === 0 && !frm.is_new()) {
			frm.add_custom_button(__('Create Sales Order'), () => {
				frappe.call({
					method: "khatavahi_tracking.khatavahi_tracking.utils.make_sales_order",
					args: {
						source_name: frm.doc.name
					},
					callback: (r) => {
						if (r.message) {
							let doc = frappe.model.sync(r.message);
							frappe.set_route("Form", "Sales Order", doc[0].name);
						}
					}
				});
			});
		}
	},
});
