// Copyright (c) 2026, Khatavahi Tracking and contributors
// For license information, please see license.txt

frappe.query_reports["EOD Report"] = {
	"filters": [
		{
			"fieldname": "user",
			"label": __("User"),
			"fieldtype": "Link",
			"options": "User",
			"reqd": 1,
			"default": frappe.session.user
		},
		{
			"fieldname": "date",
			"label": __("Date"),
			"fieldtype": "Date",
			"reqd": 1,
			"default": frappe.datetime.get_today()
		}
	],
	"get_datatable_options": function(options) {
		return Object.assign(options, {
			cellHeight: 120,
			inlineFilters: false
		});
	}
};
