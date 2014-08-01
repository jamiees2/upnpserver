/*jslint node: true, plusplus:true, nomen: true */
/*global setImmediate */
"use strict";

var Repository = require('./repository');
var Util = require('util');
var async = require('async');
var fs = require('fs');
var Path = require('path');
var Mime = require('mime');
var Item = require('./item');
var Async = require('async');
var debug = require('debug')('upnp:scanner');

var FILES_PROCESSOR_LIMIT = 4;
var FOLDER_SCAN_LIMIT = 4;
var DIRECTORY_SCAN_LIMIT = 2;

var SCAN_WAITING_MS = 1000 * 60;

var ScannerRepository = function(repositoryId, mountPath, path) {
  Repository.call(this, repositoryId, mountPath);

  this.directoryPath = path;
};

Util.inherits(ScannerRepository, Repository);

module.exports = ScannerRepository;

ScannerRepository.prototype.initialize = function(service, callback) {
  var self = this;
  var log = false;

  function scan(item) {
    self.scan(service, item, function(error) {
      if (error) {
        logger.error("ScannerRepository: Scan error", error);
        return;
      }

      if (!log) {
        return;
      }

      item.treeString(function(error, string) {
        if (error) {
          logger.error("ScannerRepository: Tree string error", error);
          return;
        }
        debug(string);
      });
    });

  }

  Repository.prototype.initialize.call(this, service, function(error, item) {
    if (error) {
      return callback(error);
    }

    setImmediate(function() {
      scan(item);
    });

    fs.watch(self.directoryPath, function(event, filename) {

      debug('ScannerRepository: event is: ' + event);
      if (filename) {
        debug('filename provided: ' + filename);
      } else {
        debug('filename not provided');
      }

      if (self._scanTimeout) {
        clearTimeout(self._scanTimeout);
        delete self._scanTimeout;
      }

      self._scanTimeout = setTimeout(function() {

        var markId = Date.now();
        /*
        listIds(item, markId, function(error, beforeIds) {
          scan(item);

          listIds(item, function(error, afterIds) {

          });
        });
        */
      }, SCAN_WAITING_MS);
    });

    callback(null, item);
  });
};

ScannerRepository.prototype.scan = function(service, item, callback) {

  var self = this;
  var files = [];

  self._scanDirectory(item, files, self.directoryPath, function(error) {
    if (error) {
      logger.error("Scan directory error", error);
      return callback(error);
    }

    debug("Number of files to process: " + files.length);

    Async.eachLimit(files, FILES_PROCESSOR_LIMIT, function(infos, callback) {
      self.processFile(item, infos, function(error) {
        if (error) {
          console.log("Process file itemId=" + item.id + " infos=", infos,
              " error=", error); // Error?
        }

        process.nextTick(callback);
      });

    }, function(error) {
      if (error) {
        console.log("Error while scanning files ", error); // Error?
        return callback(error);
      }

      debug(files.length + " files processed");

      process.nextTick(callback);
    });
  });

};

ScannerRepository.prototype.browse = function(list, item, callback) {
  return callback(null);
};

ScannerRepository.prototype._scanDirectory = function(rootItem, files,
    rootPath, callback) {

  // debug("List directory ", rootPath);

  var self = this;
  fs.readdir(rootPath, function(error, list) {
    if (error) {
      logger.warn("Error while reading directory ", rootPath);
      return callback(null);
    }

    var directories = [];
    Async.eachLimit(list, FOLDER_SCAN_LIMIT, function(path, callback) {

      var p = rootPath + Path.sep + path;
      fs.stat(p, function(error, stats) {
        if (error) {
          logger.error("Error while stat ", p, error);
          return callback(null, list);
        }

        // debug("Scan item ", p);

        if (stats.isDirectory()) {
          directories.push(p);
          return callback(null);
        }

        if (stats.isFile()) {
          // Faire un scannerRepository pour filtrer des fichiers

          var infos = {
            path : p,
            stats : stats
          };
          if (self.keepFile(infos)) {
            // debug("Keep file ", p);
            files.push(infos);
          }

          return callback(null);
        }

        callback(null);
      });

    }, function(error) {
      if (error) {
        logger.error("Reduce error", error);
        return callback(error);
      }

      if (!directories.length) {
        return callback(null);
      }

      Async.eachLimit(directories, DIRECTORY_SCAN_LIMIT, function(directory,
          callback) {

        process.nextTick(function() {
          self._scanDirectory(rootItem, files, directory, callback);
        });

      }, callback);
    });

  });
};

ScannerRepository.prototype.keepFile = function(infos) {
  return false;
};

ScannerRepository.prototype.processFile = function(rootItem, infos, callback) {
  callback("Nothing to process ?");
};
