/*jslint node: true */
"use strict";

var Repository = require('./repository');
var Util = require('util');
var Async = require('async');
var fs = require('fs');
var Path = require('path');
var Mime = require('mime');
var Item = require('./item');
var logger = require('./logger');

var HTTPRepository = function(repositoryId, mountPath, files) {
  Repository.call(this, repositoryId, mountPath);
  // console.log(this.mountPath);
  this.files = files;

  var self = this;
  // Async.each(files, function(file, callback){
  //   var mime = Mime.lookup(Path.extname(file.name).substring(1), "");
  //   file.mime = mime;
  //   file.size = file.length;
  //   callback(null);
  // });
};

Util.inherits(HTTPRepository, Repository);

module.exports = HTTPRepository;

// <Filter>@id,@parentID,@childCount,dc:title,dc:date,res,res@protocolInfo,res@size,sec:CaptionInfoEx</Filter>

HTTPRepository.prototype.browse = function(list, item, callback) {
  var self = this;
  var itemPath = item.getPath();
  logger.debug("HTTPRepository: browseItem=" + itemPath);
  var path = itemPath.substring(this.mountPath.length);
  var files = this.files;
  if (path !== "") {
    var sp = path.split("/");
    Async.eachSeries(sp, function(p, cb){
      var next = files.map(function(x) { return x.name; }).indexOf(p);
      if (next < 0) {
        return cb('Could not find path');
      }

      files[next].getFiles(function(err, data){
        if(err) return cb(err);
        files = data;
        cb();
      });
    }, function(err){
      return self.browseFiles(list, item, files, callback);
    });
  }
  else return this.browseFiles(list, item, files, callback);
};

HTTPRepository.prototype.browseFiles = function(list, item, files, callback) {

    logger.debug("HTTPRepository: returns " + files.length +
        " files");

  var self = this;
  Async.reduce(files, [], function(list, file, callback) {
    file.mime = file.mime || Mime.lookup(Path.extname(file.name).substring(1), "");
    file.mimeType = file.mime;

    file.size = file.length;

    if (file.directory) {
      return self.addDirectory(item, file.name, file, function(error, item) {
        if (error) {
          return callback(error);
        }

        if (item) {
          list.push(item);
        }
        return callback(null, list);
      });
    } else {

      return self.addFile(item, file.name, file, {}, function(error, item) {
        if (error) {
          return callback(error);
        }
        if (item) {
          item.attributes.contentURL = file.url; 
          list.push(item);
        }
        return callback(null, list);
      });
    }

  }, function(error, list) {
    if (error) {
      return callback(error);
    }

    logger.debug("HTTPRepository: END browse=", item.getPath());
    callback(null, list);
  });
};

HTTPRepository.prototype.addDirectory = function(parent, p, stats, callback) {
  return this.contentDirectoryService.newFolder(parent, "/http/" + p, stats, null,
      this.searchClasses, callback);
};

HTTPRepository.prototype.addFile = function(parent, p, stats, attributes,
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

  return this.contentDirectoryService.newFile(parent, "/http/" + p, upnpClass, stats,
      attributes, callback);
};
