/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

var _ = require('underscore');

function CumulativeSample(browser, usecase, action) {
    this.browser = browser;
    this.usecase = usecase;
    this.execute = action || 'ALL_ACTIONS';
    this.samples = [];
}

CumulativeSample.prototype.addSample = function (sample) {
    this.samples.push(sample);
};

CumulativeSample.prototype.end = function (sample) {
    if (sample) {
        this.addSample(sample);
    }

    this.timestamp = this.samples[this.samples.length - 1].timestamp;
    this.elapsed = _.reduce(this.samples, (memo, next) => {
        return memo + next.elapsed;
    }, 0);
};

module.exports = CumulativeSample;