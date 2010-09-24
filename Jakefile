var http = require('http'),
	fs = require('fs');

var dryice 		= require('./dryice'),
	platform    = dryice.platform,
	test        = dryice.Test,
	doc         = dryice.Doc,
	config 		= dryice.config,
	dependency 	= dryice.dependency; // Personally I don't like to have 'dependency', but I prefer not to write this logic in the Jakefile 

desc('Launch skywriter in the default browser');
task('default', [], function (params) {
    platform.launch('browser');
});

desc('Run tests');
task('test', [], function (params) {
    test.run();
});

desc('Display the documentation in your web browser');
task('doc', [], function (params) {
    doc.display();
});

desc('Generate API documentation');
task('jsdoc', [], function (params) {
    doc.generateAPI();
});

/*desc('Generates tags for Skywriter using jsctags');
task('tags', [], function (params) {
    platform.generateTags();
});*/

namespace('dist', function () {
    desc('Generate distributable packages for all platforms');
    task('all', ['deps:install'], function (params) {
        platform.dist(arguments[0]);
    });

    desc('Generate browser distributable package');
    task('browser', ['deps:install'], function () {
        platform.dist('browser', arguments[0]);
    });

    desc('Generate desktop distributable package');
    task('desktop', ['deps:install'], function () {
        platform.dist('xulrunner', arguments[0]);
    });

    desc('Generate bookmarklet distributable package');
    task('bookmarklet', ['deps:install'], function () {
        platform.dist('bookmarklet', arguments[0]);
    });

    desc('Generate embedded distributable package');
    task('embedded', ['deps:install'], function () {
        platform.dist('embedded', arguments[0]);
    });
});

namespace('deps', function() {
	desc('Install dependencies');
	task('install', [], function() {
		dependency.install();
	});
});
