// Map layer
var baseLayer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/cwhong.map-hziyh867/{z}/{x}/{y}.png', {
  attribution : "Social Sandbox",
  maxZoom     : 18
});

var map = new L.Map('map', {
  center : new L.LatLng(39.2833, -76.6167),
  zoom   : 13,
  layers : [baseLayer]
});

// ---------- Heatmap ----------

// Initializing d3 layer
var svg = d3.select(map.getPanes().overlayPane).append("svg");
var g   = svg.append("g").attr("class", "leaflet-zoom-hide");

// Drawing grid
function make_turf_grid() {
	var extent     = [-76.6167 - .1, 39.2833 - .1, -76.6167 + .1, 39.2833 + .1];
	var cellWidth  = .2;
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

// Actual data
var feature    = g.selectAll("path").data(collection.features).enter().append("path");

function reset() {
	// Move D3 with map
	var bounds      = path.bounds(collection),
	    topLeft     = bounds[0],
	    bottomRight = bounds[1];
	  
	svg.attr("width",   bottomRight[0] - topLeft[0])
	    .attr("height", bottomRight[1] - topLeft[1])
	    .style("left",  topLeft[0] + "px")
	    .style("top",   topLeft[1] + "px")

	g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

	feature.attr('d', path).attr('opacity', function() {
		return Math.random()
	}).attr('fill', 'red');
}

// Handle key presses
$(document).keypress(function(e) {
    if((e.keyCode || e.which) == 46) {
	    reset()
    } else if((e.keyCode || e.which) == 44){
	    reset()
    }
});

map.on("viewreset", reset);
reset();


// ----- Ping Layer ------
var socket = io.connect('http://10.3.2.75:3000/');
console.log('connecting...')
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
	var m = L.marker([d.location.latitude, d.location.longitude], {icon: new LeafIcon({iconUrl: d.images.low_resolution.url,id:d.id})});
	m.addTo(map);
	
	setTimeout(function(){ map.removeLayer(m);},600000);
	
	imageHash[d.images.low_resolution.url] = d;
	
	d3.select("img[src=\"" +d.images.low_resolution.url + "\"]").transition()
		.duration(600000)
		.style("opacity", 0);
		
	d3.selectAll(".leaflet-marker-icon")
		.on("mouseover",function(d){d3.select(this)
		.style("width","150px")
		.style("height","150px")})
		.on("mouseout",function(d){d3.select(this)
		.style("width","50px")
		.style("height","50px")});
	
	d3.selectAll(".leaflet-marker-icon")
		.on("click",function(d){
			window.open(imageHash[this.src].link, '_blank');
		});
}