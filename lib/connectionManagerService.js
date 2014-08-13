/*jslint node: true */
"use strict";

var Util = require('util');

var Service = require("./service");

var ConnectionManagerService = function() {
  Service.call(this, {
    serviceType : "urn:schemas-upnp-org:service:ConnectionManager:1",
    serviceId : "urn:upnp-org:serviceId:ConnectionManager",
    scpdURL : "/cms.xml",
    controlURL : "/cms/control",
    eventSubURL : "/cms/event"
  });

  this.addAction("GetCurrentConnectionIDs", [], [ {
    name : "ConnectionIDs",
    type : "CurrentConnectionIDs"
  } ]);
  this.addAction("GetCurrentConnectionInfo", [ {
    name : "ConnectionID",
    type : "A_ARG_TYPE_ConnectionID"
  } ], [ {
    name : "RcsID",
    type : "A_ARG_TYPE_RcsID"
  }, {
    name : "AVTransportID",
    type : "A_ARG_TYPE_AVTransportID"
  }, {
    name : "ProtocolInfo",
    type : "A_ARG_TYPE_ProtocolInfo"
  }, {
    name : "PeerConnectionManager",
    type : "A_ARG_TYPE_ConnectionManager"
  }, {
    name : "PeerConnectionID",
    type : "A_ARG_TYPE_ConnectionID"
  }, {
    name : "Direction",
    type : "A_ARG_TYPE_Direction"
  }, {
    name : "Status",
    type : "A_ARG_TYPE_ConnectionStatus"
  } ]);
  this.addAction("GetProtocolInfo", [], [ {
    name : "Source",
    type : "SourceProtocolInfo"
  }, {
    name : "Sink",
    type : "SinkProtocolInfo"
  } ]);

  this.addType("A_ARG_TYPE_ProtocolInfo", false, "string");
  this.addType("A_ARG_TYPE_ConnectionStatus", false, "string", [ "OK",
      "ContentFormatMismatch", "InsufficientBandwidth", "UnreliableChannel",
      "Unknown" ]);
  this.addType("A_ARG_TYPE_AVTransportID", false, "i4");
  this.addType("A_ARG_TYPE_RcsID", false, "i4");
  this.addType("A_ARG_TYPE_ConnectionID", false, "i4");
  this.addType("A_ARG_TYPE_ConnectionManager", false, "string");
  this.addType("SourceProtocolInfo", true, "string");
  this.addType("SinkProtocolInfo", true, "string");
  this.addType("A_ARG_TYPE_Direction", false, "string", [ "Input", "Output" ]);
  this.addType("CurrentConnectionIDs", true, "string");
};

Util.inherits(ConnectionManagerService, Service);



ConnectionManagerService.prototype.processSoap_GetProtocolInfo = function(
    xml, request, response, callback) {
  this.responseSoap(response, "GetProtocolInfo", {
    _name : "u:GetProtocolInfoResponse",
    _attrs : {
      "xmlns:u" : this.type
    },
    _content : {
      Source : "http-get:*:image/jpeg:DLNA.ORG_PN=JPEG_SM,http-get:*:image/jpeg:DLNA.ORG_PN=JPEG_MED,http-get:*:image/jpeg:DLNA.ORG_PN=JPEG_LRG,http-get:*:audio/mpeg:DLNA.ORG_PN=MP3,http-get:*:audio/L16:DLNA.ORG_PN=LPCM,http-get:*:video/mpeg:DLNA.ORG_PN=AVC_TS_HD_24_AC3_ISO;SONY.COM_PN=AVC_TS_HD_24_AC3_ISO,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=AVC_TS_HD_24_AC3;SONY.COM_PN=AVC_TS_HD_24_AC3,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=AVC_TS_HD_24_AC3_T;SONY.COM_PN=AVC_TS_HD_24_AC3_T,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_PS_PAL,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_PS_NTSC,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_TS_SD_50_L2_T,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_TS_SD_60_L2_T,http-get:*:video/mpeg:DLNA.ORG_PN=MPEG_TS_SD_EU_ISO,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_TS_SD_EU,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_TS_SD_EU_T,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_TS_SD_50_AC3_T,http-get:*:video/mpeg:DLNA.ORG_PN=MPEG_TS_HD_50_L2_ISO;SONY.COM_PN=HD2_50_ISO,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_TS_SD_60_AC3_T,http-get:*:video/mpeg:DLNA.ORG_PN=MPEG_TS_HD_60_L2_ISO;SONY.COM_PN=HD2_60_ISO,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_TS_HD_50_L2_T;SONY.COM_PN=HD2_50_T,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=MPEG_TS_HD_60_L2_T;SONY.COM_PN=HD2_60_T,http-get:*:video/mpeg:DLNA.ORG_PN=AVC_TS_HD_50_AC3_ISO;SONY.COM_PN=AVC_TS_HD_50_AC3_ISO,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=AVC_TS_HD_50_AC3;SONY.COM_PN=AVC_TS_HD_50_AC3,http-get:*:video/mpeg:DLNA.ORG_PN=AVC_TS_HD_60_AC3_ISO;SONY.COM_PN=AVC_TS_HD_60_AC3_ISO,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=AVC_TS_HD_60_AC3;SONY.COM_PN=AVC_TS_HD_60_AC3,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=AVC_TS_HD_50_AC3_T;SONY.COM_PN=AVC_TS_HD_50_AC3_T,http-get:*:video/vnd.dlna.mpeg-tts:DLNA.ORG_PN=AVC_TS_HD_60_AC3_T;SONY.COM_PN=AVC_TS_HD_60_AC3_T,http-get:*:video/x-mp2t-mphl-188:*,http-get:*:*:*,http-get:*:video/*:*,http-get:*:audio/*:*,http-get:*:image/*:*",
      Sink : {}
    }
  }, callback);
};

module.exports = ConnectionManagerService;
