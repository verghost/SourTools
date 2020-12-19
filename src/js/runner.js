'use_strict';

// A few little vars to clean up code 
// Side Note: for whatever reason, dqs=document.querySelector gives errors
// e.g. dqs("#lnk-back").href = browser.runtime.getURL("/html/home.html"); 
// => TypeError: 'querySelector' called on an object that does not implement interface Document.
var dqs = function(s) { return document.querySelector(s); };
var dqsa = function(s) { return document.querySelectorAll(s); };

// Messages
const REQFAIL = browser.i18n.getMessage("webToolReqFail");
const WT_NOTYET = browser.i18n.getMessage("webToolNotImplemented");
const WT_BADD = browser.i18n.getMessage("webToolBadDomain");

// Warning values
const SLOW_CONNECTION_WARNING_MIN = 2000;

// Time estimate vars used to get semi-reliable request estim
const REQ_ESTIMATE_MIN_ADJUSTMENT = 0.1, REQ_ESTIMATE_MAX_DIVISOR = 10, REQ_ESTIMATE_DEFAULT = 700;
var reqEstimate = REQ_ESTIMATE_DEFAULT; // Estimate in ms per request (this is set for each new host and adjusted)
var reqEstimateAdjCount = 0; // used to make adjustments less severe over time.
var reqEstimateAdjScore = 1; // modifies adjustment severity based on previous performance

var selTool = ""; // Selected tool (U.I)
var wtool = null; // Current tool
var sspider = null;
var numTasks = 0; // Tasks counter
var toolETA = 0, toolStartTime = 0;
var running = false, paused = false; // runner flags
var SOBJ = null; 	 // Local storage object
var HOSTN=null, HOSTWP=null, HOSTIP=null, HOSTURL=null, HOSTD=null; // name, name+protocol, name+IP, full url, domain(first sd only) 
var replaceHInfo = (s) => { // Host data replacement stuff
	const replacements = {"HOST;N": HOSTN, "HOST;WP": HOSTWP, "HOST;IP": HOSTIP, "HOST;URL": HOSTURL, "HOST;D": HOSTD};
	return s.replace(
		new RegExp(Object.keys(replacements).map(e => { return `(${e.replace(/[-\[\].*+?^${}()|\\]/g, '\\$&')})`; }).join("|"), 'g'),
		(m) => { return replacements[m] || m }
	);
};

// Cache object
var sbr_cache = {
	reqs: {},
	reqEst: {}
};

// Print logs to screen
function printSidebar(t, appendText=true, msgType=0) {
	let type = ["", "[+] ", "[-] ", "[!] "][msgType];
	const fT = type + t + "\n";
	const screenObj = (msgType === 0)? dqs("#tool-screen") : dqs("#runner-screen"),
			btnObj 	 = document.getElementById(`btn-${screenObj.id.split("-")[0]}`);
	screenObj.textContent = (appendText)? screenObj.textContent + fT : fT;
	screenObj.scrollTop = screenObj.scrollHeight; // keeping scroll at bottom
	if(btnObj.className != "button-small screen-btn open") btnObj.className = "button-small screen-btn updated";
}

