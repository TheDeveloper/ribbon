var redis = require('redis'),
    ribbon = require('../../ribbon').ribbon;

var adaptor = module.exports = {};

adaptor.startUp = function(cb){
  var ribbon = this;

  var clientOpts = ribbon.opts.client;
  var client = redis.createClient(clientOpts.port, clientOpts.host);
  ribbon.setClient(client);

  client.on('end', ribbon.dropped.bind(this));
  client.on('error', ribbon.dropped.bind(this));

  client.on('ready', function(){
    return cb();
  });
};

adaptor.shutDown = function(cb){
  var ribbon = this;

  var client = ribbon.getClient();
  client.quit(function(err){
    return cb(err);
  });
};

adaptor.destroy = function(cb){
  this.getClient().end();
  return cb();
};
