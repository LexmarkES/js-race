/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var _ = require('underscore');

function Logger() {
    //default logger
    this.impl = new DefaultLogger();
}

Logger.prototype.__defineGetter__('log', function () {
    return this.impl;
});

const logLevels = [
    'ERROR',
    'WARN',
    'INFO',
    'DEBUG',
    'TRACE'
];

const red = '\033[31m';
const yellow = '\033[33m';
const normal = '\033[0m';

function DefaultLogger() {
    this.level = 1;

    var log = function (level, message) {
        //always log errors
        if(this.level >= level || level == 0) {
            var logColor = normal;
            if(level === 0) {
                logColor = red;
            }
            if(level === 1) {
                logColor = yellow;
            }
            var levelText = logLevels[level];
            console.log(`${logColor}${levelText}: ${message}${normal}`);
        }
    }.bind(this);

    this.error = function (message) {
        log(0, message);
    };

    this.warn = function (message) {
        log(1, message);
    };

    this.info = function (message) {
        log(2, message);
    };

    this.debug = function (message) {
        log(3, message);
    };

    this.trace = function (message) {
        log(4, message);
    };
}

module.exports = new Logger();