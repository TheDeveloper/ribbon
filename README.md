# Ribbon
Ribbon exposes a consistent and simple API for working with an object that has changeable state, i.e. the `client`.

The client will usually be something that holds a connection open to an external service, for example an instance of the `node-redis` client, but can be anything that emits events to reflect its internal state.

Commonly, different clients will use varying terminology to describe similar concepts. Ribbon provides a standard set of events and methods your application can use to verify the status of the client and react accordingly.

## Interface

### ribbon.startUp([fn])

Registers `fn` as the startup function if provided. Otherwise, runs the already registered `fn`.

`fn` contains the code you would write to configure, instantiate and start the client.

Signature:

```javascript
/**
 * Startup function for the client
 * @param  {object}   ribbon Ribbon core
 * @param  {Function} cb     Invoke with cb(err, client) when startup complete
 */
function(ribbon, client, cb){}
```

Example:

```javascript
var redisRibbon = new Ribbon();

redisRibbon.startUp(function(ribbon, client, cb){
  var client = Redis.createClient(6379, 'localhost');

  client.on('ready', function(){
    cb(null, client);
  });
});
```

### ribbon.shutDown([fn])

Registers `fn` as the shutdown function if provided. Otherwise, runs the already registered `fn`.

`fn` contains the code you would write to gracefully stop the client, such as waiting for activity to stop and then disconnecting.

Signature:

```javascript
/**
 * Shutdown function for the client
 * @param  {object}   ribbon Ribbon core
 * @param  {object}   client The client
 * @param  {Function} cb     Invoke with cb(err) when shutdown complete
 */
function(ribbon, client, cb){}
```

### ribbon.terminate([fn])

Registers `fn` as the termination function if provided. Otherwise, runs the already registered `fn`.

`fn` contains the code you would write to immediately terminate the client.

Signature:

```javascript
/**
 * Terminate function for the client
 * @param  {object}   ribbon Ribbon core
 * @param  {object}   client The client
 * @param  {Function} cb     Invoke with cb(err) when terminate complete
 */
function(ribbon, client, cb){}
```

### ribbon.restart([fn])

If called without pre-registering a function, restart runs `ribbon.shutDown` then `ribbon.startUp()`.

If called with `fn`, registers `fn` as the restart function. Otherwise, runs the already registered `fn`.

`fn` contains the code you would write to immediately terminate the client.

Signature:

```javascript
/**
 * Terminate function for the client
 * @param  {object}   ribbon Ribbon core
 * @param  {object}   client The client
 * @param  {Function} cb     Invoke with cb(err) when restart complete
 */
function(ribbon, client, cb){}
```

### ribbon.isUp()

Boolean: __true__ if client is available.

Useful for quickly checking the status of a client before working with it. For example, you might want to make sure that the connection to your database is up and ready before sending a query.

### ribbon.isDown()

Inverse of `ribbon.isUp()`

Boolean: __true__ if client is unavailable.

### wasUp()
Boolean: __true__ if connection was previously up but is now down.

### wasDown()

Inverse of `ribbon.wasUp()`

Boolean: __true__ if connection was previously down but is now up.

## Events

Each instance of Ribbon is an event emitter.

### 'up'

Fires when client becomes available.

### 'down'

Fires when client becomes unavailable.

### 'dropped'

Fires when a problem with the client was detected and it becomes unintentionally unavailable.

### 'revived'

Fires when client recovers and is available again after dropping.

## Integration example

Full example with node-redis client:

```javascript
var redisOpts = {
  retry_max_delay: 10000
};

var Ribbon = require('ribbon');
var Redis = require('redis');

var redisRibbon = new Ribbon();

redisRibbon.startUp(function(ribbon, cb){
  var client = Redis.createClient(6379, 'localhost', redisOpts);

  client.on('ready', function(){
    cb(null, client);
  });

  client.on('error', function(){
    ribbon.declareDropped();
    ribbon.startUp();
  });

  client.on('end', function(){
    ribbon.declareDown();
  });
});

redisRibbon.shutDown(function(ribbon, redis, cb){
  redis.quit(cb);
});

redisRibbon.terminate(function(ribbon, redis, cb){
  redis.end(cb);
});

// Elsewhere in your application…
redisRibbon.once('up', function(){
	// Your application knows when the client is available when this callback is invoked
});

redisRibbon.once('down', function(){
	// Drats, we lost connection. Disable querying until we get the 'up' event
});

if(redisRibbon.isUp()){
	// Should be ready to query
}

if(redisRibbon.isDown()){
	// We should probably wait until we get the next 'up' event
  ribbon.once('up', function(){
    // Carry on as usual
  });
}

// Call when you want to start the client
redisRibbon.startUp();
// Call when you want to stop the client
redisRibbon.shutDown();
// Call when you want to restart the client
redisRibbon.restart();
// Call when you want to terminate the client
redisRibbon.terminate();

```

## Tests

Don't forget to ``npm install`` first.

```bash
make test
```
