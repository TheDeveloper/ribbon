var EventEmitter = require('events').EventEmitter,
    util = require('util');

var ribbon = function(opts) {
  EventEmitter.call(this);
  this.up = null;
  this.opts = opts || {};
  this.tickerTape = '';
  this.callbackQs = {};
  this.handlers = {};
  this.shuttingDown = false;
  this.startingUp = false;

  this.on('unexpectedShutdown', this.restart.bind(this));
};

util.inherits(ribbon, EventEmitter);

ribbon.prototype.debug = function(error) {
  console.log(error.message);
};

ribbon.prototype.declareUp = function(){
  this.up = true;
  this.ticker(1);
  this.emit('up');
  if(this.wasDown()) this.emit('revived');
};

ribbon.prototype.declareDown = function(){
  this.up = false;
  this.ticker(0);
  if(!this.isShuttingDown()) this.emit('unexpectedShutdown');
  this.emit('down');
};

ribbon.prototype.isUp = function(){
  return !!this.up;
};

ribbon.prototype.isDown = function(){
  return !this.up;
};

ribbon.prototype.wasUp = function(){
  // By definition reflects penultimate state
  return this.tickerTape[this.tickerTape.length-2] == "1";
};

ribbon.prototype.wasDown = function(){
  return this.tickerTape[this.tickerTape.length-2] == "0";
};

ribbon.prototype.ticker = function(value){
  if(this.tickerTape.length >= 100) this.tickerTape = this.tickerTape.substr(1);
  this.tickerTape += value;
};

ribbon.prototype.unexpectedShutdown = function(err){
  this.emit('unexpectedShutdown');
};

ribbon.prototype.isShuttingDown = function(){
  return this.shuttingDown;
};

ribbon.prototype.isStartingUp = function(){
  return this.startingUp;
};

ribbon.prototype.runCallbackQ = function(name, args){
  var cb, q = this.callbackQs[name] || [];
  args = args || [];
  while((cb = q.shift())){
    cb.apply(cb, args);
  }
};

ribbon.prototype.pushQ = function(name, item){
  var q;
  if(!(q = this.callbackQs[name])) q = this.callbackQs[name] = [];
  return q.push(item);
};

ribbon.prototype.setHandler = function(name, cb){
  var self = this;
  cb = cb || function(){};
  if(!this[name]) return this.debug('Handler '+name+' is not a valid handler name');
  this.handlers[name] = cb.bind(this);
};

ribbon.prototype.invokeHandler = function(name, complete){
  var self = this;
  (this.handlers[name] || function(){ return self.debug('Handler '+name+' not available'); })(complete);
};

ribbon.prototype.runAction = function(name, cb){
  var self = this;

  // Convention: events before action completion prefix the name, events after suffix the name.
  this.emit('begin'+name);
  this.invokeHandler(name, function(){
    self.emit.apply(self, [name+'Complete'].concat(arguments));
    return cb.apply(self, arguments);
  });
};

// *** BEGIN ACTIONS ***
ribbon.prototype.startUp = function(cb){
  var self = this, name = 'startUp';

  if(this.isUp()) return cb(null, this.getClient());

  this.startingUp = true;
  if(this.pushQ(name, cb) > 1) return;

  this.runAction(name, function(err, client){
    // There could be multiple ways we can get a startup error. If we do we should make sure the callback queue is flushed with an error
    // If we get called while shutting down, don't do anything
    if(self.isShuttingDown()) return self.runCallbackQ(name, ['shuttingDown']);

    // If we get called with an error in 'up' state after a previously successful startup, and we're not shutting down, it's an unexpected shutdown.
    if(err && self.isUp()){
      // We must declare down before initiating unexpected shutdown procedures
      self.declareDown();
      self.unexpectedShutdown();
      return self.runCallbackQ(name, ['unexpectedShutdown']);
    }

    // If we get called with no error, startup succeeded
    if(!err){
      this.startingUp = false;
      self.declareUp();
    }

    self.setClient(client);
    return self.runCallbackQ(name, [err, client]);
  });
};

ribbon.prototype.shutDown = function(cb){
  var self = this, name = 'shutDown';
  // Declare we're shutting down
  this.shuttingDown = true;
  if(this.pushQ(name, cb) > 1) return;

  this.runAction('shutDown', function(err){
    if(!err && self.wasUp()) self.declareDown();
    self.shuttingDown = false;
    return self.runCallbackQ(name, [err]);
  });
};

ribbon.prototype.restart = function(cb){
  var self = this, name = 'restart';
  if(this.pushQ(name, cb) > 1) return;

  var startUp = function(){
    self.startUp(cb);
  };


  return this.isUp() ? this.shutDown(startUp) : startUp();
};

// *** END ACTIONS ***


ribbon.prototype.setClient = function(client){
  if(!client) return;
  this.client = client;
};

ribbon.prototype.getClient = function(){
  return this.client || false;
};

module.exports.ribbon = ribbon;

module.exports.wrap = function(adaptor, opts) {
  if(typeof adaptor == 'string') {
    var err = null;
    var adaptorPath = __dirname+'/adaptors/'+adaptor+'/'+adaptor;
    try {
      adaptor = require(adaptorPath);
    }
    catch(e) {
      err = e;
    }
    if(!adaptor || err){
      throw new Error('Adapter not found. Failed loading '+adaptorPath+' '+err);
    }
  }
  else {
    adaptor = adaptor;
  }

  return adaptor(opts);
};