/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

var logger = require('./common/logger');
var errors = require('./common/errors');
var Sample = require('./metrics/sample');
var CumulativeSample = require('./metrics/cumulativeSample');
var fs = require('fs');
var _ = require('underscore');
var Q = require('q');
var path = require('path');

//promisify some fs methods
var mkDir = Q.nfbind(fs.mkdir);
var writeFile = Q.nfbind(fs.writeFile);

var screenshotLocation = path.resolve("err_screenshots");

function UseCaseInstance(pooledBrowser, useCaseObj, metrics, serial, deferredFailure) {
    this.pooledBrowser = pooledBrowser;
    this.useCaseObj = useCaseObj;
    this.metrics = metrics;
    this.serial = serial;
    this.name = useCaseObj.name;
    this.deferredFailure = deferredFailure;
}

UseCaseInstance.prototype.getName = function () {
    return `${this.name}-${this.pooledBrowser.type}_browser_${this.serial}${this.raceCounter ? '-' + this.raceCounter : ''}`;
};

UseCaseInstance.prototype.wrapAction = function (action, cumulativeSample) {
    //wrap screenshot method
    var errSS = function (type, message) {
        return this.takeErrorScreenshotFn(action.name, type, message);
    }.bind(this);

    return Q(new Sample(this.pooledBrowser.type, this.name, action.name))
        .then((sample) => {
            logger.log.debug(`use case: ${this.getName()} running action: ${action.name}`);
            return Q(action.execute(this.pooledBrowser.browser))
                .catch(errSS('EXE', `use case: ${this.getName()} action: ${action.name} execution failed`))
                .then(() => {
                    sample.end();
                    this.metrics.addSample(sample);
                    cumulativeSample.addSample(sample);
                });
        })
        .then(() => {
            if (action.validator) {
                logger.log.debug(`use case ${this.getName()} running validator for action: ${action.name}`);
                return Q(action.validator(driver))
                    .catch(errSS('VALX', `use case: ${this.getName()} action: ${action.name} validator execution failed`))
                    .then((isValid) => {
                        if (!isValid) {
                            return Q.reject('validator returned FALSE')
                                .catch(errSS('VAL', `use case: ${this.getName()} action: ${action.name} validator was falsy`))
                        }
                    });
            }
        });
};

UseCaseInstance.prototype.takeErrorScreenshotFn = function (actionName, type, message) {
    return (err) => {
        logger.log.error(message);
        this.deferredFailure.handle(err);
        return this.takeScreenShot(`${this.getName()}_${actionName}_${type}`)
            .thenReject(err);
    };
};

UseCaseInstance.prototype.takeScreenShot = function (filename) {
    return mkDir(screenshotLocation)
        .catch((err) => {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        })
        .then(() => {
            let ssPath = path.resolve(screenshotLocation, filename + '.png');
            return this.pooledBrowser.browser.saveScreenshot(ssPath)
                .then(() => {
                    logger.log.debug(`screenshot saved at path: ${ssPath}`);
                });
        });

};


function StaggeredInstance(browser, useCaseObj, metrics, serial, deferredFailure) {
    UseCaseInstance.call(this, browser, useCaseObj, metrics, serial, deferredFailure);
}

StaggeredInstance.prototype = Object.create(UseCaseInstance.prototype);

StaggeredInstance.prototype.run = function () {
    return Q(new CumulativeSample(this.pooledBrowser.type, this.name))
        .then((cumulativeSample) => {
            return _.reduce(this.useCaseObj.actions, (memo, nextAction) => {
                return memo.then(() => {
                    return this.wrapAction(nextAction, cumulativeSample);
                });
            }, Q())
                .then(() => {
                    cumulativeSample.end();
                    this.metrics.addSample(cumulativeSample);
                    logger.log.debug(`use case: ${this.getName()} completed`);
                })
                .catch((err) => {
                    logger.log.error(`use case: ${this.getName()} failed with error message: ${err.message}`);
                });
        })
        .finally(() => {
            this.pooledBrowser.checkIn();
        });
};


function RaceInstance(browser, useCaseObj, metrics, serial, deferredFailure) {
    UseCaseInstance.call(this, browser, useCaseObj, metrics, serial, deferredFailure);
    this.stopNow = false;
}

RaceInstance.prototype = Object.create(UseCaseInstance.prototype);

RaceInstance.counter = 0;

RaceInstance.prototype.getAndIncrementCounter = function () {
    return RaceInstance.counter += 1;
};

RaceInstance.prototype.run = function () {
    return promiseWhile(() => {
        return !this.deferredFailure.hasFailed() && !this.stopNow;
    }, () => {
        this.raceCounter = this.getAndIncrementCounter();
        return Q(new CumulativeSample(this.pooledBrowser.type, this.name))
            .then((cumulativeSample) => {
                return _.reduce(this.useCaseObj.actions, (memo, nextAction) => {
                    return memo.then(() => {
                        return this.wrapAction(nextAction, cumulativeSample);
                    });
                }, Q())
                    .then(() => {
                        cumulativeSample.end();
                        this.metrics.addSample(cumulativeSample);
                        logger.log.debug(`use case ${this.getName()} completed`);
                    })
                    .catch((err) => {
                        logger.log.error(`use case ${this.getName()} failed with error message: ${err.message}`);
                    });
            })
            .then(() => {
                return this.pooledBrowser.resetBrowser();
            });
    })
        .finally(() => {
            this.pooledBrowser.checkIn();
        });
};

RaceInstance.prototype.stop = function () {
    logger.log.info(`stopping use case: ${this.name}-${this.serial}`);
    this.stopNow = true;
};

function promiseWhile(condition, body) {
    var done = Q.defer();

    function loop() {
        if (!condition()) return done.resolve();
        Q.when(body(), loop, done.reject);
    }

    Q.nextTick(loop);
    return done.promise;
}

module.exports = {
    UseCaseInstance: UseCaseInstance,
    RaceInstance: RaceInstance,
    StaggeredInstance: StaggeredInstance
};