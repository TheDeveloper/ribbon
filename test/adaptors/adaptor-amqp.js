var adaptorTests = require('../adaptor-tests');
var adaptor = require('../../lib/adaptors/amqp/amqp');

var opts = { client: { host: 'localhost'} };
adaptorTests('amqp', adaptor, opts);
