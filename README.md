# Ribbon
A lightweight wrapper around external services and connections to help monitor and respond to changes in availability in a consistent, predictable manner.

It provides a standard set of events and methods for use in your applications to react to and verify the status of external services, as an alternative to dealing with various different terminology and definitions for common state events, such as:

* Connection up events: 'connected', 'connect', 'open', 'up', 'ready'
* Connection closed / unavailable events: 'disconnected', 'disconnect', 'close', 'end', 'error', 'down', 'b0rked'

Ribbon instead exposes a set of standard events, such as simply 'up' for connection available, and 'down' for connection unavailable.

## Adaptors

Ribbon includes a collection of _adaptors_ which inherit the ribbon interface. An adaptor is a controller for your underlying connection or service, known as the _client_. The adaptor is the interface between the service's client and ribbon.

Adaptors can be found in the [lib/adaptors](lib/adaptors) folder, and each should have its own README.

---

#### Current adaptors:

* **mysql** - for [node-mysql][node-mysql]
* **redis** - coming soon - for node-redis
* **amqp** - coming soon - for node-amqp

---

## Usage


```javascript
var ribbon = require('ribbon');
var mysql = ribbon.wrap('mysql', mysqlOpts);
mysql.connect(function(err){
	if(err){
		// Boo.. we couldn't connect
		return false;
	}
	// Otherwise yay
});
```

In this example, we are using the 'mysql' adaptor, which interfaces Felix Geisendörfer's [node-mysql][node-mysql] as the client.

---

When creating an instance of ribbon, you specify which adaptor to use:

```javascript
var adaptor = ribbon.wrap(adaptor, adaptorOptions);
```

``adaptor`` is now an instance of the adaptor, which inherits the standard ribbon events and interface.

## Inteface

### Events

``adaptor`` is an EventEmitter, and emits the following:

#### 'up'

The adaptor's client has become available for use.

#### 'down'
The adaptor's client is unavailable due to an underlying problem, and should not be used.

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

[node-mysql]: https://github.com/felixge/node-mysql