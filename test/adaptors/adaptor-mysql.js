var adaptorTests = require('../adaptor-tests');

var opts = { client: { host: 'localhost'} };
adaptorTests('mysql', require('../../lib/adaptors/mysql/mysql'), opts);
