module.exports = function(app, client) {

    var _        = require('underscore')._;
   	var ngeohash = require('ngeohash');
   	
    app.post('/get_data', function(req, res) {

    	client.search({
    		index : 'instagram',
    		type  : 'baltimore',
    		searchType : 'count',
    		body  : {
    			"query": {
    				"filtered": {
    					"filter": {
    						"geo_bounding_box": {
    							"gfloc": {
    								"top_left": {
    									"lat": 39.3833 ,
    									"lon":  -76.71669999999999
    								},
    								"bottom_right": {
    									"lat": 39.183299999999996,
    									"lon": -76.5167
    								}
    							}
    						}
    					}
    				}
    			},
    			"aggs": {
    				"locs": {
    					"geohash_grid": {
    						"field"     : "gfloc",
    						"precision" : 7,
    						"size"      : 10000
    					},
    					"aggs" : {
    						"time" : {
    							"date_histogram" : {
    								"field"    : "gftime",
    								"interval" : "day"
    							}
    						}
    					}
    				}
    			}
    		}
    	}).then(function(response) {
    		var buckets = response['aggregations']['locs']['buckets'];

    		// This has to go first
    		var utimes = _.unique(_.flatten(_.map(buckets, function(x) {
    			return _.pluck(x['time']['buckets'], 'key')
    		})))
    		utimes.sort()
    		
    		var data = _.map(buckets, function(x) {
    			var pos = ngeohash.decode_bbox(x['key']);
    			x['pos']  = [{'y' : pos[2], 'x' : pos[1]}, {'y' : pos[0], 'x' : pos[3]}]
    			x['time'] = x['time']['buckets']
    			return x
    		})
    		
    		res.send({'data' : data, 'utimes' : utimes})
    	})
    });
       
}