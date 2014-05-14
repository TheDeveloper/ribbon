var EventEmitter = require('events').EventEmitter;
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

  this._client = null;

  // State
  this.state = null;
  this.previousState = null;

  this.stats = {
    startUp: 0,
    shutDown: 0,
    restart: 0,
    dropped: 0,
    terminate: 0
  };

  this.clientFns = {
    restart: function(ribbon, client, cb){
      ribbon.once('down', function(){
        ribbon.startUp(cb);
      });
      ribbon.shutDown();
    }
  };

  this._clientFnStatus = {};

  this.restartDelay = this.opts.restartDelay;
  this.restartAttempts = 0;

  this.instanceID = Math.floor(Math.random()*9999).toString(16);
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
  this.emit('up');
  if(this.wasDown()) this.emit('revived');
};

Ribbon.prototype.declareDown = function(){
  this.emit('down');
};

Ribbon.prototype.declareDropped = function(){
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
  return this.clientFnStatus('shutDown');
};

Ribbon.prototype.isStartingUp = function(){
  return this.clientFnStatus('startUp');
};

/**
 * Client integration
 */

Ribbon.prototype.registerHandler = function(name, fn){
  this.clientFns[name] = fn;
}

Ribbon.prototype.setStartUp = function(fn){
  this.registerHandler('startUp', fn);
};

Ribbon.prototype.setShutDown = function(fn){
  this.registerHandler('shutDown', fn);
};

Ribbon.prototype.setRestart = function(fn){
  this.registerHandler('restart', fn);
};

Ribbon.prototype.setTerminate = function(fn){
  this.registerHandler('terminate', fn);
};

/**
 * Client mutators
 */

Ribbon.prototype.clientFnStatus = function(name, status){
  if (typeof status !== 'undefined') this._clientFnStatus[name] = status;

  return this._clientFnStatus[name];
};

Ribbon.prototype.clientFn = function(name, done){
  var fn;

  if (typeof (fn = this.clientFns[name]) !== 'function') return;

  this.clientFnStatus(name, true);
  this.stats[name] += 1;

  return fn(this, this.client(), done);
};

Ribbon.prototype.startUp = function(cb){
  var self = this;
  var name = 'startUp';
  cb = cb || function(){};

  var done = function(err, client){
    self.clientFnStatus(name, false);
    self.changeState(!err);
    self.client(client);

    cb(err, client || self.client());

    if (err){
      self.declareDropped();
    } else {
      self.declareUp();
    }
  };

  self.clientFn(name, done);
};

Ribbon.prototype.shutDown = function(cb){
  var self = this;
  var name = 'shutDown';
  cb = cb || function(){};

  var done = function(err, client){
    self.clientFnStatus(name, false);
    self.changeState(false);

    cb(err, client || self.client());

    self.declareDown();
  };

  self.clientFn(name, done);
};

Ribbon.prototype.restart = function(cb){
  var self = this;
  var name = 'restart';
  cb = cb || function(){};

  var done = function(err, client){
    self.clientFnStatus(name, false);
    self.changeState(!err);
    self.client(client);

    cb(err, client || self.client());

    if (err){
      self.declareDropped();
    } else {
      self.declareUp();
    }
  };

  self.clientFn(name, done);

};

Ribbon.prototype.terminate = function(cb){
  var self = this;
  var name = 'terminate';
  cb = cb || function(){};

  var done = function(err, client){
    self.clientFnStatus(name, false);
    self.changeState(false);

    cb(err, client || self.client());

    self.declareDown();
  };

  self.clientFn(name, done);
};

Ribbon.prototype.client = function(client){
  if (typeof client === 'object') this._client = client;

  return this._client;
};


