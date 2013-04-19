var amqp = require('amqp'),
    util = require('util');

var adaptor = {}, client;

module.exports = adaptor;

var createClient = function(opts){
  return amqp.createConnection(opts);
};

/**
 * Begin plugging actions
 */

/**
 * The startUp method initiates the amqp connection.
 * It also binds handlers to certain events that represent service outage.
 * @param  {Function} cb - Callback to invoke when the startup action has completed and the service is up.
 */
adaptor.startUp = function(cb){
  var ribbon = this;

  client = createClient(ribbon.opts.client);
  ribbon.setClient(client);

  // The 'ready' event informs us amqp is up and ready
  client.once('ready', function(){
    return cb();
  });

  /**
   * When detecting an interruption event, inform ribbon service is down
   * @param  {[type]} err [description]
   * @return {[type]}     [description]
   */
  var dropped = function(err){
    return ribbon.dropped();
  };

  // Since amqp extends net, events could happen that inform us of a interruption
  client.on('error', dropped);
  client.on('close', dropped);
};

/**
 * Close off the amqp service gracefully
 * @param  {Function} complete - Callback to invoke when the shutdown action has completed and the service is down.
 */
adaptor.shutDown = function(complete){
  if(!client) return complete();

  client = this.getClient();

  // Once we get close we know we're finished
  client.on('close', function(){
    complete();
  });

  // End the socket
  client.end();
};

adaptor.restart = function(){
};