var redis = require('redis'),
    ribbon = require('../../ribbon').ribbon;

var adaptor = module.exports = {};

adaptor.startUp = function(cb){
  var ribbon = this;

  var clientOpts = ribbon.opts.client;
  var client = redis.createClient(clientOpts.port, clientOpts.host, { max_attempts: 0 });
  ribbon.setClient(client);

  var startUpError = function(){
    return cb(true);
  };

  var dropped = function(){
    ribbon.dropped();
  };

  client.on('end', startUpError);
  client.on('error', startUpError);

  client.on('ready', function(){
    client.removeAllListeners();
    client.on('end', dropped);
    client.on('error', dropped);
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
  if(cb) return cb();
};
