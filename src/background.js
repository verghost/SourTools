'use strict';

// Default Settings: these cover things that can be changed in the settings menu, as well as other stuff.
var sourtools_defaults = {
	"user": {
		"global-SourbarIsEnabled": true,
		"global-PopupIsEnabled": true,
		"general-Maxreq": 250,
		"general-Sleep": 400,
		"sourspider-iqsitemap": false,
		"sourspider-iqrobots": false,
		"sourspider-iqdnsdumpster": false,
		"robobust-AllPaths": false,
		"dirbuster-List": null,
		"cfetch-List": [
			{ "on": false, "name": "GeoIp Lookup", "url": "http://api.geoiplookup.net/?query=HOST;IP", "requestType": "GET", "responseType": "html", "targets": ["ip:1", "isp", "countryname:0"], "postdata": "", "description": "" },
			{ "on": false, "name": "Mozilla Observatory", "url": "https://http-observatory.security.mozilla.org/api/v1/analyze?host=HOST;N", "requestType": "POST", "responseType": "json", "targets": ["grade", "state", "end_time"], "postdata": "hidden=true", "description": "" },
			{ "on": false, "name": "Analogizer", "url": "https://www.tomscott.com/analogizer/api/?q=INPUT;TEXT", "requestType": "GET", "responseType": "json", "targets": ["text"], "postdata": "", "description": "Gives analogies for a given length, mass (weight) or volume." }
		]
	},
	"extra": {
		// Extra data used for handling settings (stored seperately so they don't get saved by export)
		//	Current keys are: 
		//		-> displayText: Used for titles on settings page
		//		-> customControl: Forces use of custom type of setting control, otherwise "typeof value" is used
		//		-> strictType: Forces strict typing on setting values; some conversions will be tried (can't be a custom type)
		//		-> min and/or max: specify min/max to input values (must specify strictType: "number")
		//	NOTE: Some keys are type-specific or rely upon other keys being defined in a certain way; check settings.js
		"global-SourbarIsEnabled": {displayText: "Enable Sourbar", strictType: "boolean"},
		"global-PopupIsEnabled": {displayText: "Enable Popup", strictType: "boolean"},
		"general-Sleep": {displayText: "Time in between consecutive HTTP requests (ms)", strictType: "number"},
		"general-Maxreq": {displayText: "Maximum # of Requests", strictType: "number"},
		"sourspider-iqsitemap": {displayText: "Add paths from sitemap to initial queue.", strictType: "boolean"},
		"sourspider-iqrobots": {displayText: "Add paths from robots.txt to initial queue.", strictType: "boolean"},
		"sourspider-iqdnsdumpster": {displayText: "Add hosts from dnsdumpster.com to initial queue.", strictType: "boolean"},
		"robobust-AllPaths": {displayText: "Enable scanning of allow paths found in robots.txt", strictType: "boolean"},
		"dirbuster-List": {displayText: "Dirbuster List", customControl: "file"},
		"cfetch-List": {customControl: "cfetch"}
	},
	"sb-Value-Limit": 4000
};
var settings, timeOfLastSettingsUpdate = 0;

function onActionClicked(e) {
	browser.sidebarAction.toggle();
}

function tryInit(obj) { // attempt to initialize settings
	try {
		settings = obj;
	} catch(e) {
		if(SOURTOOLS_DEBUG) console.log(`[SourTools] Got error in tryInit: ${e}`);
		return 1;
	}
	timeOfLastSettingsUpdate = new Date().getTime();
	return 0;
}

browser.storage.local.get().then(function(obj) { // Init cm and settings obj
	if(SOURTOOLS_DEBUG) console.log("[SourTools] Initializing settings object in background.js");
	if(Object.entries(obj).length === 0) browser.storage.local.set(sourtools_defaults).then(function() { tryInit(sourtools_defaults); }, sourlib.errHandler("Second tryInit failed.", true));
	else tryInit(obj);
}, sourlib.errHandler("Failed to retrieve local storage object for tryInit."));

browser.browserAction.onClicked.addListener(onActionClicked);

/////////////////////////////////////////////////////////////////////////////////////////////////
// SourTools-UD CODE: Listens for changes in the browser.
/////////////////////////////////////////////////////////////////////////////////////////////////
var hn = "", hurl = "", hnwp = "";

function getHostname(url) { // Thanks to the shodan.io extension for this trick
	var elem = document.createElement('a');
	elem.href = url;
	return elem.hostname;
}

function updateHost(tab) {
	const last = hn, url = tab.url;
	if (url.indexOf('http') == -1 && url.indexOf('https') == -1) {
	// ^ If the URL doesn't start with http or https then we won't go any further
		hn = "";
		hnwp = "";
	} else {
		hurl = url;
		hn = getHostname(url);
		if(last != hn) {
			if(SOURTOOLS_DEBUG) console.log("[SourTools] Update: " + hn);
			var c_domain = tab.url.toString();
			const t1 = c_domain.indexOf("://") + 3;
			const t2 = c_domain.indexOf("/", t1);
			hnwp = (t2 > -1)? c_domain.slice(t1, t2) : c_domain.slice(t1);
			hnwp = ((url.indexOf('https') != -1)? "https://" : "http://") + hnwp;
		}
	}
}

// Update the local settings object
browser.webNavigation.onCompleted.addListener(function(navObj) {
	if((new Date().getTime() - timeOfLastSettingsUpdate) > 1000) { // 1000 ms is arbitrary (TODO: make it less arbitrary)
		if(SOURTOOLS_DEBUG) console.log("[SourTools] Updating settings object in background.js");
		browser.storage.local.get().then(function(obj) {
			settings = obj;
			timeOfLastSettingsUpdate = new Date().getTime();
		}, sourlib.errHandler("Failed to retrieve local storage object for background webNavigation update."));
	}
});

browser.tabs.onUpdated.addListener(function(id, info, tab) {
	if (tab.status === 'loading') updateHost(tab);
});

browser.tabs.onActivated.addListener(function(activeInfo) {
	if (activeInfo.tabId)
		browser.tabs.get(activeInfo.tabId, function(tab) { updateHost(tab); });
});

browser.tabs.query({currentWindow: true, active: true}).then(function(tabs) { 
	updateHost(tabs[0]); 
});