// Custom confirm()
async function confBox(msg, left_text, right_text=null, callbacks=null, userInput=false, cbwait=false) {
	if(paused) { // Another confBox might be closing which takes 0.6s so just wait then check again
		await sourlib.sleep(600);
		if(paused) return;
	}
	
	// Elements
	dqs("#wtui").style.opacity = "0"; // close ui (visual)
	let left = dqs("#btn-conf-left"), right = dqs("#btn-conf-right"), input = dqs("#input-conf");
	let rBox = dqs("#resultbox"), rBoxConf = dqs("#resultbox-conf");
	let confMsg = dqs("#conf-msg");
	var closeConfBox = async function() { // Default listener for conf buttons
		rBoxConf.className = "resultbox-box";
		await sourlib.sleep(300);
		left.style.display = right.style.display = input.style.display = "none";
		confMsg.innerText = "";
		
		// I suck at css so just hold the confbox in place using min-height
		rBox.style.minHeight = rBox.style.maxWidth = rBox.style.maxHeight = "0px";
		dqs("#wtui").style.display = "block";
		dqs("#wtui").style.opacity = "100";
		await sourlib.sleep(300);
		
		rBox.remove(); // clear all event listeners in a not very optimized way
		dqs("#webtools-status").appendChild(sourlib.elemFromString(`<div id="resultbox" style="margin-top: 10px; margin-bottom: 10px; margin-left: 10px; margin-right: 10px; max-width: 0px; max-height: 0px; min-height: 0px; flex-shrink: 0;" class="resultbox"><div id="resultbox-conf" style="align-self: center; position: inherit; " class="resultbox-box"><div class="resultbox-drag" draggable="true"></div><div style="text-align: center;" class="resultbox-result"><b id="conf-msg"></b><br><input id="input-conf" type="text" style="display: none;"> <a id="btn-conf-left" class="button-small conf-btn" style="display: none;"></a><a id="btn-conf-right" class="button-small conf-btn" style="display: none;"></a></div></div></div>`));
		paused = false; // resume
		if(sspider?.status === SOURSPIDER_PAUSED) sspider?.start?.();
	};
	paused = true; // pause any mreq in process
	if(sspider?.status === SOURSPIDER_RUNNING) sspider?.pause?.();
	
	left.innerText = left_text; // Assign text
	if(right_text != null) right.innerText = right_text;
	
	if(callbacks) { // Assign callbacks
		let cbFire = function(cb, valID=0, orVal=null) 
		{	if(cbwait) return (e) => { closeConfBox(); cb([input.value, orVal, e][valID]); };
			else return async (e) => { await closeConfBox(); cb([input.value, orVal, e][valID]); }; };
		if(!Array.isArray(callbacks)) callbacks = [callbacks];
		if(callbacks.length == 2) {
			left.onclick = cbFire(callbacks[0], 2);
			right.onclick = cbFire(callbacks[1], 2);
		} else { // left only
			if(userInput) { // with input
				left.onclick = cbFire(callbacks[0], 0);
			} else if(right_text != null) {
				left.onclick = cbFire(callbacks[0], 1, true);
				right.onclick = cbFire(callbacks[0], 1, false);
			} else {
				if(callbacks[0]) left.onclick = cbFire(callbacks[0], 2);
			}
		}
	}
	
	// Display controls
	left.style.display = "inline-block";
	if(userInput) input.style.display = "inline";
	else if(right_text != null) right.style.display = "inline-block";
	
	// rBox
	rBox.style.maxWidth = "300px";
	rBox.style.maxHeight = rBox.style.minHeight = "100px";
	await sourlib.sleep(200); // Wait for transition
	
	// Add message and display
	confMsg.innerText = msg;
	dqs("#wtui").style.display = "none";
	rBoxConf.className = "resultbox-box filled";
}

function extractRobotPaths(ro, allow=false) {
	let ret = [];
	for(let i = 0, j = 0;;) {
		let d = ro.disallow[i++], a = allow? ro.allow[j++] : undefined;
		if(!d && (!allow || !a)) break;
		d = d?.replace?.(/\*\/?$/, '')?.replace?.(/\$$/, ''); // Deal with trailing * or $
		a = a?.replace?.(/\*\/?$/, '')?.replace?.(/\$$/, '');
		if(d && d.indexOf('*') === -1 && d.indexOf('$') === -1 && sourlib.urlObj((d = HOSTWP + d)) !== null) ret.push(d); // Skip bad urls 
		if(allow && a && a.indexOf('*') === -1 && a.indexOf('$') === -1 && sourlib.urlObj((a = HOSTWP + a)) !== null) ret.push(a);
	}
	return ret;
}

function getFormattedEta(eta) {
	let etaString = "", r;
	if(eta > 3600) {
		etaString += Math.round(eta / 3600) + "hr ";
		r = eta % 3600;
		if(r == 0) return etaString;
		eta -= 3600 * r;
	}
	if(eta > 60) {
		etaString += Math.round(eta / 60) + "min ";
		r = (eta % 60);
		if(r == 0) return etaString;
		eta -= 60 * r;
	}
	if(etaString == "") etaString += Math.max(eta, 1) + "s"; // We can't promise 0 seconds
	else if(eta > 0 ) etaString += eta + "s";
	return etaString;
}

function startWebTools() {
	dqs("#loading").hidden = false;
	dqs("#status-text").innerText = "Status: Working...";
	dqs("#btn-run").innerText = "Cancel";
}

