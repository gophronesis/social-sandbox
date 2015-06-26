/* global _ */
/* global L */

import Ember from 'ember';

export default Ember.Controller.extend({
	
	pingLayer_raw       : undefined,
	pingLayer_processed : undefined,
	
	actions : {
		raw_handler : function(data) {
			var _this = this;
			try {
				_.map(data, function(d) {
					
				  // Ping on layer
				  _this.get('pingLayer_raw').ping([d.location.longitude, d.location.latitude]);
				  
				  // Add text
				  Ember.$('#created_time').text(new Date(parseInt(d.created_time) * 1000));

				  // Simple streaming sidebar
				  Ember.$('.streaming-sidebar').prepend('<div>' + d.user.username + ' @ ' + d.created_time + '</div>');
				  if(Ember.$('.streaming-sidebar').children().length > 40) {
				    Ember.$('.streaming-sidebar div').last().remove();
				  }
				  
				});    
			} catch(e) {
				console.log('cannot add point!');
			}
		},
		
		processed_handler : function(data) {
		  this.get('pingLayer_processed').ping(data.loc);
		}			
	}

});