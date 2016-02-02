/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var race = require('../index');
var logger = race.logger;
var winston = require('winston');

logger.log.warn('This warn should show up');
logger.log.debug('This debug should not show up');

logger.log.level = 4;

logger.log.debug('This debug should show up');
logger.log.warn('This warn should show up');
winston.add(winston.transports.File, {filename: 'testing.log'});

var newLogger = {
    info: winston.info,
    error: winston.error
};
logger.impl = newLogger;

logger.log.info('This is local, winston');