function resetWebTools(adj=true, success=true) {
	if(adj) { // Modify adjustment score
		let realETA = performance.now() - toolStartTime;
		reqEstimateAdjScore = 0.5 + (Math.min(toolETA, realETA) / (Math.max(toolETA, realETA) * 2));
		sbr_cache.reqEst[HOSTN] = reqEstimate; // cache current estimate value
		if(SOURTOOLS_DEBUG) printSidebar(`Adjustment from reset: tETA=${toolETA}, rtETA=${realETA}, reqEst=${reqEstimateAdjScore}`, true, 3);
	}
	
	// Reset globals and elems
	toolETA = 0, toolStartTime = 0, wtool = null, paused = false;
	dqs("#loading").hidden = true;
	dqs("#status-text").innerText = "Status: Idle";
	dqs("#status-progress").innerText = "";
	dqs("#btn-run").innerText = "Run";
	
	// Finish run
	if(success) printSidebar("Web tool has completed!", true, 1);
	else printSidebar("Web tool has stopped!", true, 2);
	if(sspider?.status === SOURSPIDER_RUNNING) sspider.stop();
	running = false;
}

async function updateTasks(tpc, t_elapsed=null) {
	// Update numTasks and re-calculate reqEstimate
	if(tpc == 1) numTasks -= 1;
	if(t_elapsed !== null && t_elapsed > 100) {
		let diff = t_elapsed - reqEstimate;
		if(diff != 0) {
			reqEstimateAdjCount++;
			const sign = (diff < 0)? -1 : 1;
			diff = Math.abs(diff);
			// reqEstimateAdjScore is adjusted in resetWebTools.
			let prop = Math.min((reqEstimateAdjCount + 1) * reqEstimateAdjScore, REQ_ESTIMATE_MAX_DIVISOR);
			prop = Math.max(1, prop);
			const adj = ((reqEstimate / (diff + reqEstimate)) * diff) / prop;
			reqEstimate += sign * Math.max(adj, REQ_ESTIMATE_MIN_ADJUSTMENT);
			//if(SOURTOOLS_DEBUG) printSidebar(`Adjusted estimate from updateTasks: reqEst=${reqEstimate}`, true, 3);
		}
	}
	
	// Update percentage
	let percent = Math.floor(100 * ((total_tasks - numTasks + tpc) / total_tasks));
	dqs("#status-progress").innerText = percent + "% complete";
	
	// End scan
	if(numTasks == 0) resetWebTools();
}

async function mReq(reqList) {
	const sleepTime = SOBJ["user"]["general-Sleep"];
	let rcdCaller = cb_default = function(e) { if(e.total > e.loaded && e.loaded > 0) updateTasks(e.loaded / e.total); };
	toolStartTime = performance.now();
	printSidebar("mReq started!", true, 1);
	for(let r, i = 0; i < reqList.length; i++) {
		while(paused && running) await sourlib.sleep(500); // if we're paused, wait and check every 0.5s
		if(!running) return; // Return on stop
		sourlib.req({method: "GET", cb_ok: wtool.hRCD, cb_err: wtool.hRCD, cb_onprog: cb_default, cb_send_extra: null, send_data: null, useTimer: true, ...reqList[i]});
		await sourlib.sleep(sleepTime);
	}
}

function startMReq(reqList) {
	numTasks = reqList.length;
	
	if(numTasks > SOBJ["user"]["general-Maxreq"]) {
		printSidebar(`Too Many requests (${numTasks})! You may need to increase the maximum in the settings.`, true, 2);
		running = false;
		return;
	}
	if(numTasks <= 0) {
		printSidebar("No paths!", true, 2);
		running = false;
		return;
	}
	
	total_tasks = numTasks;
	const sleep = SOBJ["user"]["general-Sleep"];
	toolETA = reqEstimate * numTasks;
	const eta = getFormattedEta(Math.round(toolETA / 1000));
	
	const confMessage = `This action will execute ${numTasks} requests.\nIt will also take ~${eta}.\nDo you wish to continue?`;
	confBox(confMessage, "Ok", "Cancel", function(b) {
		if(b) {
			startWebTools();
			mReq(reqList);
		} else {
			printSidebar("Task cancelled", true, 2);
			running = false;
			return;
		}
	});
}

