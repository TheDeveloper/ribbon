var should = require('should'),
    ribbon = require('../lib/ribbon');

var mysql, mysqlOpts = { client: { host: 'localhost'} };

describe("The mysql adaptor", function(){
  it("invokes callback when connected", function(done){
    var mysql = ribbon.wrap('mysql', mysqlOpts);
    mysql.connect(done);
  });

  it("queues callbacks when not connected and invokes them when connected", function(done){
    var mysql = ribbon.wrap('mysql', mysqlOpts);
    var pending = 10;
    var finito = function(){
      if(!--pending) return done();
    };
    for(var i = pending; i--;){
      mysql.connect(finito);
    }
  });

  var setUpConnection = function(opts, cb){
    if(typeof opts == 'function'){
      cb = opts;
      opts = mysqlOpts;
    }

    var mysql = ribbon.wrap('mysql', opts);
    mysql.connect(function(err){
      should.not.exist(err);
      mysql.isUp().should.equal(true);
      mysql.isDown().should.equal(false);
      cb(null, mysql);
    });
  };

  it("reports 'up' when connection active", function(done){
    setUpConnection(function(err, mysql){
      should.not.exist(err);
      done();
    });
  });

  it("reports 'down' when connection lost", function(done){
    setUpConnection(function(err, mysql){
      should.not.exist(err);
      mysql.client.emit('error');
      process.nextTick(function(){
        mysql.isDown().should.equal(true);
        mysql.isUp().should.equal(false);
        done();
      });
    });
  });

  it("can reconnect if connection lost when option is enabled", function(done){
    var opts = mysqlOpts;
    opts.reconnect = true;
    setUpConnection(opts, function(err, mysql){
      should.not.exist(err);
      mysql.on('revived', done);
      mysql.client.emit('error');
    });
  });

  it("can be queried once connection is active", function(done){
    setUpConnection(function(err, mysql){
      should.not.exist(err);
      var client = mysql.client;
      client.query('SELECT 1', done);
    });
  });
});