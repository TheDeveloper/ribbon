/**
 * Example adaptor for node redis client: https://github.com/mranney/node_redis
 */

var Ribbon = require('../lib/ribbon');
var Redis = require('redis');

module.exports = function(port, host, opts){
  var redisRibbon = new Ribbon();
  if (typeof opts !== 'object') opts = {};

  var conf = {
    retry_max_delay: 10000
  };

  for (var prop in opts) {
    if (opts.hasOwnProperty(prop)) {
      conf[prop] = opts[prop];
    }
  }

  redisRibbon.setStartUp(function(ribbon, redis, cb){
    redis = Redis.createClient(port, host, conf);

    redis.on('ready', function(){

      if (typeof conf.database !== 'undefined') redis.select(conf.database);

      // Ensure startup callback is invoked only once
        if (ribbon.isStartingUp()) cb(null, redis);
        else ribbon.declareUp();
    });

    redis.on('end', function(){
      ribbon.declareDown();
    });
  });

  redisRibbon.setShutDown(function(ribbon, redis, cb){
    redis.quit(cb);
  });

  redisRibbon.setTerminate(function(ribbon, redis, cb){
    redis.end();
    return cb();
  });

  return redisRibbon;
};
