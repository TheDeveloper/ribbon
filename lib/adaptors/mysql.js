var mysql = require('mysql'),
    ribbon = require('../ribbon').ribbon,
    util = require('util');

var adaptor = function(opts) {
  ribbon.apply(this, arguments);
};

util.inherits(adaptor, ribbon);

// array of callbacks for when the client is finished, means connect can be called multiple times
adaptor.prototype._connectCb = [];
adaptor.prototype.connect = function(cb) {
  var self = this;
  if (cb) self._connectCb.push(cb);

  // stop if we're already connecting
  if (this.connecting) return;
  this.connecting = true;

  this.client = mysql.createConnection(this.opts.client);

  this.client.on('close', this.closeHandler.bind(this));
  this.client.on('error', self.closeHandler.bind(this));

  this.client.connect(function(err) {
    if (err) {
      console.error(err);
    }
    self.declareUp();
    self.connecting = false;
    self.connected = !err;
    // invoke pending callbacks
    var cb;
    // FIFO
    while((cb = self._connectCb.shift())){
      cb(err);
    }
  });
};

adaptor.prototype.closeHandler = function(err) {
  if ('object' == typeof error && !err.fatal) return;
  this.declareDown();
  this.client = false;
  this.connected = false;

  if(this.opts.reconnect) this.connect();
};

module.exports = adaptor;