var Ribbon = require('../lib/ribbon'),
    should = require('should');

module.exports = function(adaptorName, adaptor, opts){
  var ribbon;

  var newRibbon = function(adaptor, opts){
    if(ribbon){
      ribbon.destroy();
    }
    ribbon = Ribbon.wrap(adaptor, opts);
    return ribbon;
  };

  describe(adaptorName+' adaptor', function(){

    it('invokes callback without error on successful startup', function(done){
      var ribbon = newRibbon(adaptor, opts);
      ribbon.startUp(function(err){
        should.not.exist(err);
        ribbon.isUp().should.equal(true);
        ribbon.isDown().should.equal(false);
        done();
      });
    });

    it('invokes callback without error when starting up while already up', function(done){
      var ribbon = newRibbon(adaptor, opts);
      ribbon.startUp(function(){
        ribbon.startUp(done);
      });
    });

    it('invokes all callbacks successfully when multiple calls to startup are made', function(done){
      var i = 15, pending = i;
      var cb = function(err){
        if(!--pending || err){
          return done(err);
        }
      };

      while(i--){
        ribbon.startUp(cb);
      }
    });

    it('invokes callback with error on failed startup', function(done){
      var ribbon = newRibbon(adaptor, {
        client: { host: 'totallywronghost', port: 1337 }
      });
      ribbon.startUp(function(err){
        should.exist(err);
        ribbon.isUp().should.equal(false);
        ribbon.isDown().should.equal(true);
        done();
      });
    });

    it('invokes callback without error on successful shutdown', function(done){
      var ribbon = newRibbon(adaptor, opts);
      ribbon.startUp(function(err){
        should.not.exist(err);
        ribbon.isUp().should.equal(true);
        ribbon.shutDown(done);
      });
    });

    it('restarts if connection severed', function(done){
      var ribbon = newRibbon(adaptor, {
        client: opts.client,
        autoRestart: true,
        restartDelay: 1,
        maxRestartAttempts: -1
      });

      ribbon.startUp(function(err){
        should.not.exist(err);
        ribbon.on('revived', done);
        ribbon.getClient().emit('error');
      });
    });

    it('fails with error if action timeout reached', function(done){
      var ribbon = newRibbon(adaptor, {
        client: opts.client,
        autoRestart: false,
        actionTimeout: 0,
        maxRestartAttempts: -1
      });

      ribbon.startUp(function(err){
        err.should.equal('timeout');
        done();
      });
    });
  });
};
