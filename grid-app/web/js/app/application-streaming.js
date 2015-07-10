
$(document).ready(function() {
// <draw-map>
	var baseLayer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/cwhong.map-hziyh867/{z}/{x}/{y}.png', {
	  attribution : "Social Sandbox",
	  maxZoom     : 18
	});

	var map = new L.Map('map', {
	  center : new L.LatLng(39.2833, -76.6167),
	  zoom   : 12,
	  layers : [baseLayer]
	});
	
	// Draw controls
	var drawnItems = new L.FeatureGroup();
	map.addLayer(drawnItems);

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
					color : "white"
				}
			}
		}
	});
	map.addControl(drawControl);

	map.on('draw:created', function (e) {
		console.log(e.layer);

		// Adds button to region that allows the user to kick off a scrape
		var link = $('<a class="int-scrape"> Initiate Scrape </a>').click(function() {
			init_scrape(e.layer);
		})[0];
		e.layer.bindPopup(link);

		drawnItems.addLayer(e.layer);
	});

// </draw-map>

// <socket>
	var socket = io.connect('http://localhost:3000/');
	socket.on('give', giver_handler);
	
	var line_data = []
	var grid;
	function giver_handler(data) {
		
		// Draw lines
		d3.select('#line_svg').remove();
		line_data.push({'date' : data.date, 'count' : data.count});
		draw_line(line_data);
		
		// Show images
	    _.map(data.images, function(img) {
			// draw_image(img);
			sidebar_image(img);
	    });
	
		// Grid
		if(!grid) {
			grid = init_grid(data.grid)
			reset_grid(grid)
		} else {
			draw_grid(grid, data.grid)
		}
		

	}
// </socket>

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
		grid.g.selectAll("path").remove()
		var feature = grid.g.selectAll("path").data(data.features).enter().append("path");
		
		feature.attr('d', project)
			.attr('opacity', function(d) {
				// return Math.random()
				return d.properties.count;
			})
			.attr('fill', 'red')
	}

	// Move D3 with map
	function reset_grid(grid) {
		// Fix bounding box
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
	var LeafIcon = L.Icon.extend({
	    options: {
	        iconSize:[50, 50],
	    }
	});
	
	function sidebar_image(d) {
		$('.side-bar').prepend('<img id="' + d.id + '" src="' + d.img_url + '" class="side-bar-image" />');
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
		}, 600000);
		
		imageHash[d.img_url] = d;
		
		d3.select("img[src=\"" +d.img_url + "\"]").transition()
			.duration(600000)
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


// <GRAPH>
	function draw_line(data) {
		var w = $('.bottom-bar').width(),
		    h = $('.bottom-bar').height();

		var margin = {top: 20, right: 20, bottom: 30, left: 50},
		    width  = w - margin.left - margin.right,
		    height = h - margin.top - margin.bottom;

		var parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S.000Z").parse;
		// var parseDate = d3.time.format("%d-%b-%y").parse;

		var x = d3.time.scale()
		    .range([0, width]);

		var y = d3.scale.linear()
		    .range([height, 0]);

		var xAxis = d3.svg.axis()
		    .scale(x)
		    .orient("bottom");

		var yAxis = d3.svg.axis()
		    .scale(y)
		    .orient("left");

		var path = d3.svg.line()
		    .x(function(d) { return x(d.date); })
		    .y(function(d) { return y(d.count); });

		var svg = d3.select(".bottom-bar").append("svg").attr("id","line_svg")
		    .attr("width", width + margin.left + margin.right)
		    .attr("height", height + margin.top + margin.bottom)
		  .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		console.log(data)
		_data = _.map(data, function(d) {
			return {
				"date"  :  parseDate(d.date),
				"count" : + d.count
			}
		});

		x.domain(d3.extent(_data, function(d) { return d.date; }));
		y.domain(d3.extent(_data, function(d) { return d.count; }));
			
		svg.append("g")
		  .attr("class", "x axis")
		  .attr("transform", "translate(0," + height + ")")
		  .call(xAxis);

		var feature = svg.append("path")
			  .datum(_data)
			  .attr('d', path)
			  .attr("class", "line")
			  .attr('stroke', 'red');
	}
// </GRAPH>

// <events>
	$('#start-stream').on('click', function() {
		socket.emit('start_giver');
	});

	$('#stop-stream').on('click', function() {
		socket.emit('stop_giver');
	});

	
	function init_scrape(layer) {
		socket.emit('init_scrape', {
			"leaflet_bounds" : layer.getBounds(),
			"time"           : + new Date(),
			"user"           : "dev_user"
		});
	}
// </events>
})