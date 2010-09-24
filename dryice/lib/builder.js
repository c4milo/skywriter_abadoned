"use strict";
var path 	= require('path'),
	fs 		= require('fs'),
	util 	= require('./util'),
	sys		= require('sys'),
	config 	= require('./config');

var Builder = exports.Builder = function Builder(plugins) {	
	this.plugins = plugins;
};

Builder.prototype.getPluginMetadata = function(location) {
	if(fs.statSync(location).isDirectory()) {
		location += '/package.json';
		return JSON.parse(fs.readFileSync(location, 'utf8'));
	}
	
	var jsFile = fs.readFileSync(location, 'utf8');
	jsFile = jsFile.replace(/\n/g, "");
	
	var match = jsFile.match(/.*"define metadata";\((.*)\);?"end/);
	if(match) {
		return JSON.parse(match[1]);
	}
	
	throw new Error('Plugin metadata not found in: ' + location);
};
 
Builder.prototype.searchPlugin = function(plugin) {
	var paths = config.plugins_path;
	var location; 
	
	for(p in paths) {
		location = paths[p] + '/' + plugin;
		
		if(path.existsSync(location)) {
			return location;
		}
		
		location = location + '.js';
		
		if(path.existsSync(location)) {
			 return location;
		}
	}
	
	throw new Error('Plugin not found: ' + plugin);
};

/*
Source: kdangoor (irc chat)
the other way that a package ends up in BespinEmbedded is if it's depended on by packages in both main and worker
for example, standard_syntax runs in the worker and depends on underscore
other plugins also depend on underscore
so underscore gets moved into BespinEmbedded


it looks like dryice is doing something like this:
start off with the list of plugins provided by the user
find the ones marked as worker plugins, add to the worker list
(remove from the main plugin list if it doesn't also have the main environment)
then look at the set of plugins that are both in main and worker, and call that the shared set
(oops… before that step is: augment the plugin lists with the dependencies)
almost all of it happens in _set_package_lists, with the exception of identifying the worker plugins */

var all = {};
Builder.prototype._resolveDependencies = function(plugins) {		
	for(name in plugins) {
		console.log('trying to add '+ name);
		if(all[name]) {
			console.log(name + ' is already added');
			return;
		}
		
		var location = this.searchPlugin(name);
		var metadata = this.getPluginMetadata(location);

		metadata.name = name;
		metadata.location = location;

		var dependencies = metadata.dependencies; 
		if(dependencies) {
			console.log('Resolving dependencies for ' + name);
			this._resolveDependencies(dependencies);			
		}
		console.log(metadata.name + ' resolved');
		all[name] = metadata;
	}
};

Builder.prototype.build = function(outputDir) {
	if(path.existsSync(outputDir)) {
		util.rmtree(outputDir);
	}
	util.mkpath(outputDir);
	
	var files = config.embedded.files;
	var loader = config.embedded.loader;
	var preamble = config.embedded.preamble;
	var boot = config.embedded.boot;
	var script2loader = config.embedded.script2loader;

	this._resolveDependencies(this.plugins); 
	var plugins = all;

	var worker = {};
	var shared = {};
	var main = {};	

	for(name in plugins) {
		var metadata = plugins[name];
		
		var env = metadata.environments;
		if(!env) {
			console.log(name +' does not has environments defined ');
			continue;
		}
		var isWorker = env.worker;
		var isMain = env.main;

		if(isWorker && isMain) {
			shared[name] = metadata;
		} else if(isWorker) {
			worker[name] = metadata;
		} else if(isMain) {
			main[name] = metadata;
		}
		console.log('\n ' + name + '\n');
	}
};

