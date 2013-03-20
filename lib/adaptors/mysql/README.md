# MySQL adaptor

Interfaces node-mysql to ribbon.

## Interface

### Methods

#### .connect()

Establish connection to a MySQL server, and track with ribbon's up/down events.

#### .disconnect()

Terminate MySQL connection

### Events

node-mysql | adaptor
---------  | -------
'close', 'error', 'end'    |  'down'