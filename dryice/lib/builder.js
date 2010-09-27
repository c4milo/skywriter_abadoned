"use strict";
var path    = require('path'),
	fs      = require('fs'),
	util    = require('./util'),
	sys     = require('sys'),
	config  = require('./config');

var Builder = exports.Builder = function Builder(manifest) {
    this.manifest = manifest;	
	this.plugins = manifest.plugins; //TODO include skywriter plugin which is the boot
	this.all = {};
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
	
	for(var p in paths) {
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

Builder.prototype._resolveDependencies = function(plugins) {
	var all = this.all;		
	
	for(var name in plugins) {
		if(all[name]) {
			continue;
		}

		var location = this.searchPlugin(name);
		var metadata = this.getPluginMetadata(location);

		metadata.name = name;
		metadata.location = location;

		var dependencies = metadata.dependencies; 
		if(dependencies) {
			this._resolveDependencies(dependencies);			
		}

		all[name] = metadata;
	}
};

Builder.prototype.build = function(outputDir) {
    var all = this.all;

	if(path.existsSync(outputDir)) {
		util.rmtree(outputDir);
	}
	util.mkpath(outputDir);
	
	this._resolveDependencies(this.plugins); 

    //just for embedded releases, most of the times, people do not want to include jquery.
    //Therefore, by default, we are going to include it always; 
    //unless people explicitly specify, in the manifest, that they do not want to include it.
     
	var includeJQuery = this.manifest.include_jquery;	
	if(includeJQuery === false) {
	    var location = this.searchPlugin('globaljquery');
	    var md = this.getPluginMetadata(location);
	    
	    md.name = 'jquery'; 
	    md.location = location;
	    
	    all[md.name] = md;
	}
    
    //Let's call packages either main, shared or worker plugins.
    //packaging
	var worker = {};
	var shared = {};
	var main = {};	

	for(var name in all) {
		var metadata = all[name];
	    
		var env = metadata.environments;
	    if(!env) {
			main[name] = metadata;
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
	}
	
	this._writeFiles(outputDir, main, shared, worker);
};

Builder.prototype._writeFiles = function(outputDir, main, shared, worker) {
    var files = config.embedded.files;
	var loaderFile = config.embedded.loader;
	var preambleFile = config.embedded.preamble;
	var bootFile = config.embedded.boot;
	var script2loaderFile = config.embedded.script2loader;

    var sharedFile = outputDir + '/' + files.shared;
    var mainFile = outputDir + '/' + files.main;
    var workerFile = outputDir + '/' + files.worker;
    
    //Combine plugins into every package. 
    //This process also wraps each plugin to register it with the module system
    //and writes the package metadata, which is the same
    //plugin metadata but with all dependencies together.
    
    for(var p in shared) {
        console.log('shared '+ p);
    }
     
    var sharedPackage = this._combineJsFiles(shared);
    var workerPackage = this._combineJsFiles(worker);
    var mainPackage = this._combineJsFiles(main);

    //package postprocessing
    //shared
    var preamble = fs.readFileSync(preambleFile, 'utf8');
    var loader = fs.readFileSync(loaderFile, 'utf8');
    var script2loader = fs.readFileSync(script2loaderFile, 'utf8'); 
    
    var sharedMetadata = "skywriter.tiki.require('skywriter:plugins').catalog.registerMetadata("+JSON.stringify(shared)+");";
    
    sharedPackage = preamble + loader + sharedPackage + sharedMetadata + script2loader;

    fs.writeFileSync(sharedFile, sharedPackage, 'utf8');

    //main
    
    
    //worker
    
};

Builder.prototype._combineJsFiles = function(package) {
    var data = '';

    for(var name in package) {
        var plugin = package[name];
        var location = plugin.location;
        
        data += "\n;bespin.tiki.register('::" + name + "', " +
                    "{'name': " + name + ", " +
                    "'dependencies': " + JSON.stringify(plugin.dependencies || {}) + 
                "});";
        
        //Hack so that web workers can determine whether they need to load the boot
        //plugin metadata.
        if(name === 'skywriter') {
            //ask in #skywriter if this line can be moved to index.js or some js in plugins/boot/skywriter
            data += ' skywriter.bootLoaded = true;'; 
        }

        var files;
        if(fs.statSync(location).isDirectory()) {
            files = util.walkfiles(location, '.js$');
        } else {
            files = [location];
            name = 'index';
        }
        
        for(var file in files) {
            if(!this.manifest.include_test &&
                files[file].match('tests')) {
                continue;
            }
            var pluginFile = files[file];

            if(path.extname(pluginFile) === '.js') {
                data += "\n skywriter.tiki.module('" + name + ":" + path.basename(pluginFile, '.js') + "', " + 
                        "function(require, exports, module) { \n" +
                            fs.readFileSync(pluginFile, 'utf8') + 
                        "});";                
            }
        }
    }
    
    return data;
};

