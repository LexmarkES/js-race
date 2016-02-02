/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var Q = require('q');
var selenium = require('selenium-standalone');
var logger = require('../common/logger');

function SeleniumController() {
    let seleniumOpts = {
        version: '2.48.2',
        baseURL: 'https://selenium-release.storage.googleapis.com'
    };

    let process;

    this.start = function () {
        return Q.nfapply(selenium.install, [seleniumOpts])
            .then(() => {
                logger.log.info('selenium installed');
                return Q.nfapply(selenium.start, [{}]);
            })
            .then(child => {
                logger.log.info('selenium started');
                process = child;
            });
    };

    this.stop = function () {
        return Q.nfapply(process.kill(), []);
    }
}

module.exports = new SeleniumController();