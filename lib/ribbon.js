var EventEmitter = require('events').EventEmitter,
    debug = require('debug'),
    util = require('util');

var Ribbon = function(opts) {
  EventEmitter.call(this);
  this.up = null;
  this.opts = {
    // Invoke a restart when dropped
    autoRestart: false,
    actionTimeout: 5000,
    backoffFactor: 1.2,
    restartDelay: 1000,
    maxRestartAttempts: -1
  };
  // Shallow copy
  if(typeof opts == 'object'){
    for(var i in opts){
      this.opts[i] = opts[i];
    }
  }
  this.tickerTape = '';
  this.callbackQs = {};
  this.adaptor = {};
  this.shuttingDown = false;
  this.startingUp = false;
  this.restartDelay = this.opts.restartDelay;
  this.restartAttempts = 0;
  this.instanceID = Math.floor(Math.random()*9999).toString(16);
  this.debugPrefix = 'ribbon:'+this.instanceID;
  this.debug = debug(this.debugPrefix);
  this.debugEvents = debug(this.debugPrefix+':events');
  this.debugAdaptor = debug(this.debugPrefix+':adaptor');

  if(this.opts.autoRestart) this.on('dropped', this.restart.bind(this));
};

util.inherits(Ribbon, EventEmitter);

Ribbon.prototype.declareUp = function(){
  this.up = true;
  this.ticker(1);
  this.emit('up');
  if(this.wasDown()) this.emit('revived');
};

Ribbon.prototype.declareDown = function(){
  this.up = false;
  this.ticker(0);
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
  var self = this, timeout;

  this.emit('begin:'+name);
  if(this.opts.actionTimeout){
    timeout = setTimeout(function(){
      self.emit('timeout:'+name);
      cb('timeout');
      cb = function(){};
    }, this.opts.actionTimeout);
  }

  this.invokeHandler(name, function(){
    clearTimeout(timeout);
    self.emit.apply(self, ['complete:'+name].concat(arguments));
    return cb.apply(self, arguments);
  });
};

Ribbon.prototype.emit = function(){
  this.debugEvents(arguments[0]);
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
    self.runCallbackQ(name, [err, client]);
    if(err && self.opts.autoRestart){
      self.restart();
    }
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
  if(this.opts.maxRestartAttempts > -1 && ++this.restartAttempts > this.opts.maxRestartAttempts) return;

  var resetDelay = function(){
    self.restartDelay = self.opts.restartDelay;
  };

  setTimeout(function(){
    if(self.adaptor.restart){
      return self.runAction(name, function(err){
        if(!err) resetDelay();
        return self.runCallbackQ(name, [err]);
      });
    }

    var startUp = function(){
      self.startUp(function(err, client){
        self.runCallbackQ(name);
        if(!err) resetDelay();
        cb(err, client);
      });
    };

    // Make sure everything's shut down properly and then start up again
    return self.isUp() ? self.shutDown(startUp) : startUp();
  }, self.restartDelay);
  self.restartDelay = Math.floor(self.restartDelay * self.opts.backoffFactor);
};

/**
 * Forcefully close the connection and do not reconnect
 */
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

  this.debug('dropped');

  if(this.isShuttingDown() || !this.isUp()) return;

  this.declareDown();
  this.runCallbackQ('startUp', ['dropped']) && this.runCallbackQ('shutDown', ['dropped']);
  // Make sure the old client is obliterated. We don't want any more events coming out of it.
  this.destroy();
  this.emit('dropped');
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
