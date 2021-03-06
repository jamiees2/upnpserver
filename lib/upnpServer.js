/*jslint node: true, vars: true, nomen: true */
"use strict";

var Url = require('url');
var Path = require('path');

var jstoxml = require('jstoxml');
var Uuid = require('node-uuid');
var send = require('send');
var Underscore = require('underscore');
var Async = require("async");
var Mime = require('mime');

var debug = require('debug')('upnp:server');
var Item = require('./item');
var xmlFilters = require("./xmlFilters").xmlFilters;

var ContentDirectoryService = require("./contentDirectoryService");
var ConnectionManagerService = require("./connectionManagerService");
var MediaReceiverRegistrarService = require("./mediaReceiverRegistrarService");

var DESCRIPTION_PATH = "/DeviceDescription.xml";
var ICON_PATH = "/icons/";
var DEFAULT_LANGUAGE = "en";

var UpnpServer = function(port, _configuration, callback) {

  var configuration = Underscore.clone(_configuration || {});
  this.configuration = configuration;

  var lang = configuration.lang || process.env.LANG || DEFAULT_LANGUAGE;

  var langPart = /^([a-z][a-z]).*$/i.exec(lang);
  configuration.i18n = require("./i18n_" + langPart[1].toLowerCase());

  this.dlnaSupport = configuration.dlnaSupport;

  this.packageDescription = require("../package.json");

  this.name = configuration.name || "Node UPNP Server";
  this.uuid = configuration.uuid || Uuid.v4();
  if (this.uuid.indexOf("uuid:") !== 0) {
    this.uuid = "uuid:" + this.uuid;
  }

  this.serverName = configuration.serverName;

  if (!this.serverName) {
    var ns = [ "Node/" + process.versions.node, "UPnP/1.0",
        "UPnPServer/" + this.packageDescription.version ];

    if (this.dlnaSupport) {
      ns.push("DLNADOC/1.50");
    }

    this.serverName = ns.join(" ");
  }

  this.deviceInformation = Underscore.defaults(configuration.deviceInformation || {}, {
    manufacturer : this.packageDescription.author,
    manufacturerURL : "https://github.com/oeuillot/upnpserver",
    modelDescription : "Node upnp server",
    modelName : "Windows Media Connect compatible (Node upnpserver)",
    modelURL : "https://github.com/oeuillot/upnpserver",
    modelNumber : this.packageDescription.version,
    serialNumber : "1.2",
  });

  this.port = port;
  this.services = [];
  this.descriptionPath = DESCRIPTION_PATH;
  this.type = "urn:schemas-upnp-org:device:MediaServer:1";
  if (configuration.icons) {
    this.iconPath = configuration.icons.iconPath;
    this.icons = configuration.icons.iconList;
  } else {
    this.iconPath = Path.join(Path.dirname(__dirname),'icon')
    this.icons = [
      {
        width: 32,
        height: 32,
        name: 'icon_32.png'
      },
      {
        width: 128,
        height: 128,
        name: 'icon_128.png'
      },
      {
        width: 512,
        height: 512,
        name: 'icon_512.png'
      }
    ];
  }

  this.iconList = Underscore.map(this.icons, function(icon){
    return {
      _name : "icon",
      _content : {
        mimetype : Mime.lookup(icon.name),
        width : icon.width,
        height : icon.height,
        depth : icon.depth || 24,
        url : ICON_PATH + icon.name
      }
    };
  });

  if (!configuration.services) {
    configuration.services = [ new ConnectionManagerService(),
        new ContentDirectoryService() ];

    if (this.dlnaSupport) {
      configuration.services.push(new MediaReceiverRegistrarService());
    }
  }

  var self = this;
  Async.each(configuration.services, function(service, callback) {
    self.addService(service, callback);

  }, function(error) {
    if (error) {
      return callback(error, self);
    }

    return callback(null, self);
  });
};
module.exports = UpnpServer;

UpnpServer.prototype.setRepositories = function(repositories, callback) {

  var self = this;

  // BEWARE : callback is now called with only 1 parameter (error)

  Async.each(this.services, function(service, callback) {
    if (service instanceof ContentDirectoryService) {
      service.setRepositories(repositories, callback);
    }
  }, callback);
};

