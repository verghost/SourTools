'use_strict';

var tutils = {
	
	// https://github.com/noobfromvn/hackbar/blob/master/hackbar/js/hackbar-panel.js
	url : {
		encode: function(t) {
			var uric = encodeURIComponent(t);
			uric = uric.replace(/\*/g, '%2A');
			uric = uric.replace(/\//g, '%2F');
			uric = uric.replace(/\+/g, '%2B');
			uric = uric.replace(/\'/g, '%27');
			return uric;
		},
		decode: function(t) {
			return unescape(t);
		}
	},
	
	// Nice compact code thanks to https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
	b64 : {
		encode: function(t) {
			// first we use encodeURIComponent to get percent-encoded UTF-8,
			// then we convert the percent encodings into raw bytes which can be fed into btoa.
			try {
				return btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, // matches %-encoded byte globally
					function toSolidBytes(match, p1) {
						return String.fromCharCode('0x' + p1);
				}));
			} catch(e) {
				return `ERROR: ${e}`;
			}
		},
		decode: function(tb64) {
			// Going backwards: from bytestream, to percent-encoding, to original string.
			try {
				return decodeURIComponent(atob(tb64).split('').map(function(c) {
					return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
				}).join(''));
			} catch(e) {
				return `Not valid base64!`;
			}
		}
	},
	
	// https://github.com/noobfromvn/hackbar/blob/master/hackbar/js/Encrypt.js
	r13 : function(t) {
		return t.replace(/[a-zA-Z]/g, function( c ) {
			return String.fromCharCode( ( c <= "Z" ? 90 : 122) >= ( c = c.charCodeAt( 0 ) + 13 ) ? c : c - 26 );
		});
	},
	
	// Using blueimp md5 implementation https://github.com/blueimp/JavaScript-MD5
	md5: function(t) {
		return md5(t);
	},
	
	// https://caligatio.github.io/jsSHA/
	sha: function(t, mode) {
		var type = "";
		switch(mode) {
			case '1':
				type = 'SHA-1';
				break;
			case '256':
				type = 'SHA-256';
				break;
			case '384':
				type = 'SHA-384';
				break;
			case '512':
				type = 'SHA-512';
				break;
			default:
				break;
		}
		var shaObj = new jsSHA(type, "TEXT");
		shaObj.update(t);
		return shaObj.getHash("HEX");
	},
	
	// https://github.com/noobfromvn/hackbar/blob/master/hackbar/js/XSS.js 
	xss : {
		encode: function(t, mode) {
			var charStringArray = [];
			for (let c = 0; c < t.length; c++) {
				charStringArray.push(t.charCodeAt(c));
			}

			var charString = '';

			switch(mode) {
				case "sfcc":
					charString = 'String.fromCharCode(' + charStringArray.join(', ') + ')';
					break;
				case "html":
					charString = '&#' + charStringArray.join(';&#') + ';';
					break;
			}
			return charString;
		}
	},
	
	// https://github.com/noobfromvn/hackbar/blob/master/hackbar/js/SQL.js 
	sqlic: function(t, engine) {
		var charStringArray = [];
		for (let c = 0; c < t.length; c++) {
			charStringArray.push(t.charCodeAt(c));
		}
		
		var charString = '';
		
		switch (engine) {
			case "mysql":
				charString = 'CHAR(' + charStringArray.join(', ') + ')';
				break;
			case "mssql":
				charString = ' CHAR(' + charStringArray.join(') + CHAR(') + ')';
				break;
			case "oracle":
				charString = ' CHR(' + charStringArray.join(') || CHR(') + ')';
				break;
		}
		return charString;
	},
	
	// https://github.com/beautify-web/js-beautify
	beautify: {	
		js: function(t) {
			return js_beautify(t);
		},
		css: function(t) {
			return css_beautify(t);
		}
	},
	
	// https://github.com/noobfromvn/hackbar/blob/master/hackbar/js/MISC.js 
	rvrs: function (t) {
        return t.split("").reverse().join("");
    },
	
	wsrmv: function(t) {
		return t.replace(/\s/g,'');
	}
	
	// TODO: JS Compress
};

////////////////////////////////////////////////////////////////
// Page code
////////////////////////////////////////////////////////////////
function handleDropdown(id, icon){
	var btns = document.getElementById(id.slice(0, id.indexOf("-icon")) + '-btns');
	if(!btns) return;
	if(btns.style.display == 'none'){
		btns.style.display = 'block';
		icon.innerText = '🔼';
	}else{
		btns.style.display = 'none';
		icon.innerText = '🔽';
	}
}

function c(e){
	var textInput = document.getElementById("input").value;
	var textOutput = "";
	var elemId = e.srcElement.id;
	
	if(elemId.indexOf("-icon") != -1) handleDropdown(elemId, document.getElementById(elemId));
	
	if(textInput == "") return;
	
	// Handle button presses
	switch(e.srcElement.id) {
		case 'btn-e-url':
			textOutput = tutils.url.encode(textInput);
			break;
		case 'btn-d-url':
			textOutput = tutils.url.decode(textInput);
			break;
		case 'btn-e-b64':
			textOutput = tutils.b64.encode(textInput);
			break;
		case 'btn-d-b64':
			textOutput = tutils.b64.decode(textInput);
			break;
		case 'btn-e-r13':
			textOutput = tutils.r13(textInput);
			break;
		case 'btn-e-md5':
			textOutput = tutils.md5(textInput);
			break;
		case 'btn-e-sha1':
			textOutput = tutils.sha(textInput, '1');
			break;
		case 'btn-e-sha256':
			textOutput = tutils.sha(textInput, '256');
			break;
		case 'btn-e-sha384':
			textOutput = tutils.sha(textInput, '384');
			break;
		case 'btn-e-sha512':
			textOutput = tutils.sha(textInput, '512');
			break;
		case 'btn-e-xss-sfcc':
			textOutput = tutils.xss.encode(textInput, 'sfcc');
			break;
		case 'btn-e-xss-html':
			textOutput = tutils.xss.encode(textInput, 'html');
			break;
		case 'btn-sqlic-mysql':
			textOutput = tutils.sqlic(textInput, "mysql");
			break;
		case 'btn-sqlic-oracle':
			textOutput = tutils.sqlic(textInput, "oracle");
			break;
		case 'btn-sqlic-mssql':
			textOutput = tutils.sqlic(textInput, "mssql");
			break;
		case 'btn-beautify-js':
			textOutput = tutils.beautify.js(textInput);
			break;
		case 'btn-beautify-css':
			textOutput = tutils.beautify.css(textInput);
			break;
		case 'btn-wsrmv':
			textOutput = tutils.wsrmv(textInput);
			break;
		case 'btn-rvrs':
			textOutput = tutils.rvrs(textInput);
			break;
		default:
			break;
	}
	if(textOutput == ""){
		// error?
	}else{
		document.getElementById("output").value = textOutput;
	}
}

window.onload = function(){
	document.getElementById("btn-back").href = browser.runtime.getURL("/html/home.html");
}

document.addEventListener("click", c);