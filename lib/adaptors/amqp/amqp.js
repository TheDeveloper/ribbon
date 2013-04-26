var amqp = require('amqp');

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
   * @param  err
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
adaptor.shutDown = function(cb){
  if(!client) return cb();

  client = this.getClient();

  // Once we get close we know we're finished
  client.on('close', function(){
    cb();
  });

  // End the socket
  client.end();
};

/**
 * Forcefully close the connection
 * @param  {Function} cb Completion callback
 */
adaptor.destroy = function(cb){
  this.getClient().destroy();
  return cb();
};
