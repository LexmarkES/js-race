/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

var webdriverio = require('webdriverio');
var logger = require('./common/logger');
var errors = require('./common/errors');
var _ = require('underscore');
var Q = require('q');

var Pool = require('./driverPool');
var useCaseInstance = require('./useCaseInstance');
var RaceInstance = useCaseInstance.RaceInstance;
var StaggeredInstance = useCaseInstance.StaggeredInstance;

function FailureHandler(numAllowed) {
    var deferredFailure = Q.defer();
    var count = 0;

    this.numAllowed = numAllowed;
    this.promise = deferredFailure.promise;

    this.handle = (err) => {
        if (++count > this.numAllowed) {
            deferredFailure.reject(err);
        }
    };

    this.hasFailed = () => {
        return deferredFailure.promise.isRejected();
    };
}

function UseCase(useCaseObj, metrics) {
    var instances = [];
    var instanceNumber = 0;

    var pool;

    this.sanitizeURL = 'about:blank';
    this.timeout = null;
    this.name = useCaseObj.name;
    this.useCaseObj = useCaseObj;
    this.metrics = metrics;
    this.deferredFailure = new FailureHandler(useCaseObj.allowedFailures || 0);

    if(this.name.indexOf(' ') > -1) {
        var oldName = this.name;
        this.name = this.name.replace(/ /g, '_');
        logger.log.warn(`updating use case name from ${oldName} to ${this.name}`);
    }

    _.each(this.useCaseObj.actions, action => {
        if(action.name.indexOf(' ') > -1) {
            var oldName = action.name;
            action.name = action.name.replace(/ /g, '_');
            logger.log.warn(`updating use case action name from ${oldName} to ${action.name}`);
        }
    });

    this.closePool = () => {
        return pool.close();
    };

    this.init = () => {
        pool = new Pool(this.useCaseObj.browserOpts, this.sanitizeURL);
        pool.initPool();
        return pool.initialized();
    };

    this.start = () => {
        return pool.initialized()
            .then(() => {
                if (this.useCaseObj.type === "staggered") {
                    logger.log.info('starting staggered use case');
                    this.startStaggered();
                } else {
                    logger.log.info('starting race use case');
                    this.startRace();
                }
            });
    };

    this.stop = () => {
        if (this.useCaseObj.type === "staggered") {
            logger.log.info('stopping staggered use case');
            this.stopStaggered();
        } else {
            logger.log.info('stopping race use case');
            this.stopRace();
        }
    };

    this.startStaggered = () => {
        if (this.timeout) {
            return logger.log.error(`UseCase ${this.name} already running`);
        }
        this.runAndScheduleNext();
    };

    this.stopStaggered = () => {
        if (!this.timeout) {
            return logger.log.error(`UseCase ${this.name} not running`);
        }
        clearTimeout(this.timeout);
    };

    this.startRace = () => {
        var count = _.reduce(_.pluck(this.useCaseObj.browserOpts, 'count'), (memo, num) => {return memo + num;}, 0);
        _.times(count, this.startRaceInstance);
    };

    this.stopRace = () => {
        _.each(instances, this.stopRaceInstance);
    };

    this.startRaceInstance = (instanceNumber) => {
        var instance = new RaceInstance(pool.checkOut(), this.useCaseObj, this.metrics, instanceNumber, this.deferredFailure);
        instance.run();
        instances.push(instance);
    };

    this.stopRaceInstance = (instance) => {
        instance.stop();
    };

    this.runAndScheduleNext = () => {
        this.runNewUseCaseInstance();
        this.timeout = setTimeout(this.runAndScheduleNext, this.useCaseObj.period);
    };

    this.runNewUseCaseInstance = () => {
        new StaggeredInstance(pool.checkOut(), this.useCaseObj, this.metrics, ++instanceNumber, this.deferredFailure).run();
    };
}

module.exports = UseCase;
