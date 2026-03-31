// Copyright (c) 2026, Khatavahi BI Solutions and contributors
// For license information, please see license.txt

frappe.ui.form.on("Support Visit", {
	onload: function (frm) {
		if (!frm.doc.status) {
			frm.set_value({ status: "Draft" });
		}
		if (frm.doc.__islocal) {
			frm.set_value({ mntc_date: frappe.datetime.get_today() });
		}
	}
});
