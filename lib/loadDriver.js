/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

var Q = require('q');
var webdriverio = require('webdriverio'),
    _ = require('underscore'),
    logger = require('./common/logger'),
    UseCase = require('./useCase'),
    MetricsTracker = require('./metrics/metricsTracker'),
    seleniumController = require('./selenium/seleniumController');

function LoadDriver(definitions, opt) {
    this.runtime_ms = (opt.runtime_s || 300) * 1000;
    this.metrics = new MetricsTracker(opt.metrics_interval_ms, opt.metrics_path);

    this.useCases = _.reduce(definitions, (memo, next) => {
        memo.push(new UseCase(next, this.metrics));
        return memo;
    }, []);
}

LoadDriver.prototype.run = function () {
    return seleniumController.start()
        .then(() => {
            return this.metrics.start();
        })
        .then(() => {
            return _.map(this.useCases, useCase => {
                return useCase.init();
            });
        })
        .all()
        .then(() => {
            var starts = _.reduce(this.useCases, (memo, useCase) => {
                useCase.start();
                memo.push(useCase.deferredFailure.promise);
                return memo;
            }, [Q.delay(this.runtime_ms)]);
            logger.log.info('all use cases initialized');

            return Q.race(starts);
        })
        .then(() => {
            logger.log.info('test completed, stopping UseCases and Metrics');
        })
        .catch((err) => {
            logger.log.error(`test failed, stopping UseCases and Metrics, reason: ${err}`);
            logger.log.error(err.stack);
        })
        .then(() => {
            //stop all of the use cases
            _.each(this.useCases, (useCase) => {
                useCase.stop();
            });

            //wait till all drivers are chcked in
            return _.map(this.useCases, (useCase) => {
                return useCase.closePool();
            });
        })
        .all()
        .then(() => {
            //stop metrics
            return this.metrics.stop();
        })
        .finally(() => {
            seleniumController.stop();
        });
};

module.exports = LoadDriver;