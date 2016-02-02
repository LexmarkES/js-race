/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

function Sample(browser, usecase, action) {
    this.browser = browser;
    this.usecase = usecase;
    this.execute = action;
    this._startTime = Date.now();
}

Sample.prototype.end = function () {
    this.timestamp = Date.now();
    this.elapsed = this.timestamp - this._startTime;
    delete this._startTime;
};

module.exports = Sample;