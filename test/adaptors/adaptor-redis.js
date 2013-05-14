var adaptorTests = require('../adaptor-tests');

var opts = { client: { host: 'localhost'} };
adaptorTests('redis', require('../../lib/adaptors/redis/redis'), opts);
