/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var Pool = require('../lib/driverPool');

var pool = new Pool(1, {});
pool.initPool();

pool.initialized()
    .then(() => {
        console.log(pool.getFree());
        console.log('test');
        return browser = pool.checkOut();
    })
    .then(browser => {
        return browser.checkIn();
    })
    .then(() => {
        return pool.close();
    });