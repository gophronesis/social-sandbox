var express = require('express'),
        app = express(),
     server = require('http').createServer(app),
         io = require('socket.io').listen(server, { log : false }),
       path = require('path'),
          _ = require('underscore')._,
      kafka = require('kafka-node');

var config = {
  'KAFKA'      : 'localhost:2181',
  'RAW_TOPIC'  : 'throwaway',
  'PROC_TOPIC' : 'instacounts'
}

// Kafka consumer
var Consumer = kafka.Consumer;
    client   = new kafka.Client(config['KAFKA']),
    consumer = new Consumer( client, [ 
      { topic: config['RAW_TOPIC'] },
      { topic: config['PROC_TOPIC'] }
    ], { autoCommit: true, fetchMaxBytes: 1024 * 100000} );

// io.sockets.on('connection', function(socket) {

  // Forward Kafka -> socket.io
  consumer.on('message', function (message) {
      try {
        
        if(message.topic == config['RAW_TOPIC']) {
          // _([message.value]).flatten()
          //  .map(function(x) {
          //     socket.emit('raw', JSON.parse(x));
          //  });
          
        } else if(message.topic == config['PROC_TOPIC']) {
          console.log('message', message)
          // _([message.value]).flatten()
          //  .map(function(x) {
          //     socket.emit('proc', JSON.parse(x));
          //  });
           
        }
        
      } catch(e) {
        console.log('>>> cannot parse json >>> ', e);
      }
  });

// });


// Serve static content
app.use('/', express.static(__dirname));

// Start server
server.listen(3000, function() {
  console.log("Started a server on port 3000");
});

