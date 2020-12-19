/*
	A very simple custom web-crawler/spider
	Much credit to https://github.com/simplecrawler/simplecrawler and https://github.com/samclarke/robots-parser
	TODO: Add support for robot meta tags and X-Robots-Tag http headers https://en.wikipedia.org/wiki/Robots_exclusion_standard#Meta_tags_and_headers
*/
const SOURSPIDER_STOPPED = 0, // Status codes
      SOURSPIDER_RUNNING = 1,
      SOURSPIDER_PAUSED  = 2;
// File extension lists and sets are used to filter queue ops and also to act as supplemental tools to modules.
// They are: mediaExt, codeExt, docExt, archExt, execExt, otherExt, mediaSet, fileSet, webcontent, webpages.
const mediaExt = [/* image */ ".webp", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".jfif", ".exif", ".tiff", ".bmp", ".ppm", ".pgm", ".pbm", ".pnm", ".webp", ".heif", ".bpg", ".cgm", ".svg", ".ico", /* video */ ".avi", ".flv", ".ogg", ".mp4", ".m4p", ".m4v", ".wmv", ".vob", ".ogv", ".mng", ".mov", ".rmvb", ".asf", ".nsv", ".f4v", ".f4p", ".amv", ".webm", ".mkv", ".mpg", ".mp2", ".mpeg", ".mpv", ".svi", ".3gp", ".3g2", ".mxf", ".roq", /* audio */ ".aac", ".m4a", ".mp3", ".wav", ".aa", ".aax", ".act", ".aiff", ".amr", ".ape", ".au", ".awb", ".dct", ".dss", ".dvf", ".flac", ".gsm", ".iklax", ".ivs", ".m4a", ".m4b", ".m4p", ".mmf", ".mpc", ".msc", ".ogg", ".oga", ".mogg", ".oups", ".ra", ".raw", ".tta", ".vox", ".wma", ".wv", ".webm", /* font	*/ ".woff2"], otherExt = [".db"], execExt = [".exe", ".com", ".msi", ".bin", ".dmg"], archExt = [".zip", ".tar.gz", ".gz", ".rar", ".7z", ".sit", ".sitx", ".tgz", ".tar.bz", ".tar", ".iso", ".a", ".ar", ".cpio", ".shar", ".lbr", ".iso", ".mar", ".sbx", ".bz2", ".lz", ".lzma", ".lzo", ".rz", ".sz", ".s7z", ".ace", ".afa", ".alz", ".apk", ".tar.bz2", ".tar.Z", ".tar.lzma", ".tlz", ".tbz2", ".xp3", ".zz", ".bzip", ".lzip", ".lzop", ".rzip"], docExt = [".pdf", ".doc", ".docx", ".docm", ".ppt", ".pptx", ".pptm", ".pot", ".pps", ".potx", ".potm", ".ppam", ".ppsx", ".ppsm", ".pub", ".odf", ".ods", ".odp", ".ps", ".xps", ".dot", ".wbk", ".dotx", ".dotm", ".docb", ".xlt", ".xlm", ".xltx", ".xltm", ".xlsb", ".xlam", ".xll", ".xlw", ".vbproj", ".vcproj", ".vdproj", ".xla", ".xls", ".xlsx", ".xlsm", ".xml", ".xsl"], codeExt = [".adb", ".ads", ".ahk", ".applescript", ".as", ".au3", ".bat", ".bas", ".cljs", ".cmd", ".coffee", ".c", ".cpp", ".ino", ".egg", ".egt", ".erb", ".hta", ".ibi", ".ici", ".ijs", ".ipynb", ".itcl", ".jsfl", ".kt", ".lua", ".m", ".mrc", ".ncf", ".nuc", ".nud", ".nut", ".pde", ".pl", ".pm", ".ps1", ".ps1xml", ".psc1", ".psd1", ".psm1", ".py", ".pyc", ".pyo", ".r", ".rb", ".rdp", ".red", ".rs", ".sb2", ".scpt", ".scptd", ".sdl", ".sh", ".syjs", ".sypy", ".tcl", ".tns", ".vbs", ".xpl", ".ebuild", ".ada", ".2.ada", ".1.ada", ".asm", ".s", ".bb", ".bmx", ".clj", ".cls", ".cob", ".cbl", ".cc", ".cxx", ".cbp", ".cs", ".csproj", ".d", ".dba", ".dbpro123", ".e", ".efs", ".el", ".for", ".ftn", ".f", ".f77", ".f90", ".frm", ".frx", ".fth", ".ged", ".gm6", ".gmd", ".gmk", ".gml", ".go", ".h", ".hpp", ".hxx", ".hs", ".i", ".inc", ".java", ".l", ".lgt", ".lisp", ".m4", ".ml", ".msqr", ".n", ".nb", ".p", ".pas", ".pp", ".piv", ".pli", ".pl1", ".prg", ".pro", ".pol", ".reds", ".resx", ".rc", ".rc2", ".rkt", ".rktl", ".scala", ".sci", ".sce", ".scm", ".sd7", ".skb", ".skc", ".skd", ".skf", ".skg", ".ski", ".skk", ".skm", ".sko", ".skp", ".skq", ".sks", ".skt", ".skz", ".sln", ".spin", ".stk", ".swg", ".vap", ".vb", ".vbg", ".vbp", ".vip", ".xq", ".y"];
const mediaSet = new Set(mediaExt), webcontent = new Set([".js", ".css"]), webpages = new Set([".jsp", ".html", ".asp", ".aspx", ".cshtml", ".vbhtm", ".php", ".php3", ".php4", ".php5", ".shtml", ".phtml", ""]), fileSet = new Set(docExt.concat(archExt).concat(execExt).concat(codeExt).concat(otherExt));
const sourspider_defaults = {
	maxLayer: 0, maxPages: 400, maxSize: Infinity, maxThreads: 4, queueMax: Infinity, // max values
	//maxTimeouts: Infinity,
	threadWait: 100, reqTimeout: 8000, spiderTimeout: 80000, // timings
	//retrymax: 2, // Max # of times we retry
	//retryDelay 100000, // How long to wait until we try again
	sortThreshold: 4,
	checkDirs: false, // for any URL, all parent directories will be sent to the queue
	nosscript: false, // Don't scrape script tags or the code within
	iwww: true, // Ignore www. subdomain; any links will have this stripped if it appears first (i.e. www.example.com -> example.com)
	politeness: 0, // 0=Obey nothing, 1=Obey user-agent: *, 2=Obey all user-agents' directives (no conflict checks happen, rules are followed in-order)
	isolate: true, // no requests will be made off of the "base" domain of any item added to the queue with layer=0
	useEtag: false, // use etag header to identify repeat resources that might appear under seperate urls
	hashAlgo: null, // Use hash to fingerprint recs. Algos are: SHA-1, SHA-256, SHA-384, SHA-512 (if useEtag=true, then strong etag supersedes hash)
	queueRules: { media: false, code: false, docs: true, archives: false, execs: false, other: false }
};
class SSpider {
	constructor(initObj) {
		initObj = initObj || {};
		this.options = { ...sourspider_defaults, ...(initObj.options || {})};
		this.pc = 0; // page count
		this.tc = 0; // thread count
		this.h = {}; // history
		this.d = {}; // domain info
		this.q = [], this.q.disorder = 0;
		this.status = SOURSPIDER_STOPPED;
		this.callbacks = initObj.callbacks || {};
		this.debug = function(m) { initObj?.debug(m); };
		this.queuefilter = new Set((initObj.queuefilter || []).concat((!this.options.queueRules.media && mediaExt) || []).concat((!this.options.queueRules.code && codeExt) || []).concat((!this.options.queueRules.docs && docExt) || []).concat((!this.options.queueRules.archives && archExt) || []).concat((!this.options.queueRules.execs && execExt) || []).concat((!this.options.queueRules.other && otherExt) || []));
		if(this.options.hashAlgo) this._hash = new jsSHA(this.options.hashAlgo, "TEXT");
		this.emit("init");
		initObj.iq?.forEach?.((u) => { this.queue(u); }); // load initial queue
	}
	
