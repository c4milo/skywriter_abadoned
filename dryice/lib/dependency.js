"use strict";
var http = require('http'),
	fs 	 = require('fs'),
	path = require('path');

var config = require('./config');

var Dependency = exports.Dependency = function() {

};

Dependency.prototype._install = function(name, data) {
	fs.writeFile(config.dependencies[name].install_to, data, function(err) {
		if(err) {
			throw err;
		}
	});
};

Dependency.prototype.installJQuery = function(name, data) {
	data = '"define metadata";({});"end";\n' + data;
	data += 'exports.$ = $.noConflict(true);';
	this._install(name, data);
};

Dependency.prototype.installTiki = function(name, data) {
	//TODO
	this._install(name, data);
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
			} else if(depname == 'tiki') {
				self.installTiki(depname, data);
			} else {
				self._install(depname, data);
			}
		});
	});
};

Dependency.prototype.install = function() {
	var deps = config.dependencies;
	for(name in deps) {
		this._get(name, deps[name].host, deps[name].uri)
	}
};