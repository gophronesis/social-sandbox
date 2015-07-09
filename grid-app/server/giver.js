
var _ = require('underscore')._;

function Giver(client, socket) {
	
	this.client  = client;
	this.socket  = socket;
	
	this.start_date   = undefined;
	this.end_date     = undefined;
	this.current_date = undefined;
	this.interval     = 'day';
	
	this.running = true;
	
	this._process = undefined;
}

Giver.prototype.stop = function() {
	console.log('stopping giver...')
	this.running = false;
	clearInterval(this._process);
}

Giver.prototype.start = function() {
	console.log('starting giver...')
	this.running = true;
	this._process = this.give();
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
		}
		
		if(_this.current_date.getTime() == _this.end_date.getTime()) {
			_this.stop();
		}
		
	}, 500);
}

// Dates that the giver is iterating over
Giver.prototype.set_dates = function(start_date, end_date) {
	
	if(this.running) {
		this.stop();	
	}
	
	this.start_date   = start_date;
	this.end_date     = end_date;
	this.current_date = start_date;
}

Giver.prototype._next_period = function() {
	this.current_date = dateAdd(this.current_date, this.interval, 1);
	return this.current_date;
}

Giver.prototype.get_data = function(cb) {
	var _this = this;
	
	var query = {
		"_source" : ['gftime'],
		"query" : {
			"range" : {
				"gftime" : {
					"gte" : _this.current_date,
					"lte" : dateAdd(_this.current_date, _this.interval, 1)
				}
			}
		}
	}
	console.log(JSON.stringify(query));
	
	this.client.search({
		index : 'instagram',
		type  : 'baltimore',
		body  : query
	}).then(function(response) {
		cb({"close" : response.hits.total, "date" : _this.current_date});
	});
}

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

module.exports = Giver;