	static parseRobots(txt, extraPolite=false, toRegex=false) { 
		var robotObj = { sitemaps: [], hosts: [], allow: [], disallow: [], size: 0 }, currUA = "";
		if(!txt || txt == "") return robotObj;
		txt.split(/\r\n|\r|\n/).map(function(line) {
			let commentStartIndex = line.indexOf('#');
			if(commentStartIndex > -1) return line.substr(0, commentStartIndex);
			return line;
		}).map(function(line) {
			let idx = String(line).indexOf(':');
			if(!line || idx === -1) return null;
			return [line.slice(0, idx), line.slice(idx + 1)];
		}).map(function trimLine(line) {
			if(!line) return null;
			if(Array.isArray(line)) return line.map(trimLine);
			return String(line).trim();
		}).forEach(function(line) {
			if((!line || !line[0] || !line[1]) || (!extraPolite && currUA !== "*")) return;
			switch(line[0].toLowerCase()) {
				case 'disallow':
					robotObj.disallow.push(line[1]);
					break;
				case 'allow':
					robotObj.allow.push(line[1]);
					break;
				case 'crawl-delay': // we take the first one we see 
					if(!robotObj.crawl_delay && !sourlib.isItNaN(line[1]))
						robotObj.crawl_delay = Number(line[1]);
					break;
				case 'sitemap':
					robotObj.sitemaps.push(line[1]);
					break;
				case 'host': // SourSpider doesn't currently use this directive, but it might in future
					robotObj.hosts.push(line[1].toLowerCase());
					break;
				case 'user-agent':
					currUA = line[1];
					break;
			}
		});
		if(toRegex) {
			let mf = (pattern) => {
				try { pattern = encodeURI(pattern).replace(/%25/g, '%').replace(/%[0-9a-fA-F]{2}/g, (match) => { return match.toUpperCase(); }); } catch(e) {} // normalize %-encoded hex values
				if(pattern.indexOf('*') === -1 && pattern.indexOf('$') === -1) return pattern; // it's not a matching pattern, so no regex needed
				pattern = pattern 
					.replace(/[-\[\].*+?^${}()|\\]/g, '\\$&') // escape regex reserved chars
					.replace(/\*+/g, '(?:.*)') // wild card
					.replace(/\\\$$/, '$'); // end of line
				return new RegExp(pattern);
			};
			robots.allow.map(mf);
			robots.disallow.map(mf);
		}
		robotObj.crawl_delay = robotObj.crawl_delay || 42;
		robotObj.size = robotObj.allow.length + robotObj.disallow.length;
		return robotObj;
	}
	
