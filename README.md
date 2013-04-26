# Ribbon
A lightweight wrapper around external services and connections to help monitor and respond to changes in availability in a consistent, predictable manner.

It provides a standard set of events and methods for use in your applications to react to and verify the status of external services, as an alternative to dealing with various different terminology and definitions for common state events, such as:

* Connection up events: 'connected', 'connect', 'open', 'up', 'ready'
* Connection closed / unavailable events: 'disconnected', 'disconnect', 'close', 'end', 'error', 'down', 'b0rked'

Ribbon instead exposes a set of standard events, such as simply 'up' for connection available, and 'down' for connection unavailable.

## Adaptors

Ribbon includes a collection of _adaptors_ which inherit the ribbon interface. An adaptor is a controller for your underlying connection or service, known as the _client_. The adaptor is the interface between the service's client and ribbon.

Adaptors can be found in the [lib/adaptors](lib/adaptors) folder.

---

#### Currently available adaptors:

* **mysql** - for [node-mysql][node-mysql]
* **redis** - for [node-redis][node-redis]
* **amqp** - for [node-amqp][node-amqp]
* **mongodb** - coming soon

Of course, it is possible to develop your own. See existing adaptors in [lib/adaptors](lib/adaptors) for examples and inspiration.

---

## Usage


```javascript
var Ribbon = require('ribbon');
var mysqlOpts = {
  client: {
    host: 'localhost'
  }
};

var mysql = Ribbon.wrap('mysql', mysqlOpts);
mysql.startUp(function(err){
	if(err){
		// Boo.. we couldn't connect
		return false;
	}
	// Otherwise yay, go do some stuff
});

// Elsewhere in your application…
mysql.on('up', function(){
	// Your application knows when the connection is up when this callback is invoked
});

mysql.on('down', function(){
	// Drats, we lost connection. Disable querying until we get the 'up' event
});

if(mysql.isUp()){
	// Should be ready to query
}

if(mysql.isDown()){
	// We should probably wait until we get the next 'up' or 'revived' event
}

mysql.restart(function(){
  // Shut down, then start up again
});

mysql.shutDown(function(err){
  // Stuff to do after shutdown
});

mysql.destroy(function(){
  // Forcefully shut down
});

```

In this example, we are using the 'mysql' adaptor, which interfaces Felix Geisendörfer's [node-mysql][node-mysql] as the client.

---

When creating an instance of ribbon, you specify which adaptor to use:

```javascript
var ribbon = Ribbon.wrap(adaptor, adaptorOptions);
```

`ribbon` is now an instance of ribbon, wired up with the adaptor's methods

## Interface

### Events

`ribbon` is an EventEmitter, and emits the following:

#### 'up'

The adaptor's client has become available for use.

#### 'down'

The adaptor's client is unavailable due to an underlying problem, and should not be used.

#### 'revived'

The adaptor's client was unavailable but has now become available once again.

#### 'dropped'

The adaptor's client has dropped out unexpectedly and is now unavailable.

### Methods

#### isUp()
Boolean: true if up, false if down.

#### isDown()
Boolean: true if down, false if up.

#### wasUp()
Boolean: true if connection was previously up but is now down.

#### wasDown()
Boolean: true if connection was previously down but is now up.

## Tests

Don't forget to ``npm install``

```bash
make test
```

## What's next?

At the moment, this module is a bit of a dumping ground for ribbon adaptors. The adaptors and their dependencies shouldn't be part of this repository, but instead be pluggable externally. They are in here for now for convenience and ease of use, but I intend to break them out to keep the ribbon module itself lightweight and avoid installing unnacessary baggage.

[node-mysql]: https://github.com/felixge/node-mysql
[node-redis]: https://github.com/mranney/node_redis
[node-amqp]: https://github.com/postwait/node-amqp
