// Copyright (c) 2026, Khatavahi Tracking and contributors
// For license information, please see license.txt

frappe.ui.form.on("Client Location", {
	refresh(frm) {
		frm.trigger("set_dynamic_field_label");
	},
	visit_for(frm) {
		frm.trigger("set_dynamic_field_label");
	},
	set_dynamic_field_label(frm) {
		frm.set_df_property("party_name", "label", "Party Name");

		if (frm.doc.visit_for == "Opportunity") {
			frm.set_df_property("party_name", "label", "Opportunity");
			frm.fields_dict.party_name.get_query = null;
		} else if (frm.doc.visit_for == "Customer") {
			frm.set_df_property("party_name", "label", "Customer");
			frm.fields_dict.party_name.get_query = null;
		}
	}
});
