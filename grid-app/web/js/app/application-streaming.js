
// var boxes_to_names = {};

var current_scrape_obj = undefined;

$(document).ready(function() {
// <draw-map>
	var baseLayer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/cwhong.map-hziyh867/{z}/{x}/{y}.png', {
	  attribution : "Social Sandbox",
	  maxZoom     : 18
	});

	var map = new L.Map('map', {
	  center : new L.LatLng(0,0),
	  zoom   : 2,
	  layers : [baseLayer]
	});

	var drawnItems = new L.FeatureGroup();
	map.addLayer(drawnItems);	
	
	function make_drawControl() {
		// Draw controls
		var drawControl = new L.Control.Draw({
			edit: {
				featureGroup: drawnItems
			},
			draw : {
				polyline : false,
				polygon  : false,
				circle   : false,
				marker   : false,
				rectangle : {
					shapeOptions : {
						color : "green",
						fillOpacity : .05
					}
				}
			}
		});
		map.addControl(drawControl);

		map.on('draw:created', function (e) {
			console.log('e', e);
			drawnItems.addLayer(e.layer);
			$('#init-scrape-btn').css('display', 'inline');
			$('#analyze-btn').css('display', 'inline');
		});

		map.on('click', function (e) {
			console.log('e', e);
		});
		
		map.on('draw:deleted', function(e) {
			if(drawnItems.getLayers().length == 0) {
				$('#init-scrape-btn').css('display', 'none');
				$('#analyze-btn').css('display', 'none');
			}
		})
	}

	make_drawControl();

// </draw-map>

// <scrape-management>
function load_scrapes() {
	socket.emit('get_existing', function(response) {
		console.log('get_existing :: ', response)
		_.map(response.types, function(x) {
			load_scrape(x);
		});			
	});
}


// Breaking apart the scrape loading and the scrape settings
function load_scrape(scrape_name) {
	socket.emit('load_scrape', scrape_name, function(response) {
		
		var geo_bounds = elasticsearch2leaflet(response.geo_bounds);
		
		// Color the background of the region, for now at least
		var rec = L.rectangle(geo_bounds, {
			color       : "red",
			weight      : 2,
			fillOpacity : 0
		});
		rec.on('click', function(e){ set_scrape(scrape_name); });
		rec.addTo(map)

		// boxes_to_names[rec._leaflet_id] = response;
		
		//map.fitBounds(geo_bounds);
	});
}

function set_scrape(scrape_name) {
	socket.emit('set_scrape', scrape_name, function(response) {
		
		console.log('set_scrape :: ', response);
		
		var geo_bounds = elasticsearch2leaflet(response.geo_bounds);
		
		$('#scrape-name').html(response.scrape_name);
	    $('#scrape-start-date').html(response.temp_bounds.start_date);
	    $('#scrape-end-date').html(response.temp_bounds.end_date);
	    
	    map.fitBounds(geo_bounds);
	    current_scrape_obj = response;
	    
	    // analyze_area(geo_bounds);
	});
}

// </scrape-management>


// <socket>
	var socket = io.connect('http://localhost:3000/');
	
	socket.on('give', giver_handler);
	var line_data = []
	var grid;
	function giver_handler(data) {
		
		console.log(data);
		
		$('#current-date').html(data.current_date);
		
		// // Draw lines
		d3.select('#line_svg').remove();
		
		// Add new information
		line_data.push({'date' : data.date, 'count' : data.count});
		// Make sure it's sorted
		line_data = _.sortBy(line_data, function(x) {return x.date});
		// Remove second to last element
		if(line_data.length > 1) {
			line_data.splice(-2, 1);	
		}
		// If we just finished a time unit, we add another one for protection from the next slice
		if(data.full_unit) { 
			line_data.push({'date' : data.date, 'count' : 0});
		}
		
		draw_line(line_data);
		
		// Show images
	    _.map(data.images, function(img) {
			// draw_image(img);
			sidebar_image(img);
	    });

		// var params = {
		// 	"users" : {
		// 		"css_selector" : ".side-bar #users",
		// 		"color"        : "yellow"
		// 	},
		// 	"tags" : {
		// 		"css_selector" : ".side-bar #tags",
		// 		"color"        : "limegreen"
		// 	}
		// }
		
		// d3.select(params.users.css_selector).selectAll("svg").remove();
		// draw_trending(data.users, params.users);
		
		// d3.select(params.tags.css_selector).selectAll("svg").remove();
		// draw_trending(data.tags, params.tags);
		
		// Grid
		if(!grid) {
			grid = init_grid(data.grid)
			reset_grid(grid)
		} else {
			draw_grid(grid, data.grid)
		}
		
	}
