/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

var _ = require('underscore');
var Q = require('q');
var webdriverio = require('webdriverio');
var logger = require('./common/logger');
var errors = require('./common/errors');

const BROWSER_WIDTH = 1248;
const BROWSER_HEIGHT = 1024;

const browserTypes = {
    firefox:{
        desiredCapabilities: {
            browserName: 'firefox'
        }
    },
    phantomjs:{
        desiredCapabilities: {
            browserName: 'phantomjs'
        }
    },
    chrome:{
        desiredCapabilities: {
            browserName: 'chrome'
        }
    }
};

function Pool(browserOptions, sanitizeURL) {
    const _free = [];
    const _pool = [];

    let _sanitizeURL = sanitizeURL;
    let _browserCount = 0;
    let _closing = false;
    let _browserMatrix = null;
    let _closeDefer = Q.defer();
    let _initializeDefer = Q.defer();
    let _browserOpts = browserOptions;

    this.getFree = function () {
        return _free;
    };

    this.initialized = function () {
        return _initializeDefer.promise;
    };

    this.initPool = function () {
        let browsers = {};

        _.each(_browserOpts, options => {
            for(let i = 0; i < options.count; i++) {
                let browserId = 'browser_' + _browserCount;
                _free.push(_browserCount);
                browsers[browserId] = browserTypes[options.type];
                _pool.push(new PooledBrowser(_browserCount, options.type));
                _browserCount += 1;
            }
        });

        _browserMatrix = webdriverio.multiremote(browsers);
        let promises = [];

        _.each(_free, id => {
            let name = 'browser_' + id;
            let browser = _browserMatrix.select(name);
            let pooledBrowser = _pool[id];
            pooledBrowser.setBrowser(browser.init());
            promises.push(pooledBrowser.resetBrowser());
        });

        return Q.all(promises)
            .then(() => {
                _initializeDefer.resolve();
            });
    };

    this.close = function () {
        _closing = true;
        closeIfAllCheckedIn();
        return _closeDefer.promise;
    };

    this.checkOut = function () {
        if (_free.length <= 0) {
            throw new errors.PoolExhaustedException();
        }

        return _pool[_free.shift()];
    };

    function closeIfAllCheckedIn() {
        if (_pool.length === _free.length) {
            var promises = _.map(_pool, pooledBrowser => {
                return pooledBrowser.browser.end();
            });

            return Q.all(promises).then(() => {
                _closeDefer.resolve();
            });
        } else {
            logger.log.debug(`pool closing, waiting on ${_free.length} of ${_browserCount} to be checked in`);
        }
    }

    function PooledBrowser(id, type) {
        let _id = id;
        this.type = type;

        this.setBrowser = function (browser) {
          this.browser = browser;
        };

        this.checkIn = function() {
            logger.log.debug(`checking in ${_id}`, _id);
            _free.push(_id);

            this.resetBrowser().then(() => {
                if (_closing) {
                    closeIfAllCheckedIn();
                }
            });
        };

        this.resetBrowser = () => {
            return this.browser.deleteCookie()
                .then(() => {
                    return this.browser.url(_sanitizeURL);
                })
                .then(() => {
                    return this.browser.windowHandleSize({width:BROWSER_WIDTH, height:BROWSER_HEIGHT});
                });
        };
    }
}

module.exports = Pool;