/* global require, module */

var EmberApp = require('ember-cli/lib/broccoli/ember-app');

var app = new EmberApp();

// -------------------
// <import-dependencies>

app.import('bower_components/bootstrap/dist/js/bootstrap.js');
app.import('bower_components/bootstrap/dist/css/bootstrap.css');

app.import('bower_components/font-awesome/css/font-awesome.min.css');

app.import({
  development : 'bower_components/underscore/underscore.js',
  production  : 'bower_components/underscore/underscore.min.js'
}, {
  'underscore': [
  	'default'
  ]
});

app.import('bower_components/leaflet/dist/leaflet.js');
app.import('bower_components/leaflet/dist/leaflet.css');

app.import('bower_components/d3/d3.min.js')	;

app.import('bower_components/rickshaw/rickshaw.js');
app.import('bower_components/rickshaw/rickshaw.css');

app.import('bower_components/socket.io-client/socket.io.js');

app.import('bower_components/jquery-ui/jquery-ui.min.js')

app.import('bower_components/leaflet-d3/dist/leaflet-d3.js');
app.import('bower_components/d3-cloud/d3.layout.cloud.js');

// </import-dependencies>	
// -------------------


module.exports = app.toTree();
