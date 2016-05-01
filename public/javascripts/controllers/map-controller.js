angular.module('MyApp').controller('MapController', function($scope, $routeParams, $http, $interval, $timeout, $sce) {

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

function renderMap(lat, lng){
  L.mapbox.accessToken = 'pk.eyJ1Ijoid2lja2VkZGV2aWNlIiwiYSI6ImNpbnA0NWliZTEwNWt1Z2x5bWtxc2tsZnMifQ.Yl5tvkrgD74S6i0ynNJntg';
  var mymap = L.mapbox.map('mapid', 'wickeddevice.013cfe64')

  if(lat && lng){
    mymap = mymap.setView([lat, lng], 13);
  }
  else{
    mymap = mymap.setView([35, -25], 3);
  }

}