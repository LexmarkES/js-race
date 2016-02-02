/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';
var _ = require('underscore'),
    fs = require('fs'),
    logger = require('../common/logger'),
    Q = require('q');

var writeFile = Q.nfbind(fs.writeFile);

var headers = ['TIMESTAMP', 'EPOCH', 'BROWSER', 'USECASE', 'ACTION', 'TOTAL', 'NUM', 'AVG', 'STD_DEV', 'MIN', 'MAX'];

function MetricsTracker(interval_ms, path) {
    this.interval = null;
    this.interval_ms = interval_ms || 60000; //60 seconds in ms
    this.samples = []; //initialize empty sample array
    this.path = path || 'metrics.tsv';

    this.startPromise = null;
}

MetricsTracker.prototype.start = function () {
    if (this.startPromise) {
        return this.startPromise;
    }

    return this.startPromise = this.writeHeader()
        .then(() => {
            this.startInterval();
            logger.log.info('metrics tracker started');
        });
};

MetricsTracker.prototype.writeHeader = function () {
    return writeFile(this.path, headers.join('\t') + '\n', 'utf8');
};

MetricsTracker.prototype.startInterval = function () {
    this.interval = setInterval(() => {
        this.writeInterval();
    }, this.interval_ms);
};

MetricsTracker.prototype.stop = function () {
    if (!this.interval) {
        return logger.log.error('MetricsTracker has not been started');
    }

    //stop the scheduler and immediately write the last interval
    clearInterval(this.interval);
    return this.writeInterval()
        .then(() => {
            logger.log.info('metrics completely stopped');
        });
};

MetricsTracker.prototype.addSample = function (sample) {
    this.samples.push(sample);
};

MetricsTracker.prototype.writeInterval = function () {
    logger.log.debug('writing interval');
    let date = new Date();
    let epoch = date.getTime();
    let timestamp = date.toISOString();
    let intervalSamples = this.samples.slice();
    let lines = _.chain(intervalSamples)
        .groupBy("browser")
        .mapObject((browser) => {
            return _.chain(browser)
                .groupBy("usecase")
                .mapObject((usecase) => {
                    return _.groupBy(usecase, "execute");
                })
                .value();
        })
        .reduce((arr, usecases, browser) => {
            _.each(usecases, (actions, usecase) => {
                _.each(actions, (instances, action) => {
                    let compute = computeTimes(_.pluck(instances, 'elapsed'));
                    let row = [
                        timestamp,
                        epoch,
                        browser,
                        usecase,
                        action,
                        compute.total / 1000.0,
                        compute.num,
                        compute.avg / 1000.0,
                        compute.dev / 1000.0,
                        compute.min / 1000.0,
                        compute.max / 1000.0
                    ];
                    arr.push(row.join('\t'));
                });
            });
            return arr;
        }, [])
        .value();

    //reset sample array
    this.samples = [];

    return Q(intervalSamples.length)
        .then((samples) => {
            if (samples > 0) {
                return Q.nfcall(fs.appendFile, this.path, lines.join('\n') + '\n')
                    .then(() => {
                        let processedTime = (Date.now() - epoch) / 1000.0;
                        logger.log.debug(`processed metrics interval in ${processedTime} seconds, wrote ${lines.length} lines from ${intervalSamples.length} samples to metrics file`);
                    })
                    .thenResolve(samples);
            } else {
                return samples;
            }
        });
};

function computeTimes(times) {
    let num = times.length;
    let sum = _.reduce(times, (sum, time) => {
        return sum + time;
    }, 0);
    let avg = sum / num;
    let dev = Math.sqrt(_.chain(times)
            .map((t) => {
                let diff = t - avg;
                return diff * diff;
            })
            .reduce((sum, time) => {
                return sum + time;
            }, 0)
            .value() / num);
    let min = _.min(times);
    let max = _.max(times);

    return {
        total: sum,
        num: num,
        avg: avg,
        dev: dev,
        min: min,
        max: max
    };
}

module.exports = MetricsTracker;