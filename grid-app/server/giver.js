
var _        = require('underscore')._;
var ngeohash = require('ngeohash');
var async    = require('async');

function Giver(client, socket, config) {
	
	this.index       = config.index;
	this.scrape_name = undefined,
	
	this.client = client;
	this.socket = socket;

	this.temp_bounds  = undefined;

	this.current_date = undefined;
	this.interval     = 'hour';
	
	this.grid_precision = 7;
	this.geo_bounds     = undefined
	
	this.running  = false;
	
	this._speed   = 500;
	this._process = undefined;
}

// Gets the parameters of a scrape
Giver.prototype.get_scrape = function(scrape_name, cb) {
	var query = {
		// "size" : 0,
		"aggs" : {
			"geo_bounds" : {
				"geo_bounds" : {
					"field" : "geoloc"
				}				
			},
			"temp_bounds" : {
				"stats" : {
					"field"	: "created_time"
				}
			}
		}
	}

	this.client.search({
		index      : this.index,
		type       : scrape_name,
		body       : query,
        searchType : "count",
        queryCache : true
	}).then(function(response) {
		// Response
		cb({
			"scrape_name" : scrape_name,
			"geo_bounds"  : response.aggregations.geo_bounds.bounds,
			"temp_bounds" : {
				"start_date" : response.aggregations.temp_bounds.min_as_string,
				"end_date"   : response.aggregations.temp_bounds.max_as_string
			}
		});
	})
}

// Gets the parameters of a scrape and saves the state
Giver.prototype.set_scrape = function(scrape_name, cb) {
	var _this = this;
	
	this.get_scrape(scrape_name, function(response) {
		
		_this.scrape_name = scrape_name;	
		// Set parameters
		_this.geo_bounds = response.geo_bounds;
		
		// console.log('new Date(response.aggregations.temp_bounds.max_as_string)',)
		_this.set_temp_bounds({
			"start_date" : new Date(response.temp_bounds.start_date),
			"end_date"   : new Date(response.temp_bounds.end_date)
		});
		
		cb(response)

	})
}

Giver.prototype.start = function(scrape_obj) {
	var _this = this;
	this.scrape_name = scrape_obj.scrape_name;
	if(this.scrape_name) {
		console.log('starting giver...')
		this.running  = true;
		this._process = this.give();		
	} else {
		console.log('!!! no scrape set yet !!!')
	}
}

Giver.prototype.stop = function() {
	console.log('stopping giver...')
	this.running = false;
	clearInterval(this._process);
}

// giving function
Giver.prototype.give = function() {
	var _this = this;
	return setInterval(function() {
		
		if(_this.running) {
			_this._next_period();
			console.log('giver giving :: ', _this.current_date);
			_this.get_data(function(data) {
				_this.socket.emit('give', data)	
			});
			// _this.get_grid_data(function(data) {
			// 	_this.socket.emit('give', data)	
			// });
		}
		
		if(_this.current_date.getTime() >= _this.temp_bounds.end_date.getTime()) {
			_this.stop();
		}
		
	}, _this._speed);
}

// Dates that the giver is iterating over
Giver.prototype.set_temp_bounds = function(temp_bounds) {
	
	if(this.running) {
		this.stop();	
	}
	
	this.temp_bounds  = temp_bounds;
	this.current_date = temp_bounds.start_date;
	return true;
}

// Time resolution of giver
Giver.prototype.set_interval = function(interval) {
	if(this.running) {
		this.stop();
	}
	
	this.interval = interval;
	return true;
}

Giver.prototype._next_period = function() {
	this.current_date = dateAdd(this.current_date, this.interval, 1);
	return this.current_date;
}

// Data playback
Giver.prototype.get_data = function(cb) {
	var _this = this;
	
	async.parallel([
		_this.get_ts_data.bind(_this),
		_this.get_grid_data.bind(_this),
		_this.get_image_data.bind(_this)
	], function (err, results) {
		// Combine results
		cb(
			_.reduce(results, function(a, b) {return _.extend(a, b)}, {})
		)
	})
}

Giver.prototype.get_ts_data = function(cb) {
	var _this = this;
	console.log(_this.current_date)
	var query = {
		"_source" : ['created_time'],
		"query" : {
			"range" : {
				"created_time" : {
					"gte" : _this.current_date,
					"lte" : dateAdd(_this.current_date, _this.interval, 1)
				}
			}
		}
	}
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		console.log(response);
		cb(null, {"count" : response.hits.total, "date" : _this.current_date});
	});
}

