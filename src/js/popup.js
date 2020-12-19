window.onload = () => {
	browser.storage.local.get().then(o => {
		if(!o["user"]["global-PopupIsEnabled"]) {
			window.close();
			return;
		}
		document.addEventListener("click", (e) => {
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
				window.close();
			});
		});
	});
};