	scrape(s, curr) {
		const options = this.options, nLayer = curr.layer + 1;
		if(options.nosscript) s = s.replace(/<script(.*?)>([\s\S]*?)<\/script>/gi, "");
		if(options.hashAlgo && (!options.useEtag || !curr.etag.t || curr.etag.isWeak) && this.hash(s)) return;
		this.emit("scrape", {curr: curr, src: s});
		[ 	/\s(?:href|src|action)\s*=\s*("|').*?\1/ig, /\s(?:href|src|action)\s*=\s*[^"'\s][^\s>]+/ig,
			/\s?url\((["']).*?\1\)/ig, /\s?url\([^"')]*?\)/ig, // handle url(some_rec) (with and without '' or "")
			/https?:\/\/[^?\s><'",]+/ig,
			function(string) {
				var result = /\ssrcset\s*=\s*("|')(.*?)\1/.exec(string);
				return Array.isArray(result) ? String(result[2]).split(",").map(function(string) {
					 return string.trim().split(/\s+/)[0];
				}) : "";
			}, function(string) {
				var match = string.match(/<meta[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'] ?[^"'>]*url=([^"'>]*)["']?[^>]*>/i);
				return Array.isArray(match) ? [match[1]] : undefined;
			}, function(string) {
				var match = string.match(/<meta[^>]*content\s*=\s*["']?[^"'>]*url=([^"'>]*)["']?[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/i);
				return Array.isArray(match) ? [match[1]] : undefined;
			}
		].forEach((t) => {
			((typeof t === "function")? t(s) : s.match(t))?.forEach?.((e) => {
				if(!e || !(e?.match?.(/\//))) return; // assert string type and weed-out bad responses
				if (options.iwww) e = e.replace(/^www\./i, "");
				e = e.replace(/^(?:\s*href|\s*src|\s*action)\s*=+\s*/i, "") // remove href, src and action attribs
					  .replace(/^\s*/, "") // no whitespace!
					  .replace(/^(['"])(.*)\1$/, "$2") // remove '' or ""
					  .replace(/^url\((.*)\)/i, "$1") // handle url(some_rec)
					  .replace(/^(['"])(.*)\1$/, "$2") // remove any further quoting
					  .replace(/^\((.*)\)$/, "$1") // remove enclosing ()
					  .replace(/^\.\//, curr.pathname.slice(0, curr.pathname.lastIndexOf("/")) + "/") // relative path
					  .replace(/^\/\//, curr.proto + "//") // missing protocol
					  .replace(/^\//, curr.origin + "/") // missing domain + protocol
					  .replace(/(&amp;)|(&#38;)|(&#x00026;)/gi, "&") // unescape "&" from memorable and non-memorable entities
					  .replace(/&#x2f;/gi, "/") // unescape "/"
					  .split("#").shift() // remove fragment from urls
					  .trim();
				this.queue(e, nLayer, curr.base);
			});
		});
	}
	
	async main() {
		const options = this.options;
		let curr, hangTime = 0, cb_err = function(data) { this.tc--; }.bind(this);
		this.status = SOURSPIDER_RUNNING;
		this.emit("start");
		while(this.status !== SOURSPIDER_STOPPED) {
			while(this.tc < options.maxThreads && this.q.length > 0) {
				if(this.status !== SOURSPIDER_RUNNING) break; // status change
				hangTime = 0;
				if(this.pc < this.options.maxPages) {
					if(!(curr = this.q.pop())) continue; // bad target
					this.tc++; // start thread
					sourlib.req({url: curr.url, method: "GET", cb_ok: ((data) => {
						this.pc++; // add to page count
						this.scrape(data.r, curr);
						this.tc--; // end thread
					}).bind(this), cb_err: cb_err, timeout: options.reqTimeout});
					if(this.q.disorder > options.sortThreshold) {
						this.q.sort((a, b) => { return a.length - b.length; });
						this.q.disorder = 0;
					}
				} else if(this.tc === 0) { // Too many pages!
					this.emit("end", {errMsg: `Spider hit max pages! Exited with a queue of ${this.q.length} items.`})
					this.status = SOURSPIDER_STOPPED;
					return;
				}
				this.emit("progress");
				await sourlib.sleep(options.threadWait);
			}
			if(hangTime > options.spiderTimeout || (this.q.length === 0 && this.tc === 0)) break;
			while(this.status === SOURSPIDER_PAUSED) await sourlib.sleep(500);
			await sourlib.sleep(1000);
			hangTime += 1000; // track how long we've waited
		}
		if(this.status !== SOURSPIDER_STOPPED) this.emit("end"); // was this spider stopped, if so then don't emit "end" event
		this.status = SOURSPIDER_STOPPED;
	}
	
	// Queue method: Here, we parse and normalize urls, perform checks and add them to the queue.
	queue(url, layer=0, base=null, handOver=null) {
		const options = this.options, urlObj = handOver || sourlib.urlObj(url); // The only pre-proc we do; this is our URL normalization
		if(urlObj === null || this.h[(url = urlObj.href)]) return;
		this.h[url] = true; // Remember we've seen this (even if we fail during parse/queue)
		
		// Parse url into queue object
		const	o = urlObj.origin, p = urlObj.pathname, domain = o?.match(/[^\.]+\.[a-z]{2,}$/)?.[0], exti = p.indexOf(".");
		if(!o || !p || !domain) return;
		if(!this.d[domain]) this.d[domain] = {}; // register new domain
		const qObj = { url: url, base: base || domain, origin: o, pathname: p, layer: layer, domain: domain, proto: urlObj.protocol, ext: (exti === -1)? "" : p.slice(exti).toLowerCase() };
		this.emit("discover", {curr: qObj});
		
		// Actual queue method
		let _queue = (async () => {
		if(options.politeness > 0 && this.d[domain].robots.size > 0) { // check robots.txt if we should
			const robots = this.d[domain].robots, len = Math.max(robots.allow.length, robots.disallow.length);
			for(let itt = 0; itt < len; itt++) {
				if(!!robots.allow[itt]?.test?.(url)) break; // exit loop, we're allowed
				if(!!robots.disallow[itt]?.test?.(url)) return; // exit queue method, disallowed
			}
		}
		if(options.checkDirs && p.length > 1) { // queue parent dirs recursively
			const tp = p.replace(/\/$/, ''), tpr = tp.replace(/\/[^\/]+$/, ''), li = tp.lastIndexOf("/");
			if(tp.indexOf("/") !== -1 && !this.h[tpr]) {
				urlObj.search = "", urlObj.pathname = tpr; // prep handover
				this.queue(tpr, layer, base, urlObj);
			}
		}
		while(this.q.length >= options.queueMax) await sourlib.sleep(1000); 
		sourlib.req({url: qObj.url, method: "HEAD", cb_any: ((data) => { // send HEAD req to get info and then add to queue
			if(data.h["content-length"] && data.h["content-length"] > options.maxSize) return;
			const l = data.h["content-length"] || Infinity, ct = data.h["content-type"]?.split?.(";")?.[0], etag = { t: data.h["etag"] };
			if(options.useEtag && etag.t) { // Handle etag data and check for stuff we've seen
				if(this.h[etag.t]) return;
				this.h[etag.t] = true, etag.isWeak = etag.t.indexOf("W/") !== -1; // remember this etag and set it's strength
			}
			this.q.disorder++;
			this.emit("queue", {curr: qObj}); // queue callback
			this.q.push({...qObj, length: l, ct: ct, etag: etag });
		}).bind(this), timeout: Math.max(options.reqTimeout / 2, 2000), getHeaders: true });
		}).bind(this);
		
		if(layer > options.maxLayer || // max layer exceeded
			(options.isolate && base && base !== domain) || // off-domain on an isolated spider
			this.queuefilter.has(qObj.ext) // match in the queue filter 
		) return; 
		if(options.politeness > 0 && !this.d[qObj.domain].robots) { // If we should have robots.txt for this domain, then get it
			sourlib.req({url: `${qObj.proto}//${qObj.domain}/robots.txt`, method: "GET", cb_any: function(data) {
				this.d[qObj.domain].robots = SSpider.parseRobots((data.s == "200") ? data.r : "", options.politeness > 1, true);
				_queue();
			}.bind(this), timeout: options.reqTimeout });
		} else _queue();
	}
	
	hash(t) {
		if(!this._hash) return false;
		this._hash.update(t);
		const hv = this._hash.getHash("HEX");
		if(this.h[hv]) return true;
		this.h[hv] = true;
		return false;
	}
	
	emit(evk, data={}) {
		this.callbacks[evk]?.({
			curr: data.curr, // current queue object
			src: data.src,   // source of the current page
			errMsg: data.err // error message
		}, this.debug);
	}
	
	start() {
		if(this.status === SOURSPIDER_STOPPED) this.main();
		else this.status = SOURSPIDER_RUNNING;
	}
	
	pause() {
		this.emit("pause");
		this.status = SOURSPIDER_PAUSED;
	}
	
	stop() {
		this.status = SOURSPIDER_STOPPED;
	}
}
