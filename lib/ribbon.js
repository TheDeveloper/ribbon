var EventEmitter = require('events').EventEmitter,
    util = require('util');

var ribbon = function(opts) {
  EventEmitter.call(this);
  this.up = null;
  this.opts = opts || {};
  this.tickerTape = '';
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

module.exports.ribbon = ribbon;

module.exports.wrap = function(adaptor, opts) {
  if(typeof adaptor == 'string') {
    var err = null;
    var adaptorPath = __dirname+'/adaptors/'+adaptor;
    try {
      adaptor = require(adaptorPath);
    }
    catch(e) {
      err = e;
    }
    if(!adaptor || err){
      return this.debug(new Error('Adapter not found. Failed loading '+adaptorPath));
    }
  }
  else {
    adaptor = adaptor;
  }

  return new adaptor(opts);
};