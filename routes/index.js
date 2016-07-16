var express = require('express');
var router = express.Router();
var config = require('../../eggdataconfig')();
var api = require('../opensensors')(config);
var Promise = require('bluebird');
var moment = require('moment')

var pendingRequests = {}; // each entry in this object represents an API request in progress, one per S/N
                          // if the value is an object the download is complete, number means pending (time period)

/* GET home page. */
router.get("/", function(req, res, next){
  res.render('index');
});

router.get("/egg/:serialnumber", function(req, res, next){
  var serialNumber = req.params.serialnumber;
  var duration_seconds = parseInt(req.query.seconds);
  if(!duration_seconds){
    duration_seconds = 10;
  }

  if(pendingRequests[serialNumber]){
    if(typeof pendingRequests[serialNumber] === 'number'){
      // there's already a pending request
      res.json(false); // not done yet so return false

      // is it for the same duration? if so, don't fire off a new api request
      if(pendingRequests[serialNumber] === duration_seconds){
        return;
      }
    }
    else {
      // there's an object available for this serial number
      // return it, delete it, and we're done
      res.json(pendingRequests[serialNumber]);
      delete pendingRequests[serialNumber];
      return;
    }
  }
  else{
    res.json(false); // not done yet so return false
  }

  // we got this far, it means we're sending out a new API request
  pendingRequests[serialNumber] = duration_seconds;

  Promise.try(function(){
    return api.messages.byDevice(serialNumber, {"start-date": moment().subtract(duration_seconds, "seconds").format()});
  }).then(function(results){
    //console.log("Response Object: ");
    //console.log(results);
    //console.log("Length: " + JSON.stringify(results).length);

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
    //res.json(partitioned_results);
    if(pendingRequests[serialNumber] === duration_seconds){
      pendingRequests[serialNumber] = partitioned_results;
    }
    // else discard the results, because duration has changed
  });
});

module.exports = router;
