var express = require('express'),
        app = express(),
     server = require('http').createServer(app),
         io = require('socket.io').listen(server, {
            origins:'http://localhost:* localhost:*',
            log : false
        }),
       path = require('path'),
          _ = require('underscore')._,
      kafka = require('kafka-node'),
    pshell  = require('python-shell');

app.all('*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// Load configuration
var config = require('fs').readFileSync('../config.json', 'utf-8');
var config = JSON.parse(config);

// Kafka consumer
var Consumer = kafka.Consumer;
    client   = new kafka.Client(config['KAFKA']),
    consumer = new Consumer( client, [ 
      { topic: config['RAW_TOPIC'] },
      { topic: config['PROC_TOPIC'] }
    ], { autoCommit: true, fetchMaxBytes: 1024 * 100000} );

// Serve static content
// app.use('/', express.static(__dirname));

// Each time someone connects, execute
io.sockets.on('connection', function(socket) {
  console.log('-- got connection --');
      
  // Playback streak (only for dev)
  console.log('-- starting stream -- ');
  stream_playback(app, config);
  
  console.log('-- registering handler --');
  handle_message(consumer, socket);    
});

// Start server
server.listen(3000, function() {
  console.log("Started a server on port 3000");
});

// Read from Kafka queue
function handle_message(consumer, socket) {

    consumer.on('message', function (message) {
        try {
          
          // Emitting events for RAW data
          if(message.topic == config['RAW_TOPIC']) {
            _([message.value]).flatten()
             .map(function(x) {
                socket.emit('raw', JSON.parse(x));
             });
          
          // Emitting events for PROCESSED data
          } else if(message.topic == config['PROC_TOPIC']) {
            console.log('processed message', message)
            _([message.value]).flatten()
             .map(function(x) {
                socket.emit('processed', JSON.parse(x));
             });
                          
          }
          
        } catch(e) {
          console.log('!!! cannot read from socket !!! ', e);
        }
    });

}

// !!!! HACK !!!!
// This doesn't work with multiple users -- it just triggers a Python script that
// writes to a (universal) Kafka topic each time a user connects to the site.
// Presumably the fix is to have a script that writes to a __different__ topic for each user.
function stream_playback(app, config) {
  pshell.run('fake-stream.py', {args : ['../config.json']}, function (err, response) {
    if (err) throw err;
    console.log(' >> finishing stream >>', response);
  });
}
