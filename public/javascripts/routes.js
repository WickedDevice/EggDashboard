angular.module('MyApp').config(function($routeProvider){
  $routeProvider

    .when('/', {
      templateUrl: 'templates/pages/home/index.html',
      controller: 'MapController'
    })

    .when('/egg/:egg_id/:duration?', {
      templateUrl: 'templates/pages/eggs/index.html',
      controller: 'EggsShowController'
    });
});
