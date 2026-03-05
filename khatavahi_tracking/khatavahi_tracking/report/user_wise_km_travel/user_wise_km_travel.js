// Copyright (c) 2026, Khatavahi Tracking and contributors
// For license information, please see license.txt

frappe.query_reports["User Wise Km Travel"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_days(frappe.datetime.get_today(), -7),
			"reqd": 1
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1
		},
		{
			"fieldname": "user",
			"label": __("User"),
			"fieldtype": "MultiSelectList",
			"options": "User",
			get_data: async function (txt) {
				return frappe.db.get_link_options("User", txt)
			},
		}
	]
};