function startRunner(t) {
	var prev_HOSTN = HOSTN, prev_HOSTWP = HOSTWP, runTool = function() {
		if(!wtool) {
			printSidebar(WT_NOTYET, true, 2);
			running = false;
			return;
		}
		wtool.run();
	}, onStorage = function(obj) {
		SOBJ = obj, wtool = tools[t];
		if(t === 'dirbuster' && !SOBJ["user"]["dirbuster-List"]) {
			printSidebar("No dirbuster list selected!", true);
			running = false;
			return;
		}
		if(prev_HOSTN != HOSTN || prev_HOSTWP != HOSTWP || HOSTIP == null) { 
			printSidebar("Resolving hostname...", true, 1); // resolve hostname to IP and get a new reqEstimate baseline
			browser.dns.resolve(HOSTN, ["disable_ipv6"]).then(function(data) {
				try {
					HOSTIP = data.addresses[0];
					// NOTE: cfetch has multiple destinations, so host baseline won't always give the best value
					if(t === 'spider' || !!sbr_cache.reqEst[HOSTN]) {
						reqEstimate = sbr_cache.reqEst[HOSTN] || REQ_ESTIMATE_DEFAULT;
						runTool();
					} else {
						printSidebar("Getting connection baseline...", true, 1);
						sourlib.req({url: HOSTWP, method: "GET", cb_ok: function(data) {
							reqEstimate = (REQ_ESTIMATE_DEFAULT + data.tel) / 2;
							sbr_cache.reqEst[HOSTN] = reqEstimate;
							if(SOURTOOLS_DEBUG) printSidebar(`Baseline estimate: ${reqEstimate}`, true, 3);
							if(reqEstimate > SLOW_CONNECTION_WARNING_MIN) {
								printSidebar("Warning: Connection is a bit slow!", true, 2);
							}
							runTool();
						}, useTimer: true});
					}
				} catch(e) { 
					HOSTIP = null; 
					if(SOURTOOLS_DEBUG) printSidebar(`Error at hn resolve: ${e}`, true, 3);
				}
			});
		} else runTool();
	};
	
	dqs("#tool-screen").textContent = dqs("#runner-screen").textContent = ""; // reset screens and buttons
	dqs("#btn-tool").className = dqs("#btn-tool").className.replace(/updated/, '');
	dqs("#btn-runner").className = dqs("#btn-runner").className.replace(/updated/, '');
	printSidebar(`Web tool <${t}> started!`, false, 1);
	
	var bg = browser.extension.getBackgroundPage(); // Portal to background.js
	HOSTN = bg.hn, HOSTWP = bg.hnwp, HOSTURL = bg.hurl, HOSTD = HOSTN?.match?.(/[^\.]+\.[a-z]{2,}$/)?.[0] || HOSTN;
	
	// A small fix to updateHost since it can sometimes not have a domain on startup (seems too big)
	let onError = sourlib.errHandler("Failed to retrieve local storage object to update SOBJ.");
	if(HOSTN == "" || !HOSTN) { // force an update
		var querying = browser.tabs.query({currentWindow: true, active: true});
		querying.then(function(tabs) {
			bg.updateHost(tabs[0]);
			HOSTN = bg.hn, HOSTWP = bg.hnwp, HOSTURL = bg.hurl, HOSTD = HOSTN?.match?.(/[^\.]+\.[a-z]{2,}$/)?.[0] || HOSTN;
			if(HOSTN == "" || !HOSTN) {
				printSidebar(WT_BADD, false, 2);
				running = false;
				return;
			}
			browser.storage.local.get("user").then(onStorage, onError);
		}, sourlib.errHandler("Couldn't get active tabs for the current window (updateHost fix)."));
	} else browser.storage.local.get("user").then(onStorage, onError);
}

