/*jslint node: true */
"use strict";

var Repository = require('./repository');
var Util = require('util');
var Async = require('async');
var fs = require('fs');
var Path = require('path');
var Mime = require('mime');
var Item = require('./item');
var debug = require('debug')('upnp:path');

var PathRepository = function(repositoryId, mountPath, path, searchClasses) {
  Repository.call(this, repositoryId, mountPath);

  this.directoryPath = path;
  this.searchClasses = searchClasses;

  var self = this;
  fs.watch(path, function(event, filename) {
    debug('PathRepository: event is: ' + event, " filename=", filename);
  });

  fs.exists(path, function(exists) {
    if (!exists) {
      console.log("Path '" + path + "' does not exist !"); // Error
      return;
    }

    fs.watch(path, function(event, filename) {
      debug('PathRepository: event is: ' + event, " filename=", filename);

      if (!filename) {
        if (self.root) {
          self.root.update();
        }
        return;
      }

      var node = self.root;
      var p = filename.split(Path.sep);

      Async.each(p, function(segment, callback) {
        if (!node) {
          return callback(null);
        }

        node.getChildByName(segment, function(error, item) {
          if (error) {
            return callback(error);
          }

          if (item) {
            node = item;
          }

          return callback(null);
        });

      }, function(error) {
        if (error) {
          console.log("pathRepository: watch error ", error); // Error
        }
        if (node) {
          node.update();
        }
      });

    });
  });
};

Util.inherits(PathRepository, Repository);

module.exports = PathRepository;

// <Filter>@id,@parentID,@childCount,dc:title,dc:date,res,res@protocolInfo,res@size,sec:CaptionInfoEx</Filter>

PathRepository.prototype.browse = function(list, item, callback) {

  var self = this;
  var itemPath = item.getPath();
  var path = itemPath.substring(this.mountPath.length);

  if (path && path.charAt(0) !== '/') {
    path = "/" + path;
  }

  path = this.directoryPath + path.replace(/\//g, Path.sep);

  debug("PathRepository: browseItem=" + itemPath + " path=", path);

  fs.readdir(path, function(error, files) {
    if (error) {
      if (error.code === "ENOENT") {
        // It can be a virtual folder!

        console.log("PathRepository: ENOENT for " + path); // Error
        return callback(null);
      }

      console.log("PathRepository: Error for " + path, error); // Error
      return callback(error);
    }

    debug("PathRepository: path " + path + " returns " + files.length +
        " files");

    Async.reduce(files, [], function(list, file, callback) {

      var p = path + Path.sep + file;
      fs.stat(p, function(error, stats) {
        if (error) {
          console.log("Stat error for ", p, error); // Error
          return callback(null, list); // Access problem ...
        }

        if (stats.isDirectory()) {
          return self.addDirectory(item, p, stats, function(error, item) {
            if (error) {
              return callback(error);
            }

            if (item) {
              list.push(item);
            }
            return callback(null, list);
          });
        }

        if (stats.isFile()) {
          var mime = Mime.lookup(Path.extname(p).substring(1), "");
          stats.mime = mime;

          return self.addFile(item, p, stats, {}, function(error, item) {
            if (error) {
              return callback(error);
            }

            if (item) {
              list.push(item);
            }
            return callback(null, list);
          });
        }

        debug("Unsupported file '" + p + "' ", stats);
        callback(null, list);
      });

    }, function(error, list) {
      if (error) {
        return callback(error);
      }

      debug("PathRepository: END browse=", itemPath, " path=", path);
      callback(null, list);
    });
  });
};

PathRepository.prototype.addDirectory = function(parent, p, stats, callback) {
  return this.contentDirectoryService.newFolder(parent, p, stats, null,
      this.searchClasses, callback);
};

PathRepository.prototype.addFile = function(parent, p, stats, attributes,
    callback) {

  var upnpClass = null, mime = stats.mime.split("/");

  switch (mime[0]) {
  case "video":
    upnpClass = Item.VIDEO_FILE;
    break;

  case "audio":
    upnpClass = Item.MUSIC_TRACK;
    break;

  case "image":
    upnpClass = Item.IMAGE_FILE;
    break;
  }

  if (!upnpClass) {
    return callback(null);
  }

  return this.contentDirectoryService.newFile(parent, p, upnpClass, stats,
      attributes, callback);
};
