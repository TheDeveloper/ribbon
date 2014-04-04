# Ribbon
Ribbon exposes a consistent and simple API for working with an object that has changeable state, i.e. the `client`.

The client will usually be something that holds a connection open to an external service, for example an instance of the `node-redis` client, but can be anything that emits events to reflect its internal state.

Commonly, different clients will use varying terminology to describe similar concepts. Ribbon provides a standard set of events and methods your application can use to verify the status of the client and react accordingly.

## Integration Interface

Ribbon manipulates your client by executing "actions" such as starting, stopping and restarting. Since ribbon is only a wrapper around your client, it needs a way to talk to your client so it can apply these actions as well as monitor its state.

Before using ribbon, you first integrate it with your client. For each action, you give ribbon a function it can execute when the action is run. This function is an interface to your client, so it will contain the code necessary to apply that action to the client.

The actions are:

### startUp

Creates and starts the client.

#### ribbon.setStartUp([fn])

Registers `fn` as the function to run when `ribbon.startUp()` is called.

In `fn`, you instantiate and set up your client. Commonly, you will also bind event listeners on the client to notify ribbon of state changes, such as disconnects.

Example:

```javascript
var Redis = require('redis');
var Ribbon = require('Ribbon');
var redisRibbon = new Ribbon();

/**
 * Startup function for the client.
 * Signature:
 * @param  {object}   ribbon Ribbon core
 * @param  {object}   client Client, if .startUp() has previously been called
 * @param  {Function} cb     Invoke with cb(err, client) when startup complete
 */
var startRedisClient = function(ribbon, client, cb){
  var client = Redis.createClient(6379, 'localhost');

  client.on('ready', function(){
    // we don't get an error here, because 'error' would be emitted instead if there is an issue
    var err = null;
    // Pass the client to ribbon when startup has completed
    cb(err, client);
  });

  client.on('end', function(){
    ribbon.declareDown();
  });
};

// Set startRedisClient to run when redisRibbon.startUp() is called
redisRibbon.setStartUp(startRedisClient);
```

#### ribbon.startUp([cb])

Runs the already registered `fn`.

Example:

```javascript

redisRibbon.startUp(function(err, client){
  if (err) {
    // There was a problem. Handle it here - maybe a log or whatever
    return;
  }

  // Ready to go
});

```


### shutDown

Gracefully shuts down the client.

#### ribbon.setShutDown([fn])

Registers `fn` as the function to run when `ribbon.shutDown()` is called.

In `fn`, you gracefully shut down the client. This might involve stopping taking on new work, wait for current pending work to complete, and then closing down.

Example:

```javascript
var Redis = require('redis');
var Ribbon = require('Ribbon');
var redisRibbon = new Ribbon();

/**
 * shutDown function for the client.
 * Signature:
 * @param  {object}   ribbon Ribbon core
 * @param  {object}   client Your client
 * @param  {Function} cb     Invoke with cb(err) when shutDown complete
 */
var shutDownRedisClient = function(ribbon, client, cb){
  client.quit(cb);
};

// Set startRedisClient to run when redisRibbon.shutDown() is called
redisRibbon.setShutDown(shutDownRedisClient);
```

#### ribbon.shutDown([cb])

Runs the already registered `fn`.

Example:

```javascript

redisRibbon.shutDown(function(err, client){
  if (err) {
    // There was a problem. Handle it here - maybe a log or whatever
    return;
  }
});

```

### restart

Restarts the client.

The restart action does not require you to use `ribbon.setRestart(fn)` to assign a function to execute when `ribbon.restart()` is called. The default behaviour of `ribbon.restart()` is to run `ribbon.shutDown()` followed by `ribbon.startUp()`, but you can still set your own function in case there are special actions you must perform on the client in order to restart it.

#### ribbon.setRestart([fn])

Registers `fn` as the function to run when `ribbon.restart()` is called.

In `fn`, you implement logic required to restart the client.

Example:

```javascript
var Redis = require('redis');
var Ribbon = require('Ribbon');
var redisRibbon = new Ribbon();

/**
 * restart function for the client.
 * Signature:
 * @param  {object}   ribbon Ribbon core
 * @param  {object}   client Your client
 * @param  {Function} cb     Invoke with cb(err, client) when restart complete
 */
var restartRedisClient = function(ribbon, client, cb){
  client.quit(function(err){
    var newClient = Redis.createClient(6379, 'localhost');
    return cb(null, newClient);
  });
};

// Set startRedisClient to run when redisRibbon.restart() is called
redisRibbon.setRestart(restartRedisClient);
```

#### ribbon.restart([cb])

Runs `fn` if it is registered, otherwise runs `ribbon.shutDown()` followed by `ribbon.startUp()`.

Example:

```javascript

redisRibbon.restart(function(err){
  if (err) {
    // There was a problem. Handle it here - maybe a log or whatever
    return;
  }
});

```

### terminate

Kills the client.

#### ribbon.setTerminate([fn])

Registers `fn` as the function to run when `ribbon.terminate()` is called.

In `fn`, you immediately kill the client in a destructive way. This might involve destroying underlying connections even if there is working being done.

Example:

```javascript
var Redis = require('redis');
var Ribbon = require('Ribbon');
var redisRibbon = new Ribbon();

/**
 * terminate function for the client.
 * Signature:
 * @param  {object}   ribbon Ribbon core
 * @param  {object}   client Your client
 * @param  {Function} cb     Invoke with cb(err) when terminate complete
 */
var terminateRedisClient = function(ribbon, client, cb){
  client.quit(cb);
};

// Set startRedisClient to run when redisRibbon.terminate() is called
redisRibbon.setTerminate(terminateRedisClient);
```

#### ribbon.terminate([cb])

Runs the already registered `fn`.

Example:

```javascript

redisRibbon.terminate(function(err){
  if (err) {
    // There was a problem. Handle it here - maybe a log or whatever
    return;
  }
});

```

## State Interface

Use these methods when you want to notify ribbon of state changes in your client.

### ribbon.declareUp()

Declare that the client is available.

### ribbon.declareDown()

Declare that the client is unavailable.

### ribbon.declareDropped()

Declare that the client became unavailable unexpectedly.

## Query Interface

Ribbon has a bunch of convenient methods you can use to query the state of a client.

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

### client([client])

Sets ribbon's client object to `client` if given, otherwise returns ribbon's `client`.

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

## Integration examples

Check out the [integration examples](integrations/). You might find an integration already written for your module, or get inspiration for writing your own if not.

## Tests

Don't forget to ``npm install`` first.

```bash
make test
```
