frappe.listview_settings["User Log KBS"] = {
	onload: function (listview) {
		listview.can_create = false;
		listview.page.clear_primary_action();
	},
	refresh: function (listview) {
		listview.can_create = false;
		listview.page.clear_primary_action();
	},
};
