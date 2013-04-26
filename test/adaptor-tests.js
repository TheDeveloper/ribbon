var Ribbon = require('../lib/ribbon'),
    should = require('should');

var setUpConnection = function(adaptorName, opts, cb){

    var adaptor = Ribbon.wrap(adaptorName, opts);
    adaptor.startUp(function(err){
      cb(err, adaptor);
    });
  };

module.exports = function(adaptorName, opts){

  describe(adaptorName+' adaptor', function(){
    /** Starting and stopping **/
    var c;

    it('invokes callback without error on successful startup', function(done){
      setUpConnection(adaptorName, opts, function(err, adaptor){
        should.not.exist(err);
        adaptor.isUp().should.equal(true);
        adaptor.isDown().should.equal(false);
        done();
        c = adaptor;
      });
    });

    it('invokes callback without error when starting up while already up', function(done){
      c.startUp(done);
    });

    it('invokes all callbacks successfully when multiple calls to startup are made', function(done){
      var i = 15, pending = i;
      var cb = function(err){
        if(!--pending || err){
          return done(err);
        }
      };

      var adaptor = Ribbon.wrap(adaptorName, opts);
      while(i--){
        adaptor.startUp(cb);
      }
    });

    it('invokes callback with error on failed startup', function(done){
      setUpConnection(adaptorName, { client: {host: 'totallywronghost'}}, function(err, adaptor){
        should.exist(err);
        adaptor.isUp().should.equal(false);
        adaptor.isDown().should.equal(true);
        done();
      });
    });

    it('invokes callback without error on successful shutdown', function(done){
      c.shutDown(done);
    });

    it('restarts if connection severed', function(done){
      opts.autoRestart = true;
      setUpConnection(adaptorName, opts, function(err, adaptor){
        should.not.exist(err);
        adaptor.on('revived', done);
        adaptor.destroy();
      });
    });
  });
};
