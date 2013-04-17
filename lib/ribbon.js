var EventEmitter = require('events').EventEmitter,
    util = require('util');

var ribbon = function(opts) {
  EventEmitter.call(this);
  this.up = null;
  this.opts = opts || {};
  this.tickerTape = '';
  this.callbackQs = {};
  this.adaptor = {};
  this.shuttingDown = false;
  this.startingUp = false;

  // When
  if(this.opts.autoRestart) this.on('dropped', this.restart.bind(this));
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
  if(!this.isShuttingDown()) this.emit('dropped');
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

ribbon.prototype.setAdaptor = function(adaptor){
  var self = this;
  for(var i in adaptor){
    if(!adaptor.hasOwnProperty(i)) continue;
    this.adaptor[i] = adaptor[i].bind(this);
  }
};

ribbon.prototype.invokeHandler = function(name, complete){
  var self = this;
  (this.adaptor[name] || function(){ return self.debug('Handler '+name+' not available'); })(complete);
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

ribbon.prototype.shutDown = function(cb){
  var self = this, name = 'shutDown';
  // Declare we're shutting down
  this.shuttingDown = true;
  if(this.pushQ(name, cb) > 1) return;

  this.runAction(name, function(err){
    if(!err && self.wasUp()) self.declareDown();
    self.shuttingDown = false;
    return self.runCallbackQ(name, [err]);
  });
};

ribbon.prototype.restart = function(cb){
  var self = this, name = 'restart';
  if(this.pushQ(name, cb) > 1) return;

  if(this.adaptor.restart){
    this.runAction(name, function(err){
      return self.runCallbackQ(name, [err]);
    });
  }

  var startUp = function(){
    self.startUp(cb);
  };

  // Make sure everything's shut down properly and then start up again
  return this.isUp() ? this.shutDown(startUp) : startUp();
};

ribbon.prototype.dropped = function(){
  var self = this;

  if(this.isShuttingDown()) return;

  this.declareDown();
  this.emit('dropped');
  return this.runCallbackQ('startUp', ['dropped']) && this.runCallbackQ('shutDown', ['dropped']);
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

  var r = new ribbon(opts);
  r.setAdaptor(adaptor);
  return r;
};