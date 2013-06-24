var mysql = require('mysql'),
    ribbon = require('../../ribbon').ribbon;

var adaptor = module.exports = {};

adaptor.startUp = function(cb){
  var ribbon = this, debug = ribbon.debugAdaptor;

  var client = mysql.createConnection(ribbon.opts.client);
  ribbon.setClient(client);

  var dropped = function(err){
    debug('Adaptor detected drop');
    return ribbon.dropped(err);
  };

  client.on('close', dropped);
  client.on('error', dropped);

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
  if(cb) return cb();
};
