angular.module('MyApp').controller('MapController', function($scope, $routeParams, $http, $interval, $timeout, $sce) {

  function renderMap(lat, lng){
    //L.mapbox.accessToken = 'pk.eyJ1Ijoid2lja2VkZGV2aWNlIiwiYSI6ImNpbnA0NWliZTEwNWt1Z2x5bWtxc2tsZnMifQ.Yl5tvkrgD74S6i0ynNJntg';
    //var mymap = L.mapbox.map('mapid', 'wickeddevice.013cfe64')

    var mymap = L.map('mapid');

    if(lat && lng){
      mymap = mymap.setView([lat, lng], 13);
    }
    else{
      mymap = mymap.setView([35, -25], 3);
    }

    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
      maxZoom: 18,
      id: 'wickeddevice.013cfe64',
      accessToken: 'pk.eyJ1Ijoid2lja2VkZGV2aWNlIiwiYSI6ImNpbnA0NWliZTEwNWt1Z2x5bWtxc2tsZnMifQ.Yl5tvkrgD74S6i0ynNJntg'
    }).addTo(mymap);

    var markers = L.markerClusterGroup();

    $http.get('all-eggs').success((data) => {
      data.forEach((d) => {
        var marker = L.marker([+d.loc.coordinates[1], +d.loc.coordinates[0]], {
          icon: L.icon({
            iconUrl: 'images/egg-icon.png'
          })
        });
        markers.addLayer(marker);
      });
    });

    mymap.addLayer(markers);

  }

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(function(position) {
      renderMap(position.coords.latitude, position.coords.longitude);
    }, function(error){
      renderMap();
    });
  }
  else{
  }
});