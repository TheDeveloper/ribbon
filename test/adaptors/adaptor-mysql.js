var adaptorTests = require('../adaptor-tests');

var adaptorName = 'mysql';
var opts = { client: { host: 'localhost'} };
adaptorTests(adaptorName, opts);
