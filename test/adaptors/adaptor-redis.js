var adaptorTests = require('../adaptor-tests');

var adaptorName = 'redis';
var opts = { client: { host: 'localhost'} };
adaptorTests(adaptorName, opts);
