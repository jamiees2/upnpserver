/**
 * New node file
 */
var debug = require('debug')('upnp:hashmap');

var DELAY_MS = 500;
var MIN_DELAY_MS = 1000;

function ItemWeakHashmap(delay, verifyUpdateId, garbageFunc) {
  delay = delay || DELAY_MS;
  this._verifyUpdateId = !!verifyUpdateId;
  this._garbageFunc = garbageFunc;

  var map = {};
  this._map = map;
  this._now = Date.now() + delay;

  var self = this;
  setInterval(function() {
    var now = Date.now();
    self._now = now + delay;
    var count = 0;
    for ( var k in map) {
      var v = map[k];

      if (v.date > now) {
        continue;
      }

      delete map[k];
      count++;

      if (!garbageFunc) {
        continue;
      }

      try {
        garbageFunc(k, v.date, v.itemUpdateId, v.value);

      } catch (x) {
        console.log("Exception while calling garbage function ", x); // Error
      }
    }

    if (count) {
      // console.log("################ Remove " + count + " keys");
    }
  }, Math.min(delay, MIN_DELAY_MS));
}

ItemWeakHashmap.prototype.get = function(item) {
  var v = this._map[item.id];
  if (!v || (this._verifyUpdateId && v.itemUpdateId != item.itemUpdateId)) {
    return undefined;
  }

  return v.value;
};

ItemWeakHashmap.prototype.put = function(item, value) {
  var v = this._map[item.id];
  if (!v) {
    v = {};
    this._map[item.id] = v;
  }

  v.itemUpdateId = item.itemUpdateId;
  v.date = this._now;
  v.value = value;
};

module.exports = ItemWeakHashmap;