// </socket>

// <analyzing area>
function analyze_area(area) {
	socket.emit('analyze_area', area, function(data) {
		console.log('analyze_area :: ', data)

		d3.select('#line_svg').remove();
		line_data = data.timeseries;
		draw_line(line_data);
		
		if(!grid) {
			grid = init_grid(data.grid)
			reset_grid(grid)
		} else {
			draw_grid(grid, data.grid)
		}

	});
}
// <analyzing area>

// <grid> -- The d3 here is sloppier than I would hope

	// Drawing grid
	// function make_turf_grid() {
	// 	var extent     = [-76.6167 - .1, 39.2833 - .1, -76.6167 + .1, 39.2833 + .1];
	// 	var cellWidth  = .5;
	// 	var units      = 'miles';
	// 	var turf_data  = turf.squareGrid(extent, cellWidth, units);
	// 	return turf_data;
	// }


	// Project onto map
	function projectPoint(x, y) {
		var point = map.latLngToLayerPoint(new L.LatLng(y, x));
		this.stream.point(point.x, point.y);
	}
	
	var project = d3.geo.path().projection(d3.geo.transform({point: projectPoint}));

	function init_grid(grid_data) {
		// Initializing d3 layer
		if(grid_data.features.length > 0) {
			var svg     = d3.select(map.getPanes().overlayPane).append("svg");
			var g       = svg.append("g").attr("class", "leaflet-zoom-hide");
			var feature = g.selectAll("path").data(grid_data.features).enter().append("path");
			
			console.log('init grid')
			return {
				svg        : svg,
				g          : g,
				feature    : feature,
				grid_data  : grid_data
			}			
		}
	}
	
	// This works, but it's slow... Seems like we should just be able to change
	// the property of the data
	// Could probably match an ID of the underlying data to the updated data...
	function draw_grid(grid, data) {
		console.log('draw_grid :: ', grid, ' :: ', data);
		grid.g.selectAll("path").remove()
		var feature = grid.g.selectAll("path").data(data.features).enter().append("path");
		
		feature.attr('d', project)
			.attr('opacity', function(d) {
				// return Math.random()
				// return Math.log10(d.properties.count) / 10; // Hardcoded scaling 
				return d.properties.count;
			})
			.attr('fill', 'red')
	}

	// Move D3 with map
	function reset_grid(grid) {
		// Fix bounding box
		if(grid) {
			var bounds      = project.bounds(grid.grid_data),
			    topLeft     = bounds[0],
			    bottomRight = bounds[1];
			  
			grid.svg.attr("width",   bottomRight[0] - topLeft[0])
			    .attr("height", bottomRight[1] - topLeft[1])
			    .style("left",  topLeft[0] + "px")
			    .style("top",   topLeft[1] + "px")

			grid.g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

			// Redraw
			draw_grid(grid, grid.grid_data);			
		}
	}

	map.on("viewreset", function() {
		reset_grid(grid)
	});


	// var grid_data = make_turf_grid();
	// var grid = init_grid(grid_data)
	
	// reset_grid(grid)
	// map.on("viewreset", function() {
	// 	reset_grid(grid)
	// });
// </GRID>

// <IMG>
	var imageHash = {};
	var selectedImages = {};
	var LeafIcon = L.Icon.extend({
	    options: {
	        iconSize:[50, 50],
	    }
	});
	
	function sidebar_image(d) {
		$('#images').prepend('<img id="' + d.id + '" src="' + d.img_url + '" class="side-bar-image" />');
		$('#' + d.id).dblclick(function(){
			d3.select(this).style("border-color","red");
			selectedImages[d.id] = d;
			window.open(d.link, '_blank');
		});

		$('#' + d.id).click(function(){
			console.log(d);
			if (d.id in selectedImages) {
				d3.select(this).style("border-color","grey");
				delete selectedImages[d.id];
			}
			else {
				d3.select(this).style("border-color","red");
				selectedImages[d.id] = d;
			}
			if (_.keys(selectedImages).length == 0){
				$('#comment-btn').css('display', 'none');
				$('#show-user-btn').css('display', 'none');
			}
			else {
				$('#comment-btn').css('display', 'inline');
				$('#show-user-btn').css('display', 'inline');
			}
		});
	}
	
	function draw_image(d) {
		var m = L.marker([d.loc.lat, d.loc.lon], {
			icon: new LeafIcon({
				iconUrl : d.img_url,
				id      : d.id
			})
		});
		m.addTo(map);
		
		setTimeout(function(){ 
			map.removeLayer(m);
		}, 6000);
		
		imageHash[d.img_url] = d;
		
		d3.select("img[src=\"" +d.img_url + "\"]").transition()
			.duration(6000)
			.style("opacity", 0);
			
		d3.selectAll(".leaflet-marker-icon")
			.on("mouseover",function(d){
				d3.select(this)
					.style("width","150px")
					.style("height","150px")
				})
			.on("mouseout",function(d){
				d3.select(this)
					.style("width","50px")
					.style("height","50px")
				});
		
		d3.selectAll(".leaflet-marker-icon")
			.on("click",function(d){
				window.open(imageHash[this.src].link, '_blank');
			});
	}
