'use strict';

function c(e){
	let url;
	if(e.srcElement.id === 'btn-s') 		 url = "/html/settings.html";
	else if(e.srcElement.id === 'btn-a') url = "/html/about.html";
	else return;
	browser.tabs.query({
		url: browser.runtime.getURL(url),
		windowId: browser.windows.WINDOW_ID_CURRENT
	}).then(tabArr => {
		if(tabArr.length === 0) {
			browser.tabs.create({
				active: true,
				url: url
			});
		} else if(!tabArr[0].active) browser.tabs.update(tabArr[0].id, { active: true });
	});
}

window.onload = function() {
	browser.storage.local.get("user").then(function(obj) {
		if(obj["user"]["global-SourbarIsEnabled"]) {
			document.getElementById("fwstk-banner").innerText = "Sourbar";
			document.getElementById("btn-t").href = browser.runtime.getURL("/html/tools.html");
			document.getElementById("btn-tutils").href = browser.runtime.getURL("/html/tutils.html");
			document.addEventListener("click", c);
		} else {
			document.getElementById("btn-t").hidden = true;
			document.getElementById("btn-a").hidden = true;
			document.getElementById("btn-s").hidden = true;
			document.getElementById("btn-tutils").hidden = true;
			document.getElementById("fwstk-banner").innerText = "Enable sourbar in extension options to use it";
		}
	})
}

