// Copyright (c) 2026, Khatavahi Tracking and contributors
// For license information, please see license.txt

frappe.ui.form.on("Tracking Setup KBS", {
	refresh(frm) {
		if (frappe.user.has_role("System Manager")){
			frm.add_custom_button("Apply Permission", () => {
				let d = new frappe.ui.Dialog({
					title: "Select Role",
					fields: [
						{
							label: "User Type",
							fieldname: "user_type",
							fieldtype: "Select",
							options: ["Sales User", "Support User"],
							reqd: 1
						},
						{
							label: "Role",
							fieldname: "role",
							fieldtype: "Link",
							options: "Role",
							reqd: 1
						}
					],
					primary_action_label: "Apply",
					primary_action(values) {
						frappe.call({
							method: "khatavahi_tracking.khatavahi_tracking.doctype.tracking_setup_kbs.tracking_setup_kbs.apply_permission_to_all",
							args: {
								role: values.role,
								user_type: values.user_type
							},
							freeze: true,
							callback: function (r) {
								if (!r.exc) {
									d.hide();
								}
							}
						});
					}
				});

				d.show();
			});
		}
	}
});
