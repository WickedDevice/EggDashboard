angular.module('MyApp').config(function($routeProvider){
  $routeProvider

    .when('/', {

    })

    .when('/egg/:egg_id', {
      templateUrl: 'templates/pages/eggs/index.html',
      controller: 'EggsShowController'
    });
});