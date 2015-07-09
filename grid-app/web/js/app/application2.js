$(document).ready(function() {
	// Map layer
	var baseLayer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/cwhong.map-hziyh867/{z}/{x}/{y}.png', {
	  attribution : "Social Sandbox",
	  maxZoom     : 18
	});

	var map = new L.Map('map', {
	  center : new L.LatLng(39.2833, -76.6167),
	  zoom   : 12,
	  layers : [baseLayer]
	});

	// ---------- Heatmap ----------

	// Initializing d3 layer
	var svg = d3.select(map.getPanes().overlayPane).append("svg");
	var g   = svg.append("g").attr("class", "leaflet-zoom-hide");

	// Drawing grid
	function make_turf_grid() {
		var extent     = [-76.6167 - .1, 39.2833 - .1, -76.6167 + .1, 39.2833 + .1];
		var cellWidth  = .5;
		var units      = 'miles';
		var turf_data  = turf.squareGrid(extent, cellWidth, units);
		return turf_data;
	}
	var collection = make_turf_grid();

	// Project onto map
	function projectPoint(x, y) {
		var point = map.latLngToLayerPoint(new L.LatLng(y, x));
		this.stream.point(point.x, point.y);
	}
	var transform  = d3.geo.transform({point: projectPoint});
	var path       = d3.geo.path().projection(transform);

	// Actual grid cells
	var feature = g.selectAll("path").data(collection.features).enter().append("path");

	function reset_grid() {
		// Move D3 with map
		var bounds      = path.bounds(collection),
		    topLeft     = bounds[0],
		    bottomRight = bounds[1];
		  
		svg.attr("width",   bottomRight[0] - topLeft[0])
		    .attr("height", bottomRight[1] - topLeft[1])
		    .style("left",  topLeft[0] + "px")
		    .style("top",   topLeft[1] + "px")

		g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

		feature.attr('d', path)
			.attr('opacity', function() {
				return Math.random()
			})
			.attr('fill', 'red')
			.on('mouseover', function() {
				reset_line();
			})
	}

	map.on("viewreset", reset_grid);

	function reset() {
		reset_grid();
		reset_line();
	}

	reset();


	// ----- Ping Layer ------
	// Seems like there's no Kafka right now
	var socket = io.connect('http://localhost:3000/');
	socket.on('raw', raw_handler);
	function raw_handler(data) {
	  try {
	    _.map(data, function(d) {
	      addMarker(d);
	    });
	  } catch(e) {
	    console.log('cannot add point!');
	  }
	};

	function addMarker(d) {
		var m = L.marker([d.location.latitude, d.location.longitude], {
			icon: new LeafIcon({iconUrl: d.images.low_resolution.url,id:d.id})
		});
		m.addTo(map);
		
		setTimeout(function(){ 
			map.removeLayer(m);
		}, 600000);
		
		imageHash[d.images.low_resolution.url] = d;
		
		d3.select("img[src=\"" +d.images.low_resolution.url + "\"]").transition()
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

	// ----- Interaction ------

	// Handle key presses
	$(document).keypress(function(e) {
	    if((e.keyCode || e.which) == 46) {
		    reset()
	    } else if((e.keyCode || e.which) == 44){
		    reset()
	    }
	});


	// ------ Graph --------	
	var w = $('.bottom-bar').width(),
	    h = $('.bottom-bar').height();

	var margin = {top: 20, right: 20, bottom: 30, left: 50},
	    width  = w - margin.left - margin.right,
	    height = h - margin.top - margin.bottom;

	var parseDate = d3.time.format("%d-%b-%y").parse;

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

	var line = d3.svg.line()
	    .x(function(d) { return x(d.date); })
	    .y(function(d) { return y(d.close); });

	var svg = d3.select(".bottom-bar").append("svg")
	    .attr("width", width + margin.left + margin.right)
	    .attr("height", height + margin.top + margin.bottom)
	  .append("g")
	    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	var line_data;
	d3.tsv("data.tsv", function(error, data) {
	  line_data = data;
	  if (error) throw error;

	  data.forEach(function(d) {
	    d.date = parseDate(d.date);
	    d.close = +d.close;
	  });

	  x.domain(d3.extent(data, function(d) { return d.date; }));
	  y.domain(d3.extent(data, function(d) { return d.close; }));

	  svg.append("g")
	      .attr("class", "x axis")
	      .attr("transform", "translate(0," + height + ")")
	      .call(xAxis);

	  svg.append("path")
	      .datum(data)
	      .attr("class", "line")
	      .attr("d", line)
	      .attr('stroke', 'red');
	});	

	function reset_line() {
		var svg = d3.select('.bottom-bar')
		if(line_data) {
			line_data.pop()
			console.log(svg.selectAll('.line').attr('d', line(line_data)));			
		}
	}

})