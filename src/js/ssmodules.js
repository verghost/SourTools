const ssModules = { // Default modules for spider.
"DOM-XSS": { 
	description: "Detects (potential) DOM-based XSS using the methodology outlined here: http://www.webappsec.org/projects/articles/071105.shtml.",
	options: {}, callbacks: {
		scrape: function(data, out) { 
			let msg = [],
				 jfp = [	/document\.write\s*\(.*\)/g, /document\.writeln\s*\(.*\)/g,	/document\.execCommand\s*\(.*\)/g, /document\.\s*\(.*\)/g, /document\.open\s*\(.*\)/g,	/window\.open\s*\(.*\)/g, /eval\s*\(.*\)/g, /window\.execScript\s*\(.*\)/g	], 
				 jcp = [ /document\.URL/, /document\.documentURI/, /document\.URLUnencoded/, /document\.baseURI/, /document\.referrer/, /location/ ];
			for(let i in jfp) {
				let fmi = data.src.matchAll(jfp[i]), temp;
				while((temp = fmi.next().value)) {
					for(let j in jcp) {
						let fc = temp[0].match(jcp[j]);
						if(fc !== null) msg.push(`\n'${fc[0]}' @ ${temp.index}\n`);
					}
				}
			}
			if(msg.length > 0) {
				out(`ON ${data.curr.url}\n----`);
				msg.forEach((m) => { out(m); });
				out(`----\n`);
			}
		}
	}, iq: ["HOST;WP"]
},
"Mailman": {
	description: "Searches for email addresses using regex; additional info here: https://www.regular-expressions.info/email.html.",
	options: { maxLayer: 1 }, callbacks: {
		scrape: function(data, out) {
			out(data.curr.ext);
			let m = data.src.match(/[a-z0-9!#$%&'*+/=?^_‘{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_‘{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/g); 
			if(m !== null && m.length > 0) {
				out(m.join("\n"));
			}
		}
	}, iq: ["HOST;WP"]
},
"Dircheck": {
	description: "Searches for indexable directories (directory listings) by checking for the classic \"Index of\" title tag.",
	options: { maxLayer: 1, checkDirs: true }, callbacks: {
		scrape: function(data, out) { if(data.src.match(/<title>\s*?Index of/) !== null) { out(data.curr.url); } }
	}, iq: ["HOST;WP"]
},
"FileFinder": {
	description: "Finds files by filtering file extensions (i.e. doc, cpp, exe, zip, etc...)",
	options: { maxLayer: 2 }, callbacks: {
		discover: function(data, out) { if(!webpages.has(data.curr.ext) && fileSet.has(data.curr.ext)) out(`${data.curr.url}`); }
	}, iq: ["HOST;WP"]
},
"MediaFinder": {
	description: "Finds media by filtering file extensions (i.e. mp3, mp4, jpg, png, etc...).",
	options: { maxLayer: 2 }, callbacks: {
		discover: function(data, out) { if(!webpages.has(data.curr.ext) && mediaSet.has(data.curr.ext)) out(`${data.curr.url}`); }
	}, iq: ["HOST;WP"]
},
"KeyFinder": {
	description: "Finds keys/secrets and random data.",
	options: { maxLayer: 1, maxPages: 100 }, callbacks: {
		scrape: function(data, out) {
			const CHUNK_THRESHOLD = 32;
			const ENTROPY_THRESHOLD = 3.0;

			// Util functions
			let makergx = (s) => { return new RegExp(s.replace(/[-\[\].*+?^${}()|\\]/g, '\\$&'), 'g'); };
			let count = (str, s) => { return (str.match(makergx(s)) || []).length; };
			
			// Shannon entropy
			let H = (b) => {
				if(!b) return 0;
				let entropy = 0;
				let seen = {};
				b.split("").forEach(c => {
					if(seen[c]) return;
					seen[c] = true;
					let p_x = count(b, c) / b.length;
					entropy -= p_x * Math.log(p_x, 2)
				});
				return entropy;
			};
			
			// Chunky entropy scan (asynchornous so that we don't always stall the spider)
			async function entropy_chunks(d) {
				let outp = "";
				let chunks = d.match(/['|"]([0-9a-zA-Z-._{}$\/\+=]{32,})['|"]/g) || [];
			   for(let i = 0; i < chunks.length; i++) {
					let ch = chunks[i].replace(/\s/g, '');
					if(ch.length < CHUNK_THRESHOLD) continue;
					let e = H(ch);
					if(e < ENTROPY_THRESHOLD) continue;
					outp += `[KF-E] ${ch}\n`;
					//await sourlib.sleep(0.01);
				}
				out(outp);
			};
			
			// First, the entropy checkDirs
			entropy_chunks(data.src);
			
			// Next, the regex
			[ // all courtesy of gitleaks (https://github.com/zricethezav/gitleaks/blob/2acc34dfdf/config/default.go)
				{ r: `(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}`, d: "AWS Manager ID" },
				{ r: `[aA][wW][sS](.{0,20})?['\"][0-9a-zA-Z\/+]{40}['\"]`, d: "AWS MWS Secret Key" },
				{ r: `amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`, d: "AWS MWS Key" },
				{ r: `([fF][aA][cC][eE][bB][oO]{2}[kK]|[fF][bB])(.{0,20})?['\"][0-9a-f]{32}['\"]`, d: "Facebook Secret Key" },
				{ r: `([fF][aA][cC][eE][bB][oO]{2}[kK]|[fF][bB])(.{0,20})?['\"][0-9]{13,17}['\"]`, d: "Facebook Client ID" },
				{ r: `[tT][wW][iI][tT]{2}[eE][rR](.{0,20})?[0-9a-z]{35,44}`, d: "Twitter Secret Key" },
				{ r: `[tT][wW][iI][tT]{2}[eE][rR](.{0,20})?[0-9a-z]{18,25}`, d: "Twitter Client ID" },
				{ r: `[gG][iI][tT][hH][uU][bB](.{0,20})?[0-9a-zA-Z]{35,40}`, d: "Github" },
				{ r: `[lL][iI][nN][kK][eE][dD][iI][nN](.{0,20})?[0-9a-zA-Z]{12}`, d: "Linkedin Client ID" },
				{ r: `[lL][iI][nN][kK][eE][dD][iI][nN](.{0,20})?[0-9a-zA-Z]{16}`, d: "Linkedin Secret Key" },
				{ r: `xox[baprs]-([0-9a-zA-Z]{10,48})?`, d: "Slack" },
				{ r: `-----BEGIN ((EC|PGP|DSA|RSA|OPENSSH) )?PRIVATE KEY( BLOCK)?-----`, d: "Asymmetric Private Key" },
				{ r: `AIza[0-9A-Za-z\\-_]{35}`, d: "Google API key" },
				{ r: `"type": "service_account"`, d: "Google (GCP) Service Account" },
				{ r: `[hH][eE][rR][oO][kK][uU](.{0,20})?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`, d: "Heroku API key" },
				{ r: `([mM][aA][iI][lL][cC][hH][iI][mM][pP]|[mM][cC])(.{0,20})?[0-9a-fA-F]{32}-us[0-9]{1,2}`, d: "MailChimp API key" },
				{ r: `(([mM][aA][iI][lL][cC][hH][iI][mM][pP]|[mM][cC])(.{0,20})?)?key-[0-9a-zA-Z]{32}`, d: "Mailgun API key" },
				{ r: `access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}`, d: "PayPal Braintree access token" },
				{ r: `sk_live_[0-9a-z]{32}`, d: "Picatic API key" },
				{ r: `SG\.[\w_]{16,32}\.[\w_]{16,64}`, d: "SendGrid API Key" },
				{ r: `https://hooks.slack.com/services/T[a-zA-Z0-9_]{8}/B[a-zA-Z0-9_]{8}/[a-zA-Z0-9_]{24}`, d: "Slack Webhook" },
				{ r: `[sS][tT][rR][iI][pP][eE](.{0,20})?[sSrR]k_live_[0-9a-zA-Z]{24}`, d: "Stripe API key" },
				{ r: `sq0atp-[0-9A-Za-z\-_]{22}`, d: "Square access token" },
				{ r: `sq0csp-[0-9A-Za-z\\-_]{43}`, d: "Square OAuth secret" },
				{ r: `[tT][wW][iI][lL][iI][oO](.{0,20})?[sS][kK][0-9a-fA-F]{32}`, d: "Twilio API key" }
			].forEach(ro => {
				let rmatch = data.src.match(makergx(ro.r));
				if(rmatch) {
					out(`[KF-R] ${ro.d}:\n->${rmatch.join("\n->")}`);
				}
			});
		}
	}, iq: ["HOST;WP"]
}
};
if(SOURTOOLS_DEBUG) { // add the debug module
	ssModules.Debug = {
		options: { maxLayer: 1 },
		callbacks: { 
			start: (data, out) => { out("debug module started...") },
			discover: (data, out) => { out(`discover: ${data.curr.url}`); },
			queue: (data, out) => { out(`queue: ${data.curr.url}`); },
			scrape: (data, out) => { out(`scrape: ${data.curr.url}`); }
		},
		iq: ["HOST;WP"]
	};
}