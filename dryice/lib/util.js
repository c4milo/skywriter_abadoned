"use strict";
var fs = require('fs');
var sys = require('sys');
var path = require('path');

var util = exports;

util.mkpath = function(_path) {
	var dirs = _path.split('/');
	var d = './';
	
	for(dir in dirs) {
		d += dirs[dir] + '/';
		
		if(!path.existsSync(d)) {
			fs.mkdirSync(d, 0755);
		}
	}
}

util.copy = function(src, dst, callback) {
	//if src is directory throw Error
	//if dst is inside src throw Error
	var reader = fs.createReadStream(src);
    var writer = fs.createWriteStream(dst);
	sys.pump(reader, writer, callback);
}

util.copy_r = function(src, dst) {
	
}