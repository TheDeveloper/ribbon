var EventEmitter = require('events').EventEmitter,
    util = require('util');

var Ribbon = function(opts) {
  EventEmitter.call(this);
  this.up = null;
  this.opts = opts || {};
  this.tickerTape = '';
  this.callbackQs = {};
  this.adaptor = {};
  this.shuttingDown = false;
  this.startingUp = false;
  this.debugOn = false;

  if(this.opts.autoRestart) this.on('dropped', this.restart.bind(this));
};

util.inherits(Ribbon, EventEmitter);

Ribbon.prototype.debug = function(error) {
  if(this.debugOn) console.log(error);
};

Ribbon.prototype.setDebug = function(status){
  this.debugOn = status;
};

Ribbon.prototype.declareUp = function(){
  this.up = true;
  this.ticker(1);
  this.emit('up');
  if(this.wasDown()) this.emit('revived');
};

Ribbon.prototype.declareDown = function(){
  this.up = false;
  this.ticker(0);
  if(!this.isShuttingDown()) this.emit('dropped');
  this.emit('down');
};

Ribbon.prototype.isUp = function(){
  return !!this.up;
};

Ribbon.prototype.isDown = function(){
  return !this.up;
};

Ribbon.prototype.wasUp = function(){
  // By definition reflects penultimate state
  return this.tickerTape[this.tickerTape.length-2] == "1";
};

Ribbon.prototype.wasDown = function(){
  return this.tickerTape[this.tickerTape.length-2] == "0";
};

Ribbon.prototype.ticker = function(value){
  if(this.tickerTape.length >= 100) this.tickerTape = this.tickerTape.substr(1);
  this.tickerTape += value;
};

Ribbon.prototype.isShuttingDown = function(){
  return this.shuttingDown;
};

Ribbon.prototype.isStartingUp = function(){
  return this.startingUp;
};

Ribbon.prototype.runCallbackQ = function(name, args){
  var cb, q = this.callbackQs[name] || [];
  args = args || [];
  while((cb = q.shift())){
    cb.apply(cb, args);
  }
};

Ribbon.prototype.pushQ = function(name, item){
  var q;
  if(!(q = this.callbackQs[name])) q = this.callbackQs[name] = [];
  return q.push(item);
};

/**
 * Cycle through the adaptor's methods and bind Ribbon's context
 * @param {object} adaptor
 */
Ribbon.prototype.setAdaptor = function(adaptor){
  var self = this;
  this.adaptor = {};
  for(var i in adaptor){
    if(!adaptor.hasOwnProperty(i)) continue;
    this.adaptor[i] = adaptor[i].bind(this);
  }
};

Ribbon.prototype.invokeHandler = function(name, complete){
  var self = this;
  (this.adaptor[name] || function(){ return self.debug('Handler '+name+' not available'); })(complete);
};

Ribbon.prototype.runAction = function(name, cb){
  var self = this;

  this.emit('begin:'+name);
  this.invokeHandler(name, function(){
    self.emit.apply(self, ['complete:'+name].concat(arguments));
    return cb.apply(self, arguments);
  });
};

Ribbon.prototype.emit = function(){
  this.debug(arguments[0]);
  EventEmitter.prototype.emit.apply(this, arguments);
};

// *** BEGIN ACTIONS ***
Ribbon.prototype.startUp = function(cb){
  var self = this, name = 'startUp';
  cb = cb || function(){};

  if(self.isShuttingDown()) return cb('shuttingDown');
  if(this.isUp()) return cb(null, this.getClient());

  this.startingUp = true;
  if(this.pushQ(name, cb) > 1) return;

  this.runAction(name, function(err, client){
    // There could be multiple ways we can get a startup error. If we do we should make sure the callback queue is flushed with an error
    // If we get called while shutting down, don't do anything
    if(self.isShuttingDown()) return self.runCallbackQ(name, ['shuttingDown']);

    // If we get called with an error in 'up' state after a previously successful startup, and we're not shutting down, the connection has dropped.
    if(err && self.isUp()){
      return self.dropped();
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

Ribbon.prototype.shutDown = function(cb){
  var self = this, name = 'shutDown';
  cb = cb || function(){};

  if(this.pushQ(name, cb) > 1) return;

  // Declare we're shutting down
  this.shuttingDown = true;

  this.runAction(name, function(err){
    if(!err && self.isUp()) self.declareDown();
    self.shuttingDown = false;
    return self.runCallbackQ(name, [err]);
  });
};

Ribbon.prototype.restart = function(cb){
  var self = this, name = 'restart';
  cb = cb || function(){};

  if(this.pushQ(name, cb) > 1) return;

  if(this.adaptor.restart){
    return this.runAction(name, function(err){
      return self.runCallbackQ(name, [err]);
    });
  }

  var startUp = function(){
    self.startUp(cb);
  };

  // Make sure everything's shut down properly and then start up again
  return this.isUp() ? this.shutDown(startUp) : startUp();
};

Ribbon.prototype.destroy = function(cb){
  var self = this, name = 'destroy';
  cb = cb || function(){};

  if(this.pushQ(name, cb) > 1) return;

  this.runAction(name, function(err){
    if(!err && self.isUp()) self.declareDown();
    self.shuttingDown = false;
    return self.runCallbackQ(name, [err]);
  });
};

/**
 * An interruption in service could happen at any point, regardless of if other actions are in progress.
 * Therefore, we should establish what state Ribbon is in at the time of being informed of a service drop.
 * Any callbacks for outstanding actions should then be called with an error so the clients know an interruption happened.
 */
Ribbon.prototype.dropped = function(){
  var self = this;

  if(this.isShuttingDown()) return;

  this.declareDown();
  this.emit('dropped');
  return this.runCallbackQ('startUp', ['dropped']) && this.runCallbackQ('shutDown', ['dropped']);
};

// *** END ACTIONS ***


Ribbon.prototype.setClient = function(client){
  if(!client) return;
  this.client = client;
};

Ribbon.prototype.getClient = function(){
  return this.client || false;
};

module.exports.Ribbon = Ribbon;

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

  var r = new Ribbon(opts);
  r.setAdaptor(adaptor);
  return r;
};