//</IMG>

	// ----- Interaction ------

	// Handle key presses
	$(document).keypress(function(e) {
	    if((e.keyCode || e.which) == 46) {
		    reset_grid(grid)
	    } else if((e.keyCode || e.which) == 44){
		    reset_grid(grid)
	    }
	});

// <top-users>
	function draw_trending(orig_data, params) {
		var w = $(params.css_selector).width(),
		    h = $(params.css_selector).height() / orig_data.length;
		
		var margin = {top: 5, right: 10, bottom: 5, left: 0},
		    width  = w - margin.left - margin.right,
		    height = h - margin.top - margin.bottom;
		
		var parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S.000Z").parse;
		
        var data = _.map(orig_data, function(b) {
        	return {
        		"key" : b.key,
        		"timeseries" : _.map(b.timeseries, function(x) {
		            return {
		                "date"  : parseDate(x.date),
		                "count" : + x.count
		            }        			
        		})
        	}
        });
                
        // Calculate bar width
        var bar_width = 3;
                
        var x = d3.time.scale().range([0, width]);    
        x.domain(d3.extent(
        	_.chain(data).pluck('timeseries').flatten().pluck('date').value()
        )).nice();
        
        var y = d3.scale.linear().range([height, 0]);
        y.domain([0, d3.max(
        	_.chain(data).pluck('timeseries').flatten().pluck('count').value()	
        )]);

        var svg = d3.select(params.css_selector).selectAll('svg')
        			.data(data).enter()
        				.append('svg:svg')
        				.attr('class', 'user-ts')
						.attr('height', height)
						.attr('width', width);
        
		  svg.append("g")
		    .append("text")
		    .attr("x", 2)
		    .attr("y", 0)
		    .attr("dy", ".71em")
		    .attr("text-anchor", "start")
		    .attr("font-size", "1.1em")
		    .attr('fill', 'white')
		    .text(function(d) { return d.key});
		    
        svg.selectAll(".bar")
            .data(function(d) {console.log('d :: ', d); return d.timeseries})
            .enter().append("rect")
            .style("fill",  params.color)
            .attr("x",      function(d) { return x(d.date); })
            .attr("width",  bar_width)
            .attr("y",      function(d) { return y(d.count) })
            .attr("height", function(d) { return height - y(d.count); })
            .on('mouseover', function(e) {
                d3.select(this).style('fill', function() {return "white"})
            })
            .on('mouseout',  function(e) {
                d3.select(this).style('fill', function() {return params.color})
            })
            .append('title')
            .text(function(d) { return d.date + ' / ' + d.count });

	}
// </top-users>

// <GRAPH>
	function draw_line(data) {
		var w = $('#timeseries').width(),
		    h = $('#timeseries').height();

		var margin = {top: 5, right: 5, bottom: 30, left: 5},
		    width  = w - margin.left - margin.right,
		    height = h - margin.top - margin.bottom;

		var parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S.000Z").parse;
		// var parseDate = d3.time.format("%d-%b-%y").parse;

		var x = d3.time.scale().range([0, width]);
		var y = d3.scale.linear().range([height, 0]);

		var xAxis = d3.svg.axis().scale(x).orient("bottom");

		var yAxis = d3.svg.axis()
		    .scale(y)
		    .orient("left");

		var path = d3.svg.line()
		    .x(function(d) { return x(d.date); })
		    .y(function(d) { return y(d.count); });

		var svg = d3.select("#timeseries").append("svg").attr("id","line_svg")
		    .attr("width", width + margin.left + margin.right)
		    .attr("height", height + margin.top + margin.bottom)
		  .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		_data = _.map(data, function(d) {
			return {
				"date"  :  parseDate(d.date),
				"count" : + d.count
			}
		});

		x.domain(d3.extent(_data, function(d) { return d.date; }));
		y.domain([0, d3.max(_data, function(d) { return d.count; })]);
			
		svg.append("g")
		  .attr("class", "x axis")
		  .attr("transform", "translate(0," + height + ")")
		  .call(xAxis);

		var feature = svg.append("path")
			  .datum(_data)
			  .attr('d', path)
			  .attr("class", "line")
			  .attr('stroke', 'white');
	}