UpnpServer.prototype.addRepository = function(repository, callback) {

  var self = this;

  // BEWARE : callback is now called with only 1 parameter (error)

  Async.each(this.services, function(service, callback) {
    if (service instanceof ContentDirectoryService) {
      service.addRepository(repository, callback);
    }
  }, callback);
};

UpnpServer.prototype.addService = function(service, callback) {
  var self = this;
  service.initialize(this, function(error) {
    if (error) {
      return callback(error);
    }

    self.services.push(service);

    callback(null, service);
  });

};

UpnpServer.prototype.toJXML = function(request, callback) {
  var localhost = request.socket.localAddress;
  var localport = request.socket.localPort;

  var xml = {
    _name : "root",
    _attrs : {
      xmlns : "urn:schemas-upnp-org:device-1-0"

    },
    _content : {
      specVersion : {
        major : 1,
        minor : 0
      },
      device : {
        deviceType : "urn:schemas-upnp-org:device:MediaServer:1",
        friendlyName : this.name,
        manufacturer : this.deviceInformation.manufacturer,
        manufacturerURL : this.deviceInformation.manufacturerURL,
        modelDescription : this.deviceInformation.modelDescription,
        modelName : this.deviceInformation.modelName,
        modelURL : this.deviceInformation.modelURL,
        modelNumber : this.deviceInformation.modelNumber,
        serialNumber : this.deviceInformation.serialNumber,

        UDN : this.uuid,
        presentationURL : "http://" + localhost + ":" + localport + "/",

        iconList : this.iconList,

        serviceList : []
      },
      URLBase : "http://" + localhost + ":" + localport + "/"
    }
  };

  if (this.dlnaSupport) {
    xml._attrs["xmlns:dlna"] = "urn:schemas-dlna-org:device-1-0";
    xml._content.device["dlna:X_DLNADOC"] = "DMS-1.50";
    xml._content.device["dlna:X_DLNACAP"] = "";
//         "dlna:X_DLNACAP"
// <dlna:X_DLNADOC>DMS-1.50</dlna:X_DLNADOC>
// <dlna:X_DLNADOC>M-DMS-1.50</dlna:X_DLNADOC>
  }

  this.services.forEach(function(service) {
    xml._content.device.serviceList.push(service.serviceToJXml());
  });

  return callback(null, xml);
};

UpnpServer.prototype.processRequest = function(request, response, path,
    callback) {

  response.setHeader("Server", this.serverName);

  if (this.dlnaSupport) {
    // Thanks to smolleyes for theses lines
    response.setHeader('transferMode.dlna.org', 'Streaming');
    response
        .setHeader('contentFeatures.dlna.org',
            'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=017000 00000000000000000000000000');
  }

  response.sendDate = true;

  debug("Request='" + path + "' from='" +
      request.connection.remoteAddress + "'");

  if (path === this.descriptionPath) {
    return this.toJXML(request, function(error, xmlObject) {
      if (error) {
        return callback(error);
      }

      var xml = jstoxml.toXML(xmlObject, {
        header : true,
        indent : " ",
        filter : xmlFilters
      });

      // debug("Request description path: " + xml);
      response.setHeader("Content-Type", "text/xml; charset=\"utf-8\"");

      response.end(xml, "UTF-8");
      return callback(null, true);
    });
  }

  if (path.indexOf(ICON_PATH) === 0) {
    path = path.substring(ICON_PATH.length);
    path = path.replace(/\.\./g, "").replace(/\\/g, "").replace(/\//g, "");

    path = Path.join(this.iconPath, path);

    debug("Send icon '" + path + "'");

    send(request, path).pipe(response);
    return callback(null, true);
  }

  var processed = false;
  Async.eachSeries(this.services, function(service, callback) {
    if (processed) {
      return callback(null);
    }
    service.processRequest(request, response, path, function(error, found) {
      if (error) {
        return callback(error);
      }

      if (found) {
        processed = true;
      }
      callback(null);
    });
  }, function(error) {
    if (error) {
      return callback(error);
    }

    callback(null, processed);
  });
};
