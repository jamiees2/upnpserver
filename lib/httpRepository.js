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

    logger.debug("HTTPRepository: returns " + this.files.length +
        " files");

  Async.reduce(this.files, [], function(list, file, callback) {

    // if (stats.isDirectory()) {
    //   return self.addDirectory(item, p, stats, function(error, item) {
    //     if (error) {
    //       return callback(error);
    //     }

    //     if (item) {
    //       list.push(item);
    //     }
    //     return callback(null, list);
    //   });
    // }

    // if (stats.isFile()) {
    var mime = Mime.lookup(Path.extname(file.name).substring(1), "");
    file.mime = mime;
    file.size = file.length;

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
    // }

  }, function(error, list) {
    if (error) {
      return callback(error);
    }

    logger.debug("HTTPRepository: END browse=", itemPath);
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
