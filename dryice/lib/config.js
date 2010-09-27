"use strict";

var config = exports;

var version = {	number: '0.9a2',
				name: 'Edison',
                api: 4
			};

var embedded = {	files: {
						shared: 'SkywriterEmbedded.js', 
						main: 'SkywriterMain.js',
						worker: 'SkywriterWorker.js',
						css: 'SkywriterEmbedded.css'
					}, 
					
					boot: 'dryice/assets/boot.js',
					preamble: 'dryice/assets/preamble.js',
					script2loader: 'dryice/assets/script2loader.js',
					tiki_template: 'dryice/assets/tiki_template.js',
					
					loader: 'platform/embedded/static/tiki.js',
					worker: 'platform/embedded/static/worker.js'
				};
								
var plugins_path = {	supported: 'platform/browser/plugins/supported', 
						thirdparty: 'platform/browser/plugins/thirdparty', 
						labs: 'platform/browser/plugins/labs', 
						boot: 'platform/browser/plugins/boot' 
					};
					
var dependencies = {	jquery: {   host: 'code.jquery.com', uri: '/jquery-1.4.2.js', 
                                    install_to: 'platform/browser/plugins/thirdparty/jquery.js'},
                        tiki_preamble:  {   host: 'github.com', uri: '/pcwalton/tiki/raw/master/__preamble__.js', 
                                            install_to: 'platform/embedded/static/tiki.js'},
						tiki_postamble: {   host: 'github.com', uri: '/pcwalton/tiki/raw/master/__postamble__.js', 
                                            install_to: 'platform/embedded/static/tiki.js'},
                        tiki:           {   host: 'github.com', uri: '/pcwalton/tiki/raw/master/lib/tiki.js', 
                                            install_to: 'platform/embedded/static/tiki.js'}
					};

config.version = version;
config.embedded = embedded;
config.plugins_path = plugins_path;
config.dependencies = dependencies;


