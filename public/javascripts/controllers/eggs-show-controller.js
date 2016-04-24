angular.module('MyApp').controller('EggsShowController', function($scope, $routeParams, $http, $interval, $timeout, $sce) {

  $scope.mostRecentTemperature = null;
  $scope.mostRecentTemperatureTime = null;
  $scope.mostRecentHumidity = null;
  $scope.mostRecentHumidityTime = null;
  $scope.mostRecentNO2 = null;
  $scope.mostRecentNO2Time = null;
  $scope.mostRecentSO2 = null;
  $scope.mostRecentSO2Time = null;
  $scope.mostRecentCO2 = null;
  $scope.mostRecentCO2Time = null;
  $scope.mostRecentCO = null;
  $scope.mostRecentCOTime = null;
  $scope.mostRecentO3 = null;
  $scope.mostRecentO3Time = null;
  $scope.mostRecentParticulate = null;
  $scope.mostRecentParticulateTime = null;
  $scope.mostRecentTime = null;
  $scope.mostRecentTimeTime = true; // necessary for uniform treatment

  $scope.latestDateAvailable = null;
  $scope.earliestDateAvailable = null;

  $scope.plot_duration_seconds = 60 * 60; // 1 hour
  $scope.zoom_earliest_timestamp = null;
  $scope.zoom_latest_timestamp = null;

  $scope.data = {
    "/orgs/wd/aqe/temperature":[],
    "/orgs/wd/aqe/humidity":[],
    "/orgs/wd/aqe/no2":[],
    "/orgs/wd/aqe/co":[],
    "/orgs/wd/aqe/so2":[],
    "/orgs/wd/aqe/o3":[],
    "/orgs/wd/aqe/particulate":[],
    "/orgs/wd/aqe/co2":[]
  };

  $scope.knownTopics = Object.keys($scope.data);

  $scope.sensorTypes = ["Temperature", "Humidity", "NO2", "CO", "SO2", "O3", "Particulate", "CO2", "Time"];
  $scope.hasSensorType = function(sensorType){
    return ($scope["mostRecent" + sensorType] && $scope["mostRecent" + sensorType + "Time"]);
  };

  $scope.mostRecentValue = function(sensorType){
    return $scope["mostRecent" + sensorType];
  };

  var capitalizeFirstLetter = function(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  var updateTimestamp = function(sensor, timestamp, value){
    sensor = capitalizeFirstLetter(sensor);
    var sensorKey = "mostRecent"+ sensor;
    var sensorTimestampKey = sensorKey + "Time";
    if (!$scope[sensorTimestampKey]) {
      try {
        $scope[sensorKey] = $sce.trustAsHtml(value);
        $scope[sensorTimestampKey] = timestamp;
      }
      catch(e){
        console.log(e);
      }

    }
    else if(timestamp.isAfter($scope[sensorTimestampKey])){
      try {
        $scope[sensorKey] = $sce.trustAsHtml(value);
        $scope[sensorTimestampKey] = timestamp;
      }
      catch(e){
        console.log(e);
      }
    }
  };

  function symbolic(unit){
    switch(unit){
      case "degC":
        return "&deg;C";
      case "percent":
        return "%";
        break;
      default:
        return unit;
    }
  }

  $scope.fetchDataAndRenderPlots = function (seconds, render){
    if(!seconds){
      seconds = 10;
    }

    var numDataPoints = 0;

    $http.get('egg/' + $routeParams.egg_id + '?seconds=' + seconds).success(function(data){
      var keys = Object.keys(data);
      for(var ii = 0; ii < keys.length; ii++){
        for(var jj = 0; jj < data[keys[ii]].length; jj++) {
          var datum = data[keys[ii]][jj];
          datum.timestamp = { m: moment(datum.timestamp)}; // convert all the timestamp fields to moments
          datum.timestamp.str = datum.timestamp.m.format('YYYY-MM-DD HH:mm:ss'); // for plotly
          var timestamp = datum.timestamp.m;
          if (!$scope.mostRecentTime) {
            $scope.mostRecentTime = timestamp;
            $scope.latestDateAvailable = timestamp;
          }
          else if(timestamp.isAfter($scope.latestDateAvailable)){
            $scope.mostRecentTime = timestamp;
            $scope.latestDateAvailable = timestamp
          }

          if(!$scope.earliestDateAvailable){
            $scope.earliestDateAvailable = timestamp;
          }
          //else if(timestamp.isBefore($scope.earliestDateAvailable)){
          //  $scope.earliestDateAvailable = timestamp;
          //}

          var value = datum["compensated-value"] || datum["converted-value"];
          // this convoluted bit of code is due to the fact that the number zero is falsy
          // but it is a perfectly reasonable value for a sensor to report
          // so if value is falsy, and something was neither null nor undefined, it must
          // have been zero, and we should restore it to that value
          if(!value &&
              ((datum["compensated-value"] !== null && datum["compensated-value"] !== undefined)
                || ( datum["converted-value"] !== null && datum["converted-value"] !== undefined))){
            value = 0;
          }

          if(value !== null && value !== undefined){
            value = value.toFixed(2);
            value += ' ' + symbolic(datum["converted-units"]);
          }

          switch(datum.topic){
            case "/orgs/wd/aqe/temperature":
              updateTimestamp("temperature", timestamp, value);
              break;
            case "/orgs/wd/aqe/humidity":
              updateTimestamp("humidity", timestamp, value);
              break;
            case "/orgs/wd/aqe/no2":
              updateTimestamp("NO2", timestamp, value);
              break;
            case "/orgs/wd/aqe/co":
              updateTimestamp("CO", timestamp, value);
              break;
            case "/orgs/wd/aqe/SO2":
              updateTimestamp("SO2", timestamp, value);
              break;
            case "/orgs/wd/aqe/O3":
              updateTimestamp("temperature", timestamp, value);
              break;
            case "/orgs/wd/aqe/particulate":
              updateTimestamp("particulate", timestamp, value);
              break;
            case "/orgs/wd/aqe/co2":
              updateTimestamp("CO2", timestamp, value);
              break;
          }
        }
      }

      // so now we know what the most recent timestamp is...
      // we should go through the data we're keeping around
      // and drop any data that is older than "interval"
      // from the most recent timestamp
      var earliestAllowedTimestamp = moment($scope.latestDateAvailable).subtract($scope.plot_duration_seconds, "seconds");
      for(var ii = 0; ii < $scope.knownTopics.length; ii++){
        // we'll assume that the records are in order chronologically
        // and remove them from the front one at a time
        var topic = $scope.knownTopics[ii];
        var numAdds = 0;
        var numRemoves = 0;

        for(var jj = 0; jj < $scope.data[topic].length; jj++){
          var datum = $scope.data[topic].shift();
          numRemoves++;
          if(datum.timestamp.m.isAfter(earliestAllowedTimestamp)){
            $scope.data[topic].unshift(datum);
            numRemoves--;
            break;
          }
        }

        // then we should push the new data as long as it's not already there
        if(data[topic]) {
          numDataPoints++;
          var last_jj_reached = 0;
          for (var kk = 0; kk < data[topic].length; kk++) {
            var new_datum = data[topic][kk];
            var new_datum_exists = false;
            // check if it exists
            for (var jj = last_jj_reached; jj < $scope.data[topic].length; jj++) {
              var existing_datum = $scope.data[topic][jj];
              last_jj_reached = jj + 1;
              if(existing_datum.timestamp.m.isSame(new_datum.timestamp.m)){
                new_datum_exists = true;
                break;
              }
            }

            if(!new_datum_exists){
              // add it to the scope data
              $scope.data[topic].push(new_datum);
              numAdds++;
            }
          }
        }
        //console.log("Topic: " + topic + ", Adds: " + numAdds + ", Removes: " + numRemoves);

        // finally we should re-establish the earliest available date after removals
        $scope.earliestDateAvailable = moment(earliestAllowedTimestamp);
      }

      $scope.mostRecentTime = $sce.trustAsHtml(timestamp.format("MMMM Do YYYY, h:mm:ss a"));

      if(render) {
        $scope.renderPlots();
      }
      else{
        // go ahead wipe those "data series" results
        $scope.data = {
          "/orgs/wd/aqe/temperature":[],
          "/orgs/wd/aqe/humidity":[],
          "/orgs/wd/aqe/no2":[],
          "/orgs/wd/aqe/co":[],
          "/orgs/wd/aqe/so2":[],
          "/orgs/wd/aqe/o3":[],
          "/orgs/wd/aqe/particulate":[],
          "/orgs/wd/aqe/co2":[]
        };
      }
    });
  };

  // render plots reflects on $scope.data and targets
  // constructs the properly formatted plotly traces
  // and targets them at the appropriate divs
  function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  $scope.renderPlots = function(){
    for(var ii = 0; ii < $scope.sensorTypes.length; ii++){
      var sensorType = $scope.sensorTypes[ii];

      if(sensorType == "Time" || !$scope.hasSensorType(sensorType)){
        continue;
      }

      var trace = {
        x: [],
        y: [],
        mode: 'lines+markers',
        yaxis: 'y',
        type: 'scatter',
        name: sensorType
      };

      var units = null;

      trace.y = $scope.data[$scope.knownTopics[ii]].map(function(datum){
        if($scope.zoom_earliest_timestamp && $scope.zoom_latest_timestamp
            && (datum.timestamp.m.isAfter($scope.zoom_latest_timestamp)
                  || datum.timestamp.m.isBefore($scope.zoom_earliest_timestamp))){
          return null;
        }
        else if(isNumeric(datum["compensated-value"])){
          if(!units){
            units = sensorType + ' ' + symbolic(datum['converted-units']);
          }

          return datum["compensated-value"];
        }
        else if(isNumeric(datum["converted-value"])){
          if(!units){
            units = sensorType + ' ' + symbolic(datum['converted-units']);
          }

          return datum["converted-value"];
        }
        else{
          return null;
        }
      }).filter(function(value){
        return value !== null;
      });

      trace.x = $scope.data[$scope.knownTopics[ii]].map(function(datum){
        if($scope.zoom_earliest_timestamp && $scope.zoom_latest_timestamp
          && (datum.timestamp.m.isAfter($scope.zoom_latest_timestamp)
          || datum.timestamp.m.isBefore($scope.zoom_earliest_timestamp))){
          return null;
        }
        else if(isNumeric(datum["compensated-value"])){
          return datum.timestamp.str;
        }
        else if(isNumeric(datum["converted-value"])){
          return datum.timestamp.str;
        }
        else{
          return null;
        }
      }).filter(function(value){
        return value !== null;
      });

      var layout = {height: 400};
      layout.yaxis = {title: units};

      Plotly.newPlot(sensorType + '_scatterplot', [trace], layout);

      $('#'+sensorType+"_scatterplot").bind('plotly_relayout',function(event, eventdata){
        $timeout(function() {
          try {
            if (eventdata["xaxis.autorange"]) {
              $scope.zoom_earliest_timestamp = $scope.earliestDateAvailable;
              $scope.zoom_latest_timestamp = $scope.latestDateAvailable;

            }
            else if (eventdata["xaxis.range[0]"] && eventdata["xaxis.range[1]"]) {
              $scope.zoom_earliest_timestamp = moment(eventdata["xaxis.range[0]"]);
              $scope.zoom_latest_timestamp = moment(eventdata["xaxis.range[1]"]);
            }
          }
          catch(e){
            console.log(e);
          }
          $scope.renderPlots();
        });
      });
    }
  };

  function kickoff1(dur){
    $scope.fetchDataAndRenderPlots(dur);
    $timeout(kickoff2, 0, true, 60*60, true); // fetch an hour immediately
  }

  function kickoff2(dur, render){
    $scope.fetchDataAndRenderPlots(dur, render);
    $scope.stopFetching = $interval($scope.fetchDataAndRenderPlots, 10000, 0, true, 10, true); //thereafter fetch 10 seconds
  }

  $timeout(kickoff1, 0, true, 10);    // fetch an 10 seconds immediately

});