// </GRAPH>

// <events>
	$('#start-stream').on('click', function() {		
		socket.emit('start_giver', function() {
			console.log('start_giver :: ');
			line_data = [];
		});
	});

	$('#stop-stream').on('click', function() {
		socket.emit('stop_giver', function() {
			console.log('stop_giver :: ');
			// ... nothing else yet ...
		});
	});

	$('#init-scrape-btn').on('click', function() {
		$("#init-modal").modal('show');
	});

	$('#show-user-btn').on('click', function() {
		_.map(_.uniq(_.map(_.values(selectedImages),function(d){ return d.user;})), function(user) {
			socket.emit('scrape_user', user, function(response) {
				console.log('response from scrape_user :: ', response);
			});
		});	
	});



	$('#analyze-btn').on('click', function() {
		/*
			STUB FOR LOADING SIDE BAR WITH IMAGES, POPULATING TIME SERIES, AND POPULATING EVENTS FOR GIVEN AREA.
			THIS SAME FUNCTION SHOULD BE USED WHEN CLICKING AN 'EVENT'.  ONLY DIFFERENCE IS ENTRY POINT.
		*/
		console.log(drawnItems.getLayers()[0].getBounds());
		analyze_area(drawnItems.getLayers()[0].getBounds());
	});

	$('#comment-btn').on('click', function() {
		_.keys(selectedImages).map(function(media) {
			socket.emit('alert_user', {text:'test',image:media}, function(response) {
				console.log('response from scrape_user :: ', response);
			});
		});	
	});
	
		
	$('#init-modal-form-submit').on('click',function() {
		socket.emit('init_scrape', {
			"name"           : $( "#init-modal-form-name" ).val(),
			"comments"       : $( "#init-modal-form-comment" ).val(),
			"leaflet_bounds" : drawnItems.getLayers()[0].getBounds(), // Rectangle bounds
			"time"           : $("#init-modal-form-start-date").val(),
			"user"           : "dev_user"
		}, function(response) {
			console.log('response from init_scrape :: ', response);
		});		
		
		$('#init-modal').modal('hide');
	})

	/*			
		// Click on button to start a new scrape
		$('#start-new-scrape').on('click', function() {
			$('#first-modal').modal('hide');
			make_drawControl();
		});
		
		// Click on button to look at an existing scrape
		$('#start-existing-scrape').on('click', function() {
			$('#first-modal').modal('hide');
			$('#existing-modal').modal('show');
			
			socket.emit('get_existing', function(response) {
				console.log('response', response)
				
				// Make list of places
				var content = $('<div>');
				_.map(response.types, function(x) {
					var tmp = $('<button>').css('display', 'block').addClass('btn btn-primary').addClass('scrape-name-btn').html(x)
					tmp.on('click', function(e) {
						$('#existing-modal').modal('hide');
						console.log('>>>>', e);
						set_scrape(e.target.innerText);
					})
					tmp.appendTo(content);
				});
				
				$('#existing-modal .modal-body').html(content);	
			});
			
		});
	*/
	
// </events>

// <init>
//$('#first-modal').modal('show');
$('#init-scrape-btn').css('display', 'none');
$('#analyze-btn').css('display', 'none');
$('#comment-btn').css('display', 'none');
$('#show-user-btn').css('display', 'none');
load_scrapes();
// </init>

})

// <helpers>
function elasticsearch2leaflet(geo_bounds) {
	var southWest  = L.latLng(geo_bounds.bottom_right.lat, geo_bounds.top_left.lon);
	var northEast  = L.latLng(geo_bounds.top_left.lat, geo_bounds.bottom_right.lon);
	return L.latLngBounds(southWest, northEast);
}
// </helpers>