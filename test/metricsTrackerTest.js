/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

var Sample = require('../lib/metrics/sample'),
    MetricsTracker = require('../lib/metrics/metricsTracker'),
    logger = require('../lib/common/logger'),
    Q = require('q');

logger.impl.level = 4;

var metrics = new MetricsTracker(60000, 'metrics.tsv');

let start = 0;
let stop = 300;
let period = 1000;
let action_min = 1;
let action_max = 2000;
let action_mod = 7;
let browsers = ['firefox', 'chrome', 'phantomjs'];

function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function promiseWhile(condition, body) {
    var done = Q.defer();

    function loop() {
        if (!condition()) {
            return done.resolve();
        }
        Q.when(body(), loop, done.reject);
    }
    Q.nextTick(loop);
    return done.promise;
}

metrics.start()
    .then(() => {
        var n = start;
        return promiseWhile(() => {
            return n <= stop
        }, () => {
            return Q(new Sample(browsers[n % browsers.length], 'test-usecase', 'action-' + n++ % action_mod))
                .then((sample) => {
                    Q.delay(rnd(action_min, action_max))
                        .then(() => {
                            sample.end();
                            metrics.addSample(sample);
                        });
                    return Q.delay(period);
                });
        });
    })
    .then(() => {
        return metrics.stop();
    })
    .then(() => {
        console.log('test completed');
    });


