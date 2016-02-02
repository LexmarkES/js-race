/*
 * Copyright 2016 Lexmark International Technology S.A.  All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var assert = require('assert');
var Pool = require('../../lib/driverPool');
describe('driver pool', function () {
    var pool = new Pool(3);
    var a, b, c, d;
    describe('checkout tests', function() {
        it('should have all entries on free list', function () {
            assert.equal(pool.getFree().length, 3);
        });
        it('remove from free when checkout is called and free > 0', function () {
            a = pool.checkOut();
            assert.equal(pool.getFree().length, 2);
            b = pool.checkOut();
            assert.equal(pool.getFree().length, 1);
            c = pool.checkOut();
            assert.equal(pool.getFree().length, 0);
        });
        it('grow pool if no existing harnesses free', () => {
            assert.equal(pool.getFree().length, 0);
            assert.equal(pool.getPool().length, 3);
            d = pool.checkOut();
            assert.equal(pool.getPool().length, 4);
        });
    });
    describe('checkin tests', () => {
       it('add newly checked in to free list', function() {
           assert.equal(pool.getFree().length, 0);
           a.checkIn();
           assert.equal(pool.getFree().length, 1);
           b.checkIn();
           assert.equal(pool.getFree().length, 2);
           c.checkIn();
           assert.equal(pool.getFree().length, 3);
           d.checkIn();
           assert.equal(pool.getFree().length, 4);
           assert.equal(pool.getPool().length, 4);
       });
        it('cannot check in the same item twice without checking it out', () => {
            a = pool.checkOut();
            assert.equal(a.checkIn(), true);
            assert.equal(a.checkIn(), false);
        });
    });
});