
// Dependencies
var es = require('elasticsearch'),
	_  = require('underscore')._;

// Express server
var express = require('express'),
    app     = express();
     server = require('http').createServer(app);

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
var config = {
	'es_path' : 'http://10.1.94.103:9200',
	'index'   : 'instagram_remap'
}

var client = new es.Client({hosts : [config.es_path]});

// require('./routes.js')(app, client, config);
require('./socket.js')(app, server, client, config);

server.listen(3000, function() {
  console.log("Started a server on port 3000");
});
