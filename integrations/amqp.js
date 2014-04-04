/**
 * Example adaptor for node-amqp client: https://github.com/postwait/node-amqp
 */

var Ribbon = require('../lib/ribbon');
var AMQP = require('amqp');

module.exports = function(serverOpts, clientOpts) {
  var amqpRibbon = new Ribbon();

  var watchEvents = function(client) {
    client.on('ready', function() {
      amqpRibbon.declareUp();
    });

    client.on('close', function(){
      amqpRibbon.declareDown();
    });
  };

  amqpRibbon.setStartUp(function(ribbon, amqp, cb) {
    amqp = AMQP.createConnection(serverOpts, clientOpts);

    amqp.once('ready', function() {
      watchEvents(amqp);
      return cb(err, amqp);
    });
  });

  amqpRibbon.setShutDown(function(ribbon, amqp, cb) {
    amqp.once('close', cb);
    amqp.disconnect();
  });

  /**
   * Note that if amqp client is configured to reconnect
   * automatically it may attempt to do so after the
   * socket is terminated.
   */
  amqpRibbon.setTerminate(function(ribbon, amqp, cb) {
    amqp.once('close', cb);
    amqp.socket.destroy();
  });

  return amqpRibbon;
};
