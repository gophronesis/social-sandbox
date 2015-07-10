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
	    // _.map(data.images, function(img) {
	    // 	console.log(img)
	    //   draw_image(img);
	    // });
	
		// Grid
		if(!grid) {
			grid = init_grid(data.grid)
			reset_grid(grid)
			map.on("viewreset", function() {
				reset_grid(grid)
			});
		} else {
			console.log('redrawing')
			draw_grid(grid, data.grid)
		}
		

	}
	// </socket>

// <grid>
	// Drawing grid
	function make_turf_grid() {
		var extent     = [-76.6167 - .1, 39.2833 - .1, -76.6167 + .1, 39.2833 + .1];
		var cellWidth  = .5;
		var units      = 'miles';
		var turf_data  = turf.squareGrid(extent, cellWidth, units);
		return turf_data;
	}


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
		var bounds      = project.bounds(grid.grid_data),
		    topLeft     = bounds[0],
		    bottomRight = bounds[1];
		  
		grid.svg.attr("width",   bottomRight[0] - topLeft[0])
		    .attr("height", bottomRight[1] - topLeft[1])
		    .style("left",  topLeft[0] + "px")
		    .style("top",   topLeft[1] + "px")

		grid.g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

		draw_grid(grid)
	}

	// var grid_data = make_turf_grid();
	// console.log(JSON.stringify(grid_data.features[0]))
	
	// var d = {"type":"Feature","geometry":{"type":"Polygon",
	// 	"coordinates":[[[-76.71669999999999,39.183299999999996],[-76.71669999999999,39.19053431559508],[-76.70736694690846,39.19053431559508],[-76.70736694690846,39.183299999999996],[-76.71669999999999,39.183299999999996]]]},
	// 	"properties":{}}
	// var d = {"type":"Feature","geometry":{"type":"Polygon", 
	// 	"coordinates":[[[-76.728515625,39.1552734375],[-76.728515625,39.19921875],[-76.6845703125,39.19921875],[-76.6845703125,39.1552734375],[-76.728515625,39.1552734375]]],
	// 	"properties" : {}
	// }}
	
	// console.log(grid_data)
	// var grid_data = {"type":"FeatureCollection","features":[d]}
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
})