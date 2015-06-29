function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

var lat = getParameterByName('lat');
var lon = getParameterByName('lon');

var mydata = {};

var snapped = false;

var alldata;

function transform(data){
  for(var i=0; i<data.hits.hits.length; i++)
  {
     var img = data.hits.hits[i];
     var tmp = new Date(img.fields["created_time"][0]*1000.0); 
     var ok = new Date(tmp.valueOf() + tmp.getTimezoneOffset() * 60000); 
     var key = new Date(ok.getFullYear(),ok.getMonth(),ok.getDate(),ok.getHours()).toString().substring(0,18).split(' ').join('_');
     if (key in mydata)
     {
      mydata[key].push(img);
     }
     else
     {
      mydata[key] = [img];
     }

  }
}

var LeafIcon = L.Icon.extend({
    options: {
        iconSize:     [50, 50],
    }
});

var map = L.map('map').setView([lat,lon], 14);

                L.tileLayer('https://{s}.tiles.mapbox.com/v3/cwhong.map-hziyh867/{z}/{x}/{y}.png', {
                        maxZoom: 24,
                        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
                        id: 'examples.map-i875mjb7'
                }).addTo(map);


function logging(x) {
  var tmp = new Date(x*1000.0); 
  var ok = new Date(tmp.valueOf() + tmp.getTimezoneOffset() * 60000);
  return ok
}

function ticklogging(x) {
  var tmp = new Date(x*1000.0); 
  var ok = new Date(tmp.valueOf() + tmp.getTimezoneOffset() * 60000);
  return ok.toString().substring(0,10);
}

function loadPictures(tt) {


  if(tt == null) {d3.select('#viz').selectAll("img").data(alldata.hits.hits).enter().append("img").attr("src",function(d) {return d.fields["images.thumbmail.url"];})
               .attr("class",function(d){var tmp = new Date(d.fields["created_time"][0]*1000.0); var ok = new Date(tmp.valueOf() + tmp.getTimezoneOffset() * 60000); return new Date(ok.getFullYear(),ok.getMonth(),ok.getDate(),ok.getHours()).toString().substring(0,18).split(' ').join('_'); }).on("mouseover",function(d){
                d3.selectAll("img").style({"border-color":"red", "border-width": "0px", "border-style": "solid"});
                d3.select(this).style({"border-color":"red", "border-width": "2px", "border-style": "solid"});
               }).on("click",function(d){

                L.marker([d.fields["location.latitude"][0], d.fields["location.longitude"][0]], {icon: new LeafIcon({iconUrl:d.fields["images.thumbnail.url"]})}).addTo(map);
                 map.setView([d.fields["location.latitude"][0], d.fields["location.longitude"][0]], 18);
              }).on("dblclick",function(d){window.open(d.fields['link'], '_blank');});
}
else{
  if ( mydata[tt] != undefined){
  d3.select('#viz').selectAll("img").data([]).exit().remove();
  d3.select('#viz').selectAll("img").data(mydata[tt]).enter().append("img").attr("src",function(d) {return d.fields["images.thumbnail.url"];})
               .attr("class",function(d){var tmp = new Date(d.fields["created_time"][0]*1000.0); var ok = new Date(tmp.valueOf() + tmp.getTimezoneOffset() * 60000); return new Date(ok.getFullYear(),ok.getMonth(),ok.getDate(),ok.getHours()).toString().substring(0,18).split(' ').join('_'); }).on("mouseover",function(d){
                d3.selectAll("img").style({"border-color":"red", "border-width": "0px", "border-style": "solid"});
                d3.select(this).style({"border-color":"red", "border-width": "2px", "border-style": "solid"});
               }).on("click",function(d){

                L.marker([d.fields["location.latitude"][0], d.fields["location.longitude"][0]], {icon: new LeafIcon({iconUrl:d.fields["images.thumbnail.url"]})}).addTo(map);
                 map.setView([d.fields["location.latitude"][0], d.fields["location.longitude"][0]], 18);
              }).on("dblclick",function(d){window.open(d.fields['link'], '_blank');});
}
else {
  d3.select('#viz').selectAll("img").data([]).exit().remove();
}
}
}



$.ajax({
            type: "GET",
            contentType: "application/json; charset=utf-8",
            url: 'http://10.3.2.75:3000/service?lat=' + lat + '&lon=' + lon,
            dataType: 'json',
            async: true,
            data: "{}", 
            success: function (data) {
               transform(data);
               alldata = data
               loadPictures(null);
               change_graph(data.graph);
              var seriesData = data.hourtimeseries;

              $('#chart').on('click', function() {snapped = !snapped; });

               var graph = new Rickshaw.Graph( {
              element: document.getElementById("chart"),
              width: 1000,
              height: 400,
              top: 50,
              renderer: 'bar',
              series: [
                {
                  color: "#c05020",
                  data: seriesData,
                  name: lat + ',' + lon
                },
              ]
              } );

               var y_ticks = new Rickshaw.Graph.Axis.Y( {
  graph: graph,
  orientation: 'left',
  tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
  pixelsPerTick: 30,
  element: document.getElementById('y_axis')
} );

               
               var x_ticks = new Rickshaw.Graph.Axis.X( {
  graph: graph,
  orientation: 'bottom',
  element: document.getElementById('x_axis'),
  pixelsPerTick: 200,
  tickFormat: ticklogging
} );

            

            var hoverDetail = new Rickshaw.Graph.HoverDetail( {
              graph: graph,
              formatter: function(series, x, y) {
                var date = '<span class="date">' + new Date(x * 1000).toUTCString() + '</span>';
    var content = series.name + ": " + parseInt(y) + '<br>' + date;
    var dt = logging(x);
    var tmp = new Date(x*1000.0); 
    var ok = new Date(tmp.valueOf() + tmp.getTimezoneOffset() * 60000); 
    var dtval = new Date(ok.getFullYear(),ok.getMonth(),ok.getDate(),ok.getHours()).toString().substring(0,18).split(' ').join('_');
    if (!snapped){
    loadPictures(dtval);
  }
    //d3.select('#viz').selectAll("img").data([mydata.hits.hits[0]]).exit().remove();
    //d3.selectAll("."+dt.toString().substring(0,18).split(' ').join('_')).style({"border-color":"yellow", "border-width": "3px", "border-style": "solid"});
    return content;
  }
            } );

            graph.render();

            },
});
