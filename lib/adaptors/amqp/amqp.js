var amqp = require('amqp'),
    Ribbon = require('../../ribbon').ribbon,
    util = require('util');

module.exports = function(opts){
  var connection;

  var createConnection = function(){
    return amqp.createConnection(opts.client);
  };

  var ribbon = new Ribbon(opts);

  var startUp = function(cb){
    var self = this;
    connection = createConnection();
    connection.once('ready', function(){
      return cb(null, connection);
    });

    var problem = function(err){
      return cb(err);
    };

    connection.once('error', problem);
    connection.once('close', function(had_error){
      return cb(true);
    });
  };

  var shutDown = function(complete){
    if(!connection) return complete();

    connection.once('close', function(had_error){
      return complete(had_error ? true : null);
    });

    connection.end();
  };

  var restart = function(){
    console.log('restarting...');
  };

  ribbon.setHandler('startUp', startUp);
  ribbon.setHandler('shutDown', shutDown);
  ribbon.setHandler('restart', restart);

  return ribbon;
};