Giver.prototype.get_image_data = function(cb) {
	var _this = this;
	
	var query = {
		"query" : {
			"range" : {
				"created_time" : {
					"gte" : _this.current_date,
					"lte" : dateAdd(_this.current_date, _this.interval, 1)
				}
			}
		}
	}
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		var out = _.chain(response.hits.hits).map(function(hit) {
			return {
				'loc' : {
					'lat' : hit._source.location.latitude,
					'lon' : hit._source.location.longitude,
				},
				'img_url' : hit._source.images.low_resolution.url,
				'id'      : hit._source.id,
				'link'    : hit._source.link,
				'user'    : hit._source.user.username
			}
		}).value()
		cb(null, {'images' : out});
	});
}

Giver.prototype.get_grid_data = function(cb) {
	
	var query = {
		// "size" : 0,
		"query": {
			"filtered": {
				"query" : {
					"range" : {
						"created_time" : {
							"gte" : this.current_date,
							"lte" : dateAdd(this.current_date, this.interval, 1)							
						}
					}
				},
				"filter": {
					"geo_bounding_box": {
						"geoloc": this.geo_bounds
					}
				}
			}
		},
		"aggs": {
			"locs": {
				"geohash_grid": {
					"field"     : "geoloc",
					"precision" : this.grid_precision,
					"size"      : 10000
				}
			}
		}
	}
		
	//console.log(JSON.stringify(query));
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query,
        searchType : "count",
        queryCache : true
	}).then(function(response) {
		var buckets = response.aggregations.locs.buckets;
		var out     = _.map(buckets, function(x) { return geohash_to_geojson(x['key'], {'count' : x['doc_count']}); })
		console.log(out);
		cb(null, {'grid' : {"type" : "FeatureCollection", "features" : out}});
	});
}

// All of the data from a given area
Giver.prototype.analyze_area = function(area, cb) {
	var _this = this;
	
	async.parallel([
		function() {
			this.analyze_ts_data(area, cb)
		}.bind(_this),
	], function (err, results) {
		cb(
			_.reduce(results, function(a, b) {return _.extend(a, b)}, {})
		)
	})
}

Giver.prototype.analyze_ts_data = function(area, cb) {
	
	console.log('area', area);
	
	// Convert date formats if necessary
	if(area._southWest) {
		area = leaflet2elasticsearch(area)
	}
	
	var query = {
		// "size" : 0,
		"query": {
			"filtered": {
				"query" : {
					"range" : {
						"created_time" : {
							"gte" : this.temp_bounds.start_date,
							"lte" : this.temp_bounds.end_date
						}
					}
				},
				"filter": {
					"geo_bounding_box": {
						"geoloc" : area
					}
				}
			}
		},
		"aggs" : {
			"timeseries" : {
				"date_histogram" : {
					"field"    : "created_time",
					"interval" : this.interval
				}
			}
		}
	}
	
	console.log(this.scrape_name);
	console.log(JSON.stringify(query));
	
	this.client.search({
		index      : this.index,
		type       : this.scrape_name,
		body       : query,
        searchType : "count",
        queryCache : true
	}).then(function(response) {
		console.log('response', response.aggregations.timeseries);
		cb(null, {'timeseries' : response.aggregations.timeseries.buckets});
	});

}



// ---- Helper functions -----

function dateAdd(date, interval, units) {
  var ret = new Date(date); //don't change original date
  switch(interval.toLowerCase()) {
    case 'year'   :  ret.setFullYear(ret.getFullYear() + units);  break;
    case 'quarter':  ret.setMonth(ret.getMonth() + 3*units);  break;
    case 'month'  :  ret.setMonth(ret.getMonth() + units);  break;
    case 'week'   :  ret.setDate(ret.getDate() + 7*units);  break;
    case 'day'    :  ret.setDate(ret.getDate() + units);  break;
    case 'hour'   :  ret.setTime(ret.getTime() + units*3600000);  break;
    case 'minute' :  ret.setTime(ret.getTime() + units*60000);  break;
    case 'second' :  ret.setTime(ret.getTime() + units*1000);  break;
    default       :  ret = undefined;  break;
  }
  return ret;
}

function geohash_to_geojson(hash, props) {
	// props = props | {};
	
	var data1 = ngeohash.decode_bbox(hash)
	
	// Convert geohash format to d3 path format
	var datas = []
	for(i = 0; i <= data1.length; i++) {
		var tmp = [data1[i%data1.length], data1[(i+1)%data1.length]]
		if(i%2 == 0) {
			tmp.reverse()
		}
		datas.push(tmp)
	}
	
	return {
		"type" : "Feature",
		"geometry" : {
			"type" : "Polygon",
			"coordinates" : [datas]
		},
		"properties" : props
	}
}

function leaflet2elasticsearch(leaflet_bounds) {
	return {
		"bottom_right" : {
			"lat" : leaflet_bounds._southWest.lat, 
			"lon" : leaflet_bounds._northEast.lng
		},
		"top_left" : {
			"lat" : leaflet_bounds._northEast.lat,
			"lon" : leaflet_bounds._southWest.lng
		}
	}
}

module.exports = Giver;