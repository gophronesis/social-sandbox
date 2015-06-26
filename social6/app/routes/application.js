import Ember from 'ember';

export default Ember.Route.extend({

	model : function() {
		return io.connect('http://localhost:3000');
	},

	setupController : function(con, model) {
		// Listen on socket
		
		model.on('raw', function(data) {
			con.send('raw_handler', data);
		});
		
		model.on('processed', function(data) {
			con.send('processed_handler', data)
		});
		
		con.set('model', model);
	}
});
