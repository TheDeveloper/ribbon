var EventEmitter = require('events').EventEmitter;
var debug = require('debug');
var util = require('util');

var Ribbon = module.exports = function(opts) {
  EventEmitter.call(this);

  this.opts = {
    // Invoke a restart when dropped
    autoRestart: false,
    backoffCoefficient: 1.05,
    restartDelay: 1000,
    maxRestartAttempts: -1,

    actionTimeout: 5000
  };

  // Shallow copy
  if(typeof opts == 'object'){
    for(var i in opts){
      this.opts[i] = opts[i];
    }
  }

  this.client = null;

  // State
  this.state = null;
  this.previousState = null;
  this.startingUp = null;
  this.shuttingDown = null;

  this.stats = {
    startUp: 0,
    shutDown: 0,
    restart: 0,
    dropped: 0,
    terminate: 0
  };

  this.clientFns = {};
  this.clientFnStatus = {};

  this.restartDelay = this.opts.restartDelay;
  this.restartAttempts = 0;

  this.instanceID = Math.floor(Math.random()*9999).toString(16);

  this.debugPrefix = 'ribbon:'+this.instanceID;
  this.debug = debug(this.debugPrefix);
};

util.inherits(Ribbon, EventEmitter);

/**
 * State modifiers
 */
Ribbon.prototype.changeState = function(state){
  this.previousState = this.state;
  this.state = state;
};

Ribbon.prototype.declareUp = function(){
  this.changeState(true);
  this.emit('up');
  if(this.wasDown()) this.emit('revived');
};

Ribbon.prototype.declareDown = function(){
  this.changeState(false);
  this.emit('down');
};

Ribbon.prototype.declareDropped = function(){
  this.changeState(false);
  this.emit('dropped');
};

/**
 * State querying
 */
Ribbon.prototype.isUp = function(){
  return !!this.state;
};

Ribbon.prototype.isDown = function(){
  return !this.state;
};

Ribbon.prototype.wasUp = function(){
  return !!this.previousState;
};

Ribbon.prototype.wasDown = function(){
  return !this.previousState;
};

Ribbon.prototype.isShuttingDown = function(){
  return !!this.shuttingDown;
};

Ribbon.prototype.isStartingUp = function(){
  return !this.startingUp;
};

/**
 * Client mutators
 */

Ribbon.prototype.clientFn = function(name, fn, cb){
  if (typeof fn === 'function') return this.clientFns[name] = fn;

  if (typeof (fn = this.clientFns[name]) !== 'function') return;

  this.clientFnStatus[name] = true;
  this.stats[name] += 1;

  return fn(cb);
};

Ribbon.prototype.startUp = function(fn){
  var self = this;

  var cb = function(err, client){
    self.clientFnStatus[name] = false;

    if (typeof client === 'object') self.client = client;

    if (err) return self.declareDropped();

    self.declareUp();
  };

  self.clientFn('startUp', fn, cb);
};

Ribbon.prototype.shutDown = function(fn){
  var self = this;

  var cb = function(err){
    self.clientFnStatus[name] = false;
    self.declareDown();
  };

  self.clientFn('shutDown', fn, cb);
};

Ribbon.prototype.restart = function(fn){
  var self = this;

  var cb = function(err){
    self.clientFnStatus[name] = false;
    self.declareUp();
  };

  self.clientFn('shutDown', fn, cb);

  if (!self.clientFns.restart){
    self.once('down', function(){
      self.startUp();
    });
    self.shutDown();
  }
};
