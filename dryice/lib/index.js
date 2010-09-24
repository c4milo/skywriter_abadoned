"use strict";
/*require.paths.unshift(  '../../platform/common/plugins/boot',
                        '../../platform/common/plugins/supported');*/
var exports = module.exports;

var Platform = require('./platform').Platform;
var Dependency = require('./dependency').Dependency;

exports.platform = new Platform();
exports.dependency = new Dependency();

exports.config = require('./config');

