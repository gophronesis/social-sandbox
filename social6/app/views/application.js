/* global L */

import Ember from 'ember';

export default Ember.View.extend({
	
	// Call things that we want to be executed once the page is loaded
	// here.
	didInsertElement : function() {
		var con = this.get('controller');

		// setup map and add layers
		var baseLayer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/cwhong.map-hziyh867/{z}/{x}/{y}.png', {
		  attribution : "",
		  maxZoom     : 18
		});
		con.set('baseLayer', baseLayer);

		var map = new L.Map('map', {
		  center : new L.LatLng(39.2833, -76.6167),
		  zoom   : 13,
		  layers : [baseLayer]
		});
		con.set('map', map);
		
		// 'Raw' ping layer
		var pingLayer_raw = L.pingLayer({
		    lng: function(d){ return d[0]; },
		    lat: function(d){ return d[1]; },
		    duration: 1000,
		    efficient: {
		        enabled: false,
		        fps: 8
		    }
		});
		pingLayer_raw.radiusScale().range([0, 5]);
		pingLayer_raw.opacityScale().range([1, 0]);
		pingLayer_raw.addTo(map);
		con.set('pingLayer_raw', pingLayer_raw);
		
		// 'Processed' ping layer
		var pingLayer_processed = L.pingLayer({
		    lng: function(d){ console.log('lng', d[0]); return d[0]; },
		    lat: function(d){ return d[1]; },
		    duration: 3000,
		    efficient: {
		        enabled: false,
		        fps: 8
		    }
		});
		pingLayer_processed.radiusScale().range([0, 20]);
		pingLayer_processed.opacityScale().range([0, 0.5]);
		pingLayer_processed.addTo(map);
		con.set('pingLayer_processed', pingLayer_processed);
	}
});
