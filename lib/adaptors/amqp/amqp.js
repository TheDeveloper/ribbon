var amqp = require('amqp');

var adaptor = module.exports = {};

var createClient = function(opts){
  // Reconnect is handled by ribbon
  return amqp.createConnection(opts, { reconnect: false });
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
  var ribbon = this, debug = ribbon.debugAdaptor;

  var client = createClient(ribbon.opts.client);
  ribbon.setClient(client);

  // The 'ready' event informs us amqp is up and ready
  client.once('ready', function(){
    client.removeListener('error', startupFailed);
    client.removeListener('close', startupFailed);
    client.once('error', dropped);
    client.once('close', dropped);
    return cb();
  });

  /**
   * When detecting an interruption event, inform ribbon service is down
   * @param  err
   */
  var dropped = function(err){
    debug('Adaptor detected drop');
    return ribbon.dropped(err);
  };

  var startupFailed = function(err){
    debug('Adaptor detected startup fail');
    cb(err || true);
  };

  // Since amqp extends net, events could happen that inform us of a interruption
  client.once('error', startupFailed);
  client.once('close', startupFailed);
};

/**
 * Close off the amqp service gracefully
 * @param  {Function} complete - Callback to invoke when the shutdown action has completed and the service is down.
 */
adaptor.shutDown = function(cb){
  if(!client) return cb();

  var client = this.getClient();

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
  if(cb) return cb();
};
