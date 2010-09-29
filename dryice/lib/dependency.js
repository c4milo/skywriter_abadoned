"use strict";
var http    = require('http'),
    fs      = require('fs'),
    path    = require('path');

var config = require('./config');

//FIXME dyrice is trying to use tiki before the download is complete.
// So we need implement message passing using EventEmitter or Promises. 

var Dependency = exports.Dependency = function() {
    this.tiki = '';
    this.tikiComponents = 3;
    this.tikiComponentsDownloaded = 0;
    this.tikiPreamble = '';
    this.tikiPostamble = '';
};

Dependency.prototype._install = function(name, data) {
    fs.writeFileSync(config.dependencies[name].install_to, data);
    console.log('[Dependency] '+ name + ' installed in ' + config.dependencies[name].install_to);
};

Dependency.prototype.installJQuery = function(name, data) {
	data = '"define metadata";({});"end";\n' + data;
	data += 'exports.$ = $.noConflict(true);';
	this._install(name, data);
};


Dependency.prototype.installTiki = function(name, data) {
    if(name == 'tiki_preamble') {
        this.tikiPreamble = data;
    } else if(name == 'tiki_postamble') {
        this.tikiPostamble = data;
    } else {
        this.tiki = data;
    }
    
	this.tikiComponentsDownloaded++;
	
	if(this.tikiComponentsDownloaded === this.tikiComponents) {
	    var template = fs.readFileSync(config.embedded.tiki_template, 'utf8');
        
        template = template.replace('TIKI_PREAMBLE', this.tikiPreamble);
        template = template.replace(/TIKI_PACKAGE_ID/g, '::tiki/1.0.0');
        template = template.replace('TIKI_VERSION', '1.0.0');
        template = template.replace('TIKI_BODY', this.tiki);
        template = template.replace('TIKI_POSTAMBLE', this.tikiPostamble);
	    
	    this._install('tiki', template);	    
	}
};

Dependency.prototype._get = function(depname, host, uri) {
	var self = this;
	var file = http.createClient(80, host);
	var request = file.request('GET', uri, {'host': host});
	request.end();

	var data = '';
	request.on('response', function(response) {
		response.setEncoding('utf8');
		
		response.on('data', function(chunk) {
			data += chunk;
		});
		
		response.on('end', function(){
			if(depname == 'jquery') {
				self.installJQuery(depname, data);
			} else if(depname.match('tiki')) {
				self.installTiki(depname, data);
			} else {
				self._install(depname, data);
			}
		});
	});
};

Dependency.prototype.install = function() {
	var deps = config.dependencies;
	for(var name in deps) {
        if(!path.existsSync(deps[name].install_to)) {
            console.log('[Dependency] Downloading ' + name + '...');
		    this._get(name, deps[name].host, deps[name].uri);
	    } else {
	        console.log('[Dependency] ' + name + ' already exists. Skipping');
	    }
	}
};