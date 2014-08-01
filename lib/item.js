/*jslint node: true, plusplus: true, nomen: true, vars: true */
/*global setImmediate*/
"use strict";

var Util = require("util");
var Async = require("async");
var debug = require('debug')('upnp:item');

// IT MUST START AT 0 because UPNP ROOT must have id 0
var itemIndex = 0;
var emptyMap = {};

var LOG_LIST_CHILDREN = false;
var LOG_GET_CHILD_BYNAME = false;

var Item = function(parent, name, upnpClass, container, attributes) {
  this.id = itemIndex++;

  this.name = name;
  this.upnpClass = upnpClass;

  if (container) {
    this.container = true;
  }
  var atts = emptyMap;
  if (attributes) {
    atts = {};
    for ( var k in attributes) {
      atts[k] = attributes[k];
    }
  }
  this.attributes = atts;
  this.itemUpdateId = 0;

  if (atts.virtual) {
    this.virtual = true;
  }

  if (parent) {
    this.path = parent.path + ((parent.path !== "/")
        ? "/"
        : "") + name;
    this.parentId = parent.id;
    this.service = parent.service;

    if (!parent._childrenIds) {
      parent._childrenIds = [];
    }

    parent._childrenIds.push(this.id);
    parent.itemUpdateId++;
    this.service.registerUpdate(this);

  } else {
    this.path = "/";
    this.parentId = -1;
    this.id = 0; // Force Id to 0
  }

  debug("NewItem id=" + this.id + " parent=" + this.parentId + " name=" +
      name + " upnpClass=" + upnpClass + " container=" + container);

};

Item.CONTAINER = "object.container";
Item.STORAGE_FOLDER = "object.container.storageFolder";
Item.VIDEO_FILE = "object.item.videoItem";
Item.IMAGE_FILE = "object.item.imageItem";
Item.IMAGE_PHOTO = Item.IMAGE_FILE + ".photo";
Item.AUDIO_FILE = "object.item.audioItem";
Item.MUSIC_TRACK = Item.AUDIO_FILE + ".musicTrack";
Item.MUSIC_ARTIST = "object.container.person.musicArtist";
Item.ALBUM_CONTAINER = "object.container.album";
Item.MUSIC_ALBUM = Item.ALBUM_CONTAINER + ".musicAlbum";
Item.VIDEO_ALBUM = Item.ALBUM_CONTAINER + ".videoAlbum";
Item.PHOTO_ALBUM = Item.ALBUM_CONTAINER + ".photoAlbum";
Item.MUSIC_GENRE = "object.container.genre.musicGenre";
// Playlists should be: object.container.playlistContainer
// object.container.person.movieActor
// object.container.person.musicArtist

module.exports = Item;

Item.prototype.listChildren = function(callback) {
  var self = this;

  var service = this.getService();

  var cache = service._childrenWeakHashmap.get(this);
  if (cache) {
    return callback(null, cache);
  }

  if (this._locked) {
    setImmediate(function() {
      self.listChildren(callback);
    });
    return;
  }

  if (!this.container) {
    if (LOG_LIST_CHILDREN) {
      debug("Item.listChildren[" + self + "]  => No container");
    }
    return callback(null, null);
  }

  this._locked = true;

  if (this._childrenIds !== undefined) {
    if (LOG_LIST_CHILDREN) {
      debug("Item.listChildren[" + self + "]  => cache ",
          this._childrenIds.length);
    }

    Async.mapLimit(this._childrenIds, 4, function(id, callback) {
      service.getItemById(id, callback);

    },
        function(error, result) {
          self._locked = undefined;

          if (error) {
            debug(
                "Item.listChildren[" + self + "] => map returs error ", error);
            return callback(error);
          }

          if (LOG_LIST_CHILDREN) {
            debug("Item.listChildren[" + self + "] => map returs " +
                result);
          }

          service._childrenWeakHashmap.put(self, result);

          callback(null, result);
        });
    return;
  }

  if (LOG_LIST_CHILDREN) {
    debug("Item.listChildren[" + self + "] => not in cache !");
  }

  // this._childrenIds = [];
  service.browseItem(this, function(error, list) {
    self._locked = undefined;

    if (error) {
      return callback(error);
    }

    if (LOG_LIST_CHILDREN) {
      debug("Item.listChildren[" + self + "] => ", list);
    }

    service._childrenWeakHashmap.put(self, list);

    return callback(null, list);
  });
};

Item.prototype.getPath = function() {
  return this.path;
};

Item.prototype.getService = function() {
  return this.service;
};

Item.prototype.getParent = function(callback) {
  if (!this.parentId) {
    return callback(null, null);
  }

  var service = this.getService();

  return service.getItemById(this.parentId, callback);
};

Item.prototype.getChildByName = function(name, callback) {
  var self = this;

  this.listChildren(function(error, children) {
    if (error) {
      debug(
          "Item.getChildByName[" + self + "] (" + name + ") => error ", error);
      return callback(error);
    }

    var found = null;
    children.forEach(function(child) {
      if (child.name === name) {
        found = child;
        return false;
      }
    });

    if (LOG_GET_CHILD_BYNAME) {
      debug("Item.getChildByName[" + self + "] (" + name + ") => find " +
          found);
    }

    return callback(null, found);
  });
};

Item.prototype.addSearchClass = function(searchClass, includeDerived) {
  if (!this.searchClasses) {
    this.searchClasses = [];
  }

  this.searchClasses.push({
    name : searchClass,
    includeDerived : includeDerived
  });
};

Item.prototype.toJXML = function(request, callback) {
  var content = (this.attrs)
      ? this.attrs.slice(0)
      : [];

  var item = {
    _name : "item",
    _attrs : {
      id : this.id,
      parentID : this.parentId,
      restricted : (this.attributes.restricted)
          ? "1"
          : "0",
      searchable : (this.attributes.searchable)
          ? "1"
          : "0"
    },
    _content : content
  };

  var scs = this.attributes.searchClasses;
  if (this.attributes.searchable && scs) {
    scs.forEach(function(sc) {
      content.push({
        _name : "upnp:searchClass",
        _attrs : {
          includeDerived : (sc.includeDerived
              ? "1"
              : "0")
        },
        _content : sc.name
      });
    });
  }

  var title = this.attributes.title;
  content.push({
    _name : "dc:title",
    _content : title || this.name
  });

  if (this.upnpClass) {
    content.push({
      _name : "upnp:class",
      _content : this.upnpClass
    });
  }
  var date = this.attributes.date;
  if (date) {
    content.push({
      _name : "dc:date",
      _content : this.toISODate(date)
    });
  }

  var resAttrs = this.attributes.resAttrs;
  if (resAttrs) {
    var resAttrData = {
      _name : "res",
      _attrs : resAttrs,
      _content : this.attributes.contentURL
    };
    if (typeof (resAttrData._content) !== "undefined") {
      resAttrData._content = resAttrData._content.replace('<host>',request.request.socket.localAddress);
    } else {
      resAttrData._content = request.contentURL + this.id;
    }
    content.push(resAttrData);
  }

  if (!this.container) {
    return callback(null, item);
  }

  item._name = "container";
  if (this.searchable) {
    item._attrs.searchable = true;
  }

  var childrenIds = this._childrenIds; // 

  if (childrenIds) {
    item._attrs.childCount = childrenIds.length;
    return callback(null, item);
  }

  this.listChildren(function(error, list) {
    if (error) {
      return callback(error);
    }

    item._attrs.childCount = (list)
        ? list.length
        : 0;
    return callback(null, item);
  });

  /*
   * content.push({ _name : "upnp:storageUsed", _content : -1 });
   */

};

Item.prototype.setDate = function(date) {
  if (!date) {
    this._date = undefined;
    return;
  }
  this._date = this.toISODate(date);
};

Item.prototype.toISODate = function(date) {
  return date.toISOString().replace(/\..+/, '');
};

Item.prototype.treeString = function(callback) {
  return this._treeString("", callback);
};

Item.prototype._treeString = function(indent, callback) {
  // debug("TreeString " + this);

  indent = indent || "";

  var s = indent + "# " + this + "\n";
  if (!this.container) {
    return callback(null, s);
  }

  indent += "  ";
  if (!this._childrenIds) {
    s += indent + "<Unknown children>\n";
    return callback(null, s);
  }

  var service = this.getService();

  Async.eachSeries(this._childrenIds, function(childId, callback) {
    service.getItemById(childId, function(error, child) {
      if (error) {
        return callback(error);
      }

      child._treeString(indent, function(error, s2) {
        if (s2) {
          s += s2;
        }

        callback(null);
      });
    });

  }, function(error) {
    callback(error, s);
  });
};

Item.prototype.update = function(callback) {
  debug("Update item itemId=" + this.id + " name=" + this.name);

  // this.getService().updateItem(this, callback);
  callback(null);
};

Item.prototype.garbage = function(callback) {

  var service = this.getService();

  if (!this._childrenIds) {
    if (callback) {
      callback();
    }
    return;
  }

  var self = this;
  Async.each(this._childrenIds, function(child, callback) {
    service.getItemById(child, function(error, item) {
      if (error || !item) {
        return callback(error);
      }

      if (item.virtual) {
        if (!item.container) {
          return callback(null);
        }
        return item.garbage(callback);
      }

      // clean it ! (remove all children for reload)
      self.itemUpdateId++;
      service.registerUpdate(self);

      item._garbageChild(callback);
    });

  }, function(error) {
    if (callback) {
      callback(error);
    }
  });
};

Item.prototype._garbageChild = function(callback) {

  var service = this.getService();

  if (!this.container || !this._childrenIds) {
    console.log("Garbage id " + this.id + " " + this.name);
    return service.removeItemById(this.id, callback);
  }

  var self = this;
  Async.each(this._childrenIds, function(child, callback) {
    service.getItemById(child, function(error, item) {
      item._garbageChild(callback);
    });

  }, function(error) {
    if (error) {
      return callback(error);
    }

    self._childrenIds = null;

    console.log("Garbage id " + self.id + " " + self.name);

    return service.removeItemById(self.id, callback);
  });
};

Item.prototype.toString = function() {
  var s = "[Item id=" + this.id + " name='" + this.name + "' class='" +
      this.upnpClass + "'";

  if (this.attributes.virtual) {
    s += " VIRTUAL";
  }

  return s + "]";
};
