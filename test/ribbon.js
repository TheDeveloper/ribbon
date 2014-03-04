var should = require('should');
var Ribbon = require('../lib/ribbon');

var ribbon = new Ribbon();

ribbon.setStartUp(function(ribbon, client, cb){
  return setImmediate(function(){
    cb(null, {});
  });
});

ribbon.setShutDown(function(ribbon, client, cb){
  return setImmediate(function(){
    cb();
  });
});

ribbon.setTerminate(function(ribbon, client, cb){
  return setImmediate(function(){
    cb();
  });
})

var testStateChecks = function(state){
  ribbon.isUp().should.equal(state);
  ribbon.isDown().should.equal(!state);
  ribbon.wasDown().should.equal(state);
  ribbon.wasUp().should.equal(!state);
};

var testState = function(state){
  ribbon.isUp().should.equal(!!state);
  ribbon.isDown().should.equal(!state);
};

describe('Ribbon', function(){

  describe('starting up', function(){
    it('runs startup fn', function(done){
      ribbon.startUp(done);
    });

    it('state checks should be correct', function () {
      testStateChecks(true);
    });

    it('stats should be correct', function () {
      ribbon.stats.startUp.should.equal(1);
    });
  });

  describe('shutting down', function () {
    it('runs shutdown fn', function (done) {
      ribbon.shutDown(done);
    });

    it('state checks should be correct', function () {
      testState(false);
    });
  });

  describe('restarting', function () {
    it('runs restart', function (done) {
      ribbon.restart(done);
    });

    it('state checks should be correct', function () {
      testState(true);
    });
  });

  describe('client dropping', function () {
    it('client declares drop', function(done){
      ribbon.declareDropped();
      done();
    });

    it('state checks should be correct', function () {
      testStateChecks(false);
    });
  });

  describe('terminating', function () {
    it('runs terminate', function (done) {
      ribbon.terminate(done);
    });

    it('state checks should be correct', function () {
      ribbon.isUp().should.equal(false);
      ribbon.isDown().should.equal(true);
    });
  });
});
