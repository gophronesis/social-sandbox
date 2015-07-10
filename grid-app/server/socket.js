
module.exports = function(app, server, client, config) {
  var io    = require('socket.io').listen(server, { log : false });
  // var kafka = require('kafka-node');
  var _     = require('underscore');
  var Giver = require('./giver');

  // var config = {
  //   'KAFKA'      : '10.3.2.75:2181',
  //   'RAW_TOPIC'  : 'instagram'
  // }

  // // Kafka consumer
  // var Consumer = kafka.Consumer;
  //     kclient   = new kafka.Client(config['KAFKA']),
  //     consumer = new Consumer( kclient, [ 
  //       { topic: config['RAW_TOPIC'] }
  //     ], { autoCommit: true, fetchMaxBytes: 1024 * 100000} );

  io.sockets.on('connection', function(socket) {
    
    // Giver
    var giver = new Giver(client, socket, config);
    giver.set_dates(new Date('2015-04-01'), new Date('2015-04-30'));
    
    socket.on('stop_giver', function()  { giver.stop() });
    socket.on('start_giver', function() { giver.start() });
    
    // Initiating scraping
    socket.on('init_scrape', function() {
      console.log('initating scrape...')
      // STUB FOR JUSTIN
    })
    
    // Get list of existing scrapes
    socket.on('get_existing', function(callback) {
      console.log('get_existing')
      client.indices.getMapping({
        index : config['index']
      }).then(function(response) {
        callback({'types' : _.keys(response[config['index']]['mappings'])});
      });
    });
    
    socket.on('set_scrape', function(scrape_name, callback) {
      giver.set_scrape(scrape_name, function(scrape) {
        console.log('scrape', scrape);
        callback(scrape);
        // giver.start();
      });
    });
    
    
    
    socket.on('disconnect', function(){
      giver.stop();
    });
    
    // // Forward Kafka -> socket.io
    // consumer.on('message', function (message) {
    //     try {
    //       console.log('received message @', + new Date())
    //       if(message.topic == config['RAW_TOPIC']) {
    //         _([message.value]).flatten()
    //          .map(function(x) {
    //             socket.emit('raw', JSON.parse(x));
    //          });
    //       }
          
    //     } catch(e) {
    //       console.log(' ::: error on message ::: ', e);
    //     }
    // });
  });

}