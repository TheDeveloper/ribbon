var mysql = require('mysql'),
    ribbon = require('../../ribbon').ribbon,
    util = require('util');

var adaptor = module.exports = {};

adaptor.startUp = function(cb){
  var ribbon = this;

  var   client = mysql.createConnection(ribbon.opts.client);
  ribbon.setClient(client);

  client.on('close', ribbon.dropped);
  client.on('error', ribbon.dropped);

  client.connect(function(err){
    cb(err);
  });
};

adaptor.shutDown = function(cb){
  var ribbon = this;

  var client = ribbon.getClient();
  client.end(function(err){
    return cb(err);
  });
};

adaptor.destroy = function(cb){
  this.getClient().destroy();
  return cb();
};
