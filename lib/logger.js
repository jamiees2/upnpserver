/*jslint node: true */
"use strict";
var log = console.log.bind(console);
var Logger = {

  log : function() {
    debugger;
    throw 'Do not use Logger.log function';
  },

  trace : log,
  debug : log,
  verbose : log,
  info : console.info.bind(console) || log,
  warn : console.warn.bind(console) || log,
  error : console.error.bind(console) || log
};

module.exports = Logger;