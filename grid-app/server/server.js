
// Dependencies
var es = require('elasticsearch'),
	_  = require('underscore')._;

// Express server
var express = require('express'),
    app     = express();

app.use(require('body-parser').json());
    
// Headers
app.all('*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-Access-Token, Content-Type');
    res.header('Access-Control-Allow-Methods', 'POST, GET, DELETE');
    res.header('X-Content-Type-Options', 'nosniff');
    next();
});
        
// Static content (needs to be before authentication, otherwise it'll get blocked)
app.use('/', express.static('../web'));
    
// Setup routes
var client = new es.Client({hosts : ['http://localhost:9205']});

require('./routes.js')(app, client);

console.log('starting server...')
app.listen(8111, '0.0.0.0');