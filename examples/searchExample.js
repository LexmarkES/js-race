/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var LoadDriver = require('../lib/loadDriver');

const WAIT_S = 10 * 1000;

var searchUseCaseDef = {
    name: "simple-search",
    allowedFailures: 0,
    type: 'race',
    browserOpts: [
        {type:'firefox', count: 1},
        {type:'chrome', count: 1},
        {type:'phantomjs', count: 1}
    ], //phantomjs, firefox, chrome
    actions: [
        {
            name: 'open engine',
            execute: browser => {
                return browser.url('http://www.dogpile.com')
                    .waitForExist('input#topSearchTextBox', WAIT_S);
            }
        },
        {
            name: 'search-for-lexmark',
            execute: browser => {
                return browser
                    .setValue('input#topSearchTextBox', 'lexmark')
                    .click('input#topSearchSubmit')
                    .waitForExist('#webResults', WAIT_S);
            }
        }
    ]
};

var test = new LoadDriver([searchUseCaseDef], {runtime_s: 30});

test.run()
    .then(() => {
        console.log('test all done');
    })
    .then(() => {
        process.exit();
    });