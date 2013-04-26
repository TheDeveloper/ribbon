var adaptorTests = require('../adaptor-tests');

var adaptorName = 'amqp';
var opts = { client: { host: 'localhost'} };
adaptorTests(adaptorName, opts);
