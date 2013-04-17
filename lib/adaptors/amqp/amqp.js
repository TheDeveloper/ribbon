var amqp = require('amqp'),
    util = require('util');

var adaptor = {}, client;

module.exports = adaptor;

var createClient = function(opts){
  return amqp.createConnection(opts);
};

adaptor.startUp = function(cb){
  var ribbon = this;

  client = createClient(ribbon.opts.client);
  ribbon.setClient(client);

  client.once('ready', function(){
    return cb(null);
  });

  var dropped = function(err){
    return ribbon.dropped();
  };

  client.on('error', dropped);
  client.on('close', dropped);
};

adaptor.shutDown = function(complete){
  if(!client) return complete();

  client = this.getClient();

  client.on('close', function(){
    complete();
  });

  client.end();
};

adaptor.restart = function(){
};