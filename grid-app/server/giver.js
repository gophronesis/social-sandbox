
var _        = require('underscore')._;
var ngeohash = require('ngeohash');
var async    = require('async');

function Giver(client, socket, config) {
	
	this.index       = config.index;
	this.scrape_name = undefined,
	
	this.client = client;
	this.socket = socket;
	
	this.start_date   = undefined;
	this.end_date     = undefined;
	this.current_date = undefined;
	this.interval     = 'hour';
	
	this.grid_precision = 7;
	this.bounds         = undefined
	
	this.running  = false;
	
	this._speed   = 500;
	this._process = undefined;
}

Giver.prototype.set_scrape = function(scrape_name, cb) {
	var _this = this;
	this.scrape_name = scrape_name;
	
	var query = {
		"aggs" : {
			"geo_bounds" : {
				"geo_bounds" : {
					"field" : "geoloc"
				}				
			}
		}
	}
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query,
		searchType : "count"
	}).then(function(response) {
		console.log(response)
		_this.bounds = response.aggregations.geo_bounds.bounds;
		cb({
			"scrape_name" : _this.scrape_name,
			"bounds"      : response.aggregations.geo_bounds.bounds
		});
	});
}

Giver.prototype.start = function() {
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
		
		if(_this.current_date.getTime() == _this.end_date.getTime()) {
			_this.stop();
		}
		
	}, _this._speed);
}

// Dates that the giver is iterating over
Giver.prototype.set_dates = function(start_date, end_date) {
	
	if(this.running) {
		this.stop();	
	}
	
	this.start_date   = start_date;
	this.end_date     = end_date;
	this.current_date = start_date;
	return true;
}

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
				'id'      : hit._source.id
			}
		}).value()
		cb(null, {'images' : out});
	});
}

Giver.prototype.get_grid_data = function(cb) {
	
	var query = {
		"size" : 0,
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
						"geoloc": this.bounds
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
		
	console.log(JSON.stringify(query));
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		var buckets = response.aggregations.locs.buckets;
		var out     = _.map(buckets, function(x) { return geohash_to_geojson(x['key'], {'count' : x['doc_count']}); })
		console.log(out);
		cb(null, {'grid' : {"type" : "FeatureCollection", "features" : out}});
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


module.exports = Giver;