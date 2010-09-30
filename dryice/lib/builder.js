"use strict";
var path    = require('path'),
	fs      = require('fs'),
	util    = require('./util'),
	sys     = require('sys'),
	config  = require('./config');

var Builder = exports.Builder = function Builder(manifest) {
    this.manifest = manifest;	
	this.plugins = manifest.plugins;
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
    var cssFile = outputDir + '/' + files.css;
    
    //Combine plugins into every package. 
    //This process also wraps each plugin to register it with the module system
    //and writes the package metadata, which is the same
    //plugin metadata but with all dependencies together.
    var sharedPackage = this._combineFiles(shared);
    var workerPackage = this._combineFiles(worker);
    var mainPackage = this._combineFiles(main);

    //package postprocessing
    //shared
    var preamble = fs.readFileSync(preambleFile, 'utf8');
    var loader = fs.readFileSync(loaderFile, 'utf8');
    var script2loader = fs.readFileSync(script2loaderFile, 'utf8'); 
    
    var tikiPackage = fs.readFileSync(config.embedded.tiki_package, 'utf8');
    var sharedMetadata = tikiPackage.replace(/PACKAGE_NAME/, 'skywriter:plugins');
    sharedMetadata = sharedMetadata.replace(/PACKAGE_METADATA_OBJECT/, JSON.stringify(shared));
    
    sharedPackage.js = preamble + loader + sharedPackage.js + sharedMetadata + script2loader;
    
    fs.writeFileSync(sharedFile, sharedPackage.js, 'utf8');

    //combining CSS data
    var sharedCss = sharedPackage.css || '';
    var workerCss = workerPackage.css || '';
    var mainCss = mainPackage.css || '';
    
    fs.writeFileSync(cssFile, sharedCss + workerCss + mainCss);

    //main
    
    
    //worker
    
};

Builder.prototype._combineFiles = function(package) {
    var tikiModule = fs.readFileSync(config.embedded.tiki_module, 'utf8');
    var tikiRegister = fs.readFileSync(config.embedded.tiki_register, 'utf8');
    var templaterWrap = fs.readFileSync(config.embedded.templater_wrap, 'utf8');
    var combinedJs = '';
    var combinedCss = '';
    
    for(var name in package) {
        var combinedHtml = {};
        var plugin = package[name];
        var location = plugin.location;
        
        var register = tikiRegister.replace(/PLUGIN_NAME/g, name);
        register = register.replace(/PLUGIN_DEPS_OBJECT/, JSON.stringify(plugin.dependencies || {}));
        combinedJs += register;
        
        //Hack so that web workers can determine whether they need to load the boot
        //plugin metadata.
        if(name === 'skywriter') {
            //ask in #skywriter if this line can be moved to index.js or some js in plugins/boot/skywriter
            combinedJs += 'skywriter.bootLoaded = true;\n'; 
        }

        var files;
        if(fs.statSync(location).isDirectory()) {
            files = util.walkfiles(location, '\.(js|css|htmlt)$');
        } else {
            files = [location];
        }

        for(var file in files) {
            if(!this.manifest.include_test &&
                files[file].match('tests')) {
                continue;
            }
            
            var pluginFile = files[file];
            
            switch(path.extname(pluginFile)) {
              case '.js':
                var match = pluginFile.match(name+'/(?!.*'+name+')(.+)\.js');
                var modulePath = 'index';
                if(match) {
                    modulePath = match[1];
                }
                
                var module = tikiModule.replace(/PLUGIN_NAME/g, name);
                module = module.replace(/PLUGIN_MODULE/g, modulePath);
                module = module.replace(/PLUGIN_BODY/, fs.readFileSync(pluginFile, 'utf8'));
                combinedJs += module;
                break;
              
              case '.css':
                combinedCss += fs.readFileSync(pluginFile, 'utf8');
                break;
                
              case '.htmlt':
                combinedHtml[path.basename(pluginFile)] = fs.readFileSync(pluginFile, 'utf8');
                break;
            }
        }
        
        if(Object.keys(combinedHtml).length) {
            combinedJs += templaterWrap.replace(/TEMPLATES_OBJ/, JSON.stringify(combinedHtml));            
        }

        combinedCss = combinedCss.replace(/url\('?(.+)images\/(.+)'?\)/, "url('resources/"+name+"/$1/images/$2')");        
    }
    
    return {js: combinedJs, css: combinedCss};
};

