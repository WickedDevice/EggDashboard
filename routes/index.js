var express = require('express');
var router = express.Router();
var config = require('../../eggdataconfig')();
var api = require('../opensensors')(config);
var Promise = require('bluebird');
var moment = require('moment')

/* GET home page. */
router.get("/", function(req, res, next){
  res.render('index');
});

router.get("/egg/:serialnumber", function(req, res, next){
  var serialNumber = req.params.serialnumber;
  var duration_seconds = req.query.seconds;
  if(!duration_seconds){
    duration_seconds = 10;
  }

  Promise.try(function(){
    return api.messages.byDevice(serialNumber, {"start-date": moment().subtract(duration_seconds, "seconds").format()});
  }).then(function(results){
    console.log("Response Object: ");
    console.log(results);
    console.log("Length: " + JSON.stringify(results).length);

    // now that we have results, split them up into datastreams
    var partitioned_results = {};
    for(var ii = 0; ii < results.length; ii++){
      var result = results[ii];
      if(!partitioned_results[result.topic]){
        partitioned_results[result.topic] = [];
      }
      partitioned_results[result.topic].push(result);
    }
    //console.log(partitioned_results);
    res.json(partitioned_results);
  });
});

module.exports = router;
