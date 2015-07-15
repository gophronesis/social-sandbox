
var _        = require('underscore')._;
var ngeohash = require('ngeohash');
var async    = require('async');
var helpers  = require('./helpers');

function Giver(client, socket, index) {
	
	this.index       = index;
	this.scrape_name = undefined,
	
	this.client = client;
	this.socket = socket;

	this.temp_bounds  = undefined;

	this.current_date     = undefined;

	this.interval          = 'hour'; // Units
	this.trailing_interval = 1;      // Number of `intervals` backwards we search
	this.every_interval    = 1;      // Number of `intervals` we skip at a time
	
	this.grid_precision = 6;
	this.geo_bounds     = undefined
	
	this.running  = false;	
	
	// Private variables
	this._speed   = 1000;
	this._process = undefined;
}

// <set-scrape>
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
		
		_this.set_temp_bounds({
			"start_date" : new Date(response.temp_bounds.start_date),
			"end_date"   : new Date(response.temp_bounds.end_date)
		});
		
		cb(response)

	})
}
// </set-scrape>

// <runners>
Giver.prototype.start = function() {
	var _this = this;
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
	this._process = undefined;
}

Giver.prototype.restart = function() {
	this.stop();
	this.start();
}

Giver.prototype.go_live = function() {
	this.live = true;
	this.restart();
}

Giver.prototype._next_period = function() {
	this.current_date = helpers.dateAdd(this.current_date, this.interval, this.every_interval);
	return this.current_date;
}
// </runners>

// giving function
Giver.prototype.give = function() {
	var _this = this;
	return setInterval(function() {
		
		if(_this.running) {
			_this._next_period();
			console.log('giver.give :: ', _this.current_date);
			_this.get_data(function(data) {
				_this.socket.emit('give', data)	
			});
			// _this.get_grid_data(function(data) {
			// 	_this.socket.emit('give', data)	
			// });
		}
		
		if(!_this.live) {
			if(_this.current_date.getTime() >= _this.temp_bounds.end_date.getTime()) {
				_this.stop();
			}			
		} else {
			console.log('giver.give (live) :: further along in time than most recent record!');
		}
		
	}, _this._speed);
}


// Data playback
Giver.prototype.get_data = function(cb) {
	var _this = this;
	
	async.parallel([
		_this.get_ts_data.bind(_this),
		_this.get_grid_data.bind(_this),
		_this.get_image_data.bind(_this),
		_this.get_trending.bind(_this)
	], function (err, results) {
		// Combine results
		cb(_.reduce(results, function(a, b) {return _.extend(a, b)}, {}))
	});
}

// <setters>
// Dates that the giver is iterating over
Giver.prototype.set_temp_bounds = function(temp_bounds) {
	this.stop();
	this.temp_bounds  = temp_bounds;
	this.current_date = temp_bounds.start_date;
	return true;
}

// Time resolution of giver
Giver.prototype.set_interval = function(interval) {
	this.stop();
	this.interval = interval;
	return true;
}
// </setters>


// Top users up through the end of this time period
Giver.prototype.get_trending = function(cb) {
	var _this = this;
	
	const INTERVAL = "hour";
	
	var query = {
		"query" : {
			"range" : {
				"created_time" : {
					"lte" : _this.current_date
				}
			}
		},
		"aggs" : {
			"users" : {
				"terms" : {
					"field"        : "user.username",
					"size"         : 5,
					"collect_mode" : "breadth_first"
				},
				"aggs" : {
					"timeseries" : {
						"date_histogram" : {
							"field" : "created_time",
							// "interval" : this.interval
							"interval" : INTERVAL // HARDCODING TO DAY INTERVAL FOR NOW
						}
					}
				}
			},
			"tags" : {
				"terms" : {
					"field"        : "tags",
					"size"         : 5,
					"collect_mode" : "breadth_first"
				},
				"aggs" : {
					"timeseries" : {
						"date_histogram" : {
							"field" : "created_time",
							// "interval" : this.interval
							"interval" : INTERVAL // HARDCODING TO DAY INTERVAL FOR NOW
						}
					}
				}
			}
		}
	}
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		console.log('response.aggregations.tags.buckets', response.aggregations.tags.buckets);
		cb(null, {
			'users' : terms_timeseries(response.aggregations.users.buckets),
			'tags'  : terms_timeseries(response.aggregations.tags.buckets)
		});
	});
}

Giver.prototype.get_ts_data = function(cb) {
	var _this = this;
	var query = {
		"_source" : ['created_time'],
		"query" : {
			"range" : {
				"created_time" : {
					"gte" : helpers.dateAdd(_this.current_date, _this.interval, - _this.trailing_interval),
					"lte" : _this.current_date
				}
			}
		}
	}
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		cb(null, {"count" : response.hits.total, "date" : _this.current_date});
	});
}

Giver.prototype.get_image_data = function(cb) {
	var _this = this;
	var query = {
		"query" : {
			"range" : {
				"created_time" : {
					"gte" : helpers.dateAdd(_this.current_date, _this.interval, - _this.trailing_interval),
					"lte" : _this.current_date
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
							"gte" : helpers.dateAdd(this.current_date, this.interval, - this.trailing_interval),
							"lte" : this.current_date
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
		var out     = _.map(buckets, function(x) { return helpers.geohash2geojson(x['key'], {'count' : x['doc_count']}); })
		cb(null, {'grid' : {"type" : "FeatureCollection", "features" : out}});
	});
}

// All of the data from a given area
Giver.prototype.analyze_area = function(area, cb) {
	var _this = this;
	
	// Convert date formats if necessary
	if(area._southWest) {
		area = helpers.leaflet2elasticsearch(area)
	}

	async.parallel([
		_this.analyze_ts_data.bind(_this, area),
		_this.analyze_grid_data.bind(_this, area)
	], function (err, results) {
		cb(
			_.reduce(results, function(a, b) {return _.extend(a, b)}, {})
		)
	})
}

// This repeats get_grid_data pretty heavily
Giver.prototype.analyze_grid_data = function(area, cb) {
	
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
						"geoloc": area
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
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query,
        searchType : "count",
        queryCache : true
	}).then(function(response) {
		var buckets = response.aggregations.locs.buckets;
		var out     = _.map(buckets, function(x) { return helpers.geohash2geojson(x['key'], {'count' : x['doc_count']}); })
		cb(null, {'grid' : {"type" : "FeatureCollection", "features" : out}});
	});
}

Giver.prototype.analyze_ts_data = function(area, cb) {
		
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
					// "interval" : this.interval
					"interval" : "day" // HARDCODING TO DAY INTERVAL FOR NOW
				}
			}
		}
	}
		
	this.client.search({
		index      : this.index,
		type       : this.scrape_name,
		body       : query,
        searchType : "count",
        queryCache : true
	}).then(function(response) {
		var timeseries = _(response.aggregations.timeseries.buckets)
							.map(function(x) {
								return {
									'count' : x['doc_count'],
									'date'  : x['key_as_string']
								}
							});
		
		cb(null, {'timeseries' : timeseries});
	});
}

// ---- Processing functions ----
function terms_timeseries(x) {
	return _.map(x, function(b) {
		console.log(b.key);
		return {
			"key" : b.key,
			"timeseries" : _.map(b.timeseries.buckets, function(x) {
				return {
					'count' : x['doc_count'],
					'date'  : x['key_as_string']
				}
			})
		}
	});
}

// ---- Helper functions -----

module.exports = Giver;
