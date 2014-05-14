/**
 * Example adaptor for node redis client: https://github.com/mranney/node_redis
 */

var Ribbon = require('ribbon');
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

    if (!cb) cb = function() {};

    redis = Redis.createClient(port, host, conf);
    ribbon.client(redis);

    if (typeof conf.database !== 'undefined') redis.select(conf.database);

    redis.on('ready', function(){
      // Invoke callback only if we're starting up for the first time.
      // Otherwise, notify ribbon that redis is once again up
      if (ribbon.isStartingUp()) cb(null, redis);
      else ribbon.declareUp();
    });

    /**
     *
     * Errors are emitted on the redis client if:
     *   1. The underlying socket emitted 'error'
     *   2. The redis parser emitted 'error'
     *   3. A callback to a redis command threw an exception but there isn't
     *      an active process.domain to capture the error.
     *
     * When errors are handled and do not cause a process crash, redis tries
     * to reconnect if configured to do so.
     */
    redis.on('error', function(err) {
      // Re-emit the error on the ribbon object
      ribbon.emit('error', err);
    });

    /**
     * An 'end' event signifies that the redis connection is no longer
     * available for some reason (error, socket closed, shutdown).
     * See https://github.com/mranney/node_redis/blob/2ff2a74ef6cfe8289752e8fbcc7d2f60610088db/index.js#L442
     */
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