// TOOLS
var tools = {
	spider: {
		run: async function() {
			const ssmName = dqs("#spider-dropdown").value;
			let spiderModule = ssModules[ssmName];
			if(!spiderModule) {
				printSidebar("Invalid spider module!", true, 2);
				resetWebTools(false, false);
				return;
			}
			let spiderMaxLayer = dqs("#spider-maxlayer").value.trim(), spiderMaxPages = dqs("#spider-maxpages").value.trim(), spiderIsolate = dqs("#spider-isolate").value.trim();
			if(spiderMaxLayer === "inf") spiderMaxLayer = Infinity;
			if(spiderMaxPages === "inf") spiderMaxPages = Infinity;
			if(sourlib.isItNaN(spiderMaxLayer) || sourlib.isItNaN(spiderMaxPages) || (spiderIsolate !== "true" && spiderIsolate !== "false")) {
				printSidebar("Invalid spider settings!", true, 2);
				resetWebTools(false, false);
				return;
			}
			let niq = [], reqsNeeded = (SOBJ["user"]["sourspider-iqsitemap"] || SOBJ["user"]["sourspider-iqrobots"]) + SOBJ["user"]["sourspider-iqdnsdumpster"];
			if(SOBJ["user"]["sourspider-iqsitemap"] || SOBJ["user"]["sourspider-iqrobots"]) { // add robots.txt paths to initial queue
				sourlib.req({ url: HOSTWP + "/robots.txt", method: "GET", cb_any: (data) => {
					if(data.s == "200") {
						const robj = SSpider.parseRobots(data.r, true);
						if(SOBJ["user"]["sourspider-iqrobots"]) niq = niq.concat(extractRobotPaths(robj, true)); 
						if(SOBJ["user"]["sourspider-iqsitemap"]) robj.sitemaps.forEach(sm => { niq.push(sm); });
					}
					reqsNeeded--;
				}});
			}
			if(SOBJ["user"]["sourspider-iqdnsdumpster"]) { // dnsdumpster hosts to initial queue
				sourlib.req({url: `https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(HOSTD)}`, method: "GET", cb_any: (data) => {
					if(data.s == "200")
						data.r.split(/\r\n|\r|\n/).map(e => { return e.split(",")[0]; }).forEach(e => { niq.push((e.indexOf("://") === -1)? "https://" + e : e); });	
					reqsNeeded--;
				}});
			}
			if(reqsNeeded > 0) { // wait for iq to be filled
				printSidebar("Waiting for initial queue...", true, 1);
				while(reqsNeeded > 0) await sourlib.sleep(500);
			}
			niq = spiderModule.iq.map((u) => { return replaceHInfo(u); }).concat(niq);
			sspider = new SSpider({ // create spider
				...spiderModule, 
				options: { ...(spiderModule.options || {}),
					maxLayer: Number(spiderMaxLayer), // override with ui settings
					maxPages: Number(spiderMaxPages),
					isolate: spiderIsolate === "true"
				}, callbacks: { // default callbacks + module-specific ones
					progress: function(data, out) { dqs("#status-progress").innerText = `\nTC: ${sspider.tc}, PC: ${sspider.pc}, QL: ${sspider.q.length}`; }, 
					end: function(data, out) {
						if(data.errMsg) printSidebar(`Error: ${data.errMsg}`);
						resetWebTools(false);
					}, ...(spiderModule.callbacks || {}) 
				},  iq: niq, debug: spiderModule.debug || printSidebar
			});
			confBox(`This spider will perform an unknown number of requests.\nDo you wish to continue?`, "Ok", "Cancel", function(b) {
				if(b) {
					startWebTools(); // start runner
					sspider.start(); // start spider
				} else {
					printSidebar("Task cancelled", true, 2);
					resetWebTools(false, false);
					return;
				}
			});
		}
	},
	
	robobust: {
		hRCD: function(rcData) {
			const s = rcData["s"], path = rcData["url"].slice(HOSTN);
			printSidebar("|" + path +  "|" +  ((s == 200)? "OK" : s) + "|\n", true);
			updateTasks(1, rcData["tel"]);
		}, run: async function() {
			function runRobobust(data) {
				if(data.s == 200) {
					startMReq(extractRobotPaths(SSpider.parseRobots(data.r, true), SOBJ["user"]["robobust-AllPaths"]).map(e => { return {url: e} }));
				} else {
					printSidebar("\nNo robots.txt!", true, 2);
					resetWebTools(false, false);
					return;
				}
			}
			// Initial request
			sourlib.req({ url: HOSTWP + "/robots.txt", method: "GET", cb_ok: runRobobust, cb_err: runRobobust});
		}
	},
	
	dirbuster: {
		hRCD: function(rcData) {
			const s = rcData["s"], path = rcData["url"];
			printSidebar("|" + path +  "|" + s + "|\n", true);
			updateTasks(1, rcData["tel"]);
		}, run: async function() {
			var r = new FileReader();
			r.onloadend = function() {
				let fText = this.result, reqList = [];
				fText.split(/\r\n|\r|\n/).forEach((l) => {
					l = l.replace(/\s/g,''); // remove spaces
					if(l.length > 0 && l[0] !== "#") reqList.push({
						url: `${HOSTWP}/${l.replace(/^\//, '')}`, // normalize
					method: "GET" });
				});
				startMReq(reqList);
			};
			printSidebar("Reading dirbuster list...", true, 1);
			try { r.readAsText(SOBJ["user"]["dirbuster-List"]); }  // Read list
			catch(e) {
				printSidebar("Error reading dirbuster list!", true, 2);
				resetWebTools(false, false);
			}
		}
	},
	
	cfetch: {
		hRCD: function(data) {
			let applyRegex = (r, rf, result) => {
				try { // do regex
					let r = t.rrm = result.match(new RegExp(r, rf));
					if(Array.isArray(rm)) rm = rm[0];
					return rm;
				} catch(e) { return result; }
			}, tLog = "", optData = data.x, rt=data.r, rType = optData[0], targets=optData[1], name=optData[2];
			if(data.s >= 400) tLog = "\n" + REQFAIL;
			else {
				try { switch(rType) {
					case 'json':
						let jso = JSON.parse(rt), jsonRarr = new Set();
						targets.forEach(function(t) { 
							let res = jso[t.n];
							if(Array.isArray(res) && !sourlib.isItNaN(t.i)) res = res[t.i];
							else if(typeof res === "object") res = JSON.stringify(res);
							if(t.r) res = applyRegex(t.r, t.rf || undefined, res);
							jsonRarr.add(t.n + ": " + (res || REQFAIL)); 
						});
						jsonRarr.forEach(function(r) { tLog += "\n" + r; });
						break;
					case 'html': // Targets are unique tag ids
						let doc = (new DOMParser()).parseFromString(rt, "text/html"), htmlRarr = new Set();
						targets.forEach(function(t) { 
							let res = doc.querySelectorAll(t.n)[t.i || 0]?.textContent;
							if(t.r) res = applyRegex(t.r, t.rf || undefined, res);
							htmlRarr.add(t.n + ": " + (res || REQFAIL)); 
						});
						htmlRarr.forEach(function(r) { tLog += "\n" + r; });
						break;
				} } catch(e) { tLog = "\n" + REQFAIL; }
			}
			
			tLog = "--" + name + "--" + tLog + "\n";
			printSidebar(tLog, true);
			updateTasks(1, data["tel"]);
		}, run: async function() {
			let tParser = function(t) {
				let h = (i) => { if(i < 0) { return t.length; } else { return i; } };
				let name  = t.match(/^([^:]*):?/)?.[1], 
					 index = t.match(/:([0-9]*){?/)?.[1],
					 regex = t.match(/{(.*)}$/)?.[1], rflags = regex?.match(/^\/(.*)\/([a-z]*)$/)?.[2];
				if(rflags) regex = regex?.match(/^\/(.*)\/([a-z]*)$/)?.[1];
				return {n: name, i: index, r: regex, rf: rflags};
			}, cfetchs = SOBJ["user"]["cfetch-List"], reqList = [], isOn = false;
			for(let i=0; i < cfetchs.length; i++) {
				let cfetch = cfetchs[i];
				if(!cfetch["on"]) continue; // Check onoff
				else isOn = true;
				
				// Do URL and target replacements
				let url = replaceHInfo(cfetch["url"]), targets = cfetch["targets"].map(e => { return replaceHInfo(e); }).map(tParser);
				let inputMatches = cfetch.url.match(/(?<=INPUT;)((TEXT)|(NUM))/ig), iLen = inputMatches?.length || 0, index = 0;
				if(iLen > 0) { // Input grab
					let inpFunc = () => {
						if(index >= iLen || index === null) return;
						let t = inputMatches[index].toLowerCase();
						confBox(`Input for "${cfetch["name"]}": must be ${t}.`, "Submit", null, function(i) {
							if((t == "num" && sourlib.isItNaN(i)) || (t == "text" && i.length == 0)) { // Type checks
								printSidebar(`The "${cfetch["name"]}" fetch was not given a "${t}" input`, true, 2);
								resetWebTools(false, false);
								index = null;
								return;
							}
							url = url.replace(/INPUT;((TEXT)|(NUM))/i, i); index++; inpFunc();
						}, true);
					}; inpFunc();
				}
				
				// Add to req list once the data is ready
				while(index !== null && index < iLen) await sourlib.sleep(500);
				if(index === null) return;
				reqList.push({url: url, method: cfetch["requestType"], send_data: cfetch["postdata"], cb_send_extra: [ cfetch["responseType"], targets, cfetch["name"] ]});
			}
			
			// Only start if some scan is active
			if(isOn) startMReq(reqList);
			else {
				printSidebar(browser.i18n.getMessage("sinfoNoTasks"), true, 2);
				resetWebTools(false, false);
			}
		}
	}
};

// Page code
function selectTool(toolName, toolObj, color) {
	var i, tabcontent, tablinks, toolBlock = dqs(`#${toolName}`);
	tabcontent = document.getElementsByClassName("tabcontent");
	for(i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
	tablinks = document.getElementsByClassName("tablink");
	for(i = 0; i < tablinks.length; i++) tablinks[i].style.backgroundColor = "";
	toolBlock.style.display = "block";
	toolBlock.style.backgroundColor = toolObj.style.backgroundColor = color;
	selTool = (toolName == 'default')? "" : toolName;
}

// back/cancel button during scan
async function cancelTool(goBack=false) {
	if(running && !paused) { // put out dialog if it is running
		confBox("This will cancel the current action\nAre you sure you want to exit?", "Yes", "Cancel", function(b) {
			if(b) {
				resetWebTools(false, false);
				if(goBack) dqs("#lnk-back").click();
			}
		}, false, goBack);
	} else if(goBack) dqs("#lnk-back").click();
}

function c(e) {
	const id = e.srcElement.id;
	switch (id) {
		case 'btn-run':
			if(running) {
				cancelTool();
				break;
			} else if(selTool != "") {
				running = true;
				startRunner(selTool);
			} else printSidebar("No tool selected!", false, 2);
			break;
		case 'btn-spid':
			selectTool('spider', e.srcElement, 'darkgreen');
			break;
		case 'btn-robo':
			selectTool('robobust', e.srcElement, 'darkred');
			break;
		case 'btn-dirb':
			selectTool('dirbuster', e.srcElement, 'purple');
			break;
		case 'btn-cfetch':
			selectTool('cfetch', e.srcElement, 'darkblue');
			break;
		case 'btn-back':
			cancelTool(true);
			break;
		case 'btn-tool':
			dqs("#btn-tool").className = "button-small screen-btn open", dqs("#tool-screen").style.display = "block";
			dqs("#btn-runner").className = "button-small screen-btn", dqs("#runner-screen").style.display = "none";
			break;
		case 'btn-runner':
			dqs("#btn-tool").className = "button-small screen-btn", dqs("#tool-screen").style.display = "none";
			dqs("#btn-runner").className = "button-small screen-btn open", dqs("#runner-screen").style.display = "block";
			break;
		default:
			if(id == "" || id === "sourbody") selectTool('default', dqs("#default"), 'black');
			break;
	}
}

window.onload = function() {
	dqs("#lnk-back").href = browser.runtime.getURL("/html/home.html");
	dqs("#defaultMsg").innerText = browser.i18n.getMessage('webToolDefaultMsg');
	dqs("#spiderMsg").innerText = browser.i18n.getMessage('webToolSpiderMsg');
	dqs("#robobustMsg").innerText = browser.i18n.getMessage('webToolRobobustMsg');
	document.querySelector("#dirbusterMsg").innerText = browser.i18n.getMessage('webToolDirbustMsg');
	document.querySelector("#cfetchMsg").innerText = browser.i18n.getMessage('webToolCscanMsg');
	
	let spdd = dqs("#spider-dropdown");
	spdd.onchange = function(e) { // Setup spider settings
		dqs("#spider-maxlayer").value = (this.value === "")?  "" : ssModules[this.value]?.options?.maxLayer?.toString() || sourspider_defaults.maxLayer;
		dqs("#spider-isolate").value = (this.value === "")?  "" : ssModules[this.value]?.options?.isolate?.toString() || sourspider_defaults.isolate;
		dqs("#spider-maxpages").value = (this.value === "")?  "" : ssModules[this.value]?.options?.maxPages?.toString() || sourspider_defaults.maxPages;
	};
	for(let k in ssModules) spdd.appendChild(sourlib.elemFromString(`<option id="spider-option" value="${k}">${k}</option>`));
};
document.addEventListener("click", c);