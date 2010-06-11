/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is
 * Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// This module depends only on Tiki.

bespin.useBespin = function(element, options) {
    var util = bespin.tiki.require('bespin:util/util');

    var baseConfig = %s;
    var baseSettings = baseConfig.settings;
    options = options || {};
    for (var key in options) {
        baseConfig[key] = options[key];
    }
    
    // we need to separately merge the configured settings
    var configSettings = baseConfig.settings;
    if (baseSettings !== undefined) {
        for (key in baseSettings) {
            if (configSettings[key] === undefined) {
                baseConfig.settings[key] = baseSettings[key];
            }
        }
    }

    var Promise = bespin.tiki.require('bespin:promise').Promise;
    var pr = new Promise();

    bespin.tiki.require.ensurePackage("::appconfig", function() {
        var appconfig = bespin.tiki.require("appconfig");
        if (util.isString(element)) {
            baseConfig.element = document.getElementById(element);
        } else {
            baseConfig.element = element;
        }

        if (util.none(baseConfig.initialContent)) {
            baseConfig.initialContent = baseConfig.element.innerHTML;
        }

        baseConfig.element.innerHTML = '';

        appconfig.launch(baseConfig).then(function(result) {
            pr.resolve(result);
        });
    });

    return pr;
};

document.addEventListener("DOMContentLoaded", function() {
    // Holds the lauch promises of all launched Bespins.
    var launchBespinPromises = [];

    var nodes = document.querySelectorAll(".bespin");
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var options = node.getAttribute('data-bespinoptions');
        var pr = bespin.useBespin(node, JSON.parse(options));
        pr.then(function(env) {
            node.bespin = env;
        }, function(error) {
            throw new Error('Launch failed: ' + error);
        });
        launchBespinPromises.push(pr);
    }

    // If users want a custom startup
    if (window.onBespinLoad) {
        // group-promise function.
        var group = bespin.tiki.require("bespin:promise").group;

        // Call the window.onBespinLoad() function after all launched Bespins
        // are ready or throw an error otherwise.
        group(launchBespinPromises).then(function() {
            window.onBespinLoad();
        }, function() {
            throw new Error('At least one Bespin failed to launch!');
        });
    }
}, false);
