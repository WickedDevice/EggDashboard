var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var moment = require('moment');
var MongoClient = require('mongodb').MongoClient;
var fs = require('fs');
var uuid = require('node-uuid');
var rimraf = require('rimraf');
var promiseDoWhilst = require('promise-do-whilst');
var kue = require('kue')
  , queue = kue.createQueue();


var findDocuments = function(db, colxn, callback) {
  // Get the documents collection
  var collection = db.collection(colxn);
  // Find some documents
  collection.find({}).toArray(function(err, docs) {
    callback(docs);
  });
};

/* GET home page. */
router.get("/", function(req, res, next){
  res.render('index');
});

router.get("/all-eggs", (req, res, next) => {
  var url = 'mongodb://localhost:27017/airqualityegg';
  MongoClient.connect(url, function(err, db) {
    console.log("Connected correctly to server");
    findDocuments(db, 'eggs', (docs) => {
      res.json(docs);
    });
  });
});

router.get("/egg/:serialnumber", function(req, res, next){
  try{
    var serialNumber = req.params.serialnumber;
    var guid = req.query.guid;

    var duration_seconds = parseInt(req.query.seconds);
    if(!duration_seconds){
      duration_seconds = 10;
    }

    // this should see if a directory exists for the egg requested first
    // if it does exist, it should accumulate the messages that exist and send them back. and if status is complete, it should clean up after itself
    // if it does not exist it should create a working directory for the egg, add a job to the queue, and return false
    // for good results the desired format of the response is {topic1: [], topic2: [], etc...}
    let moduleDir = __dirname;
    let upOneDir = moduleDir.split("/routes")[0];
    let workingDir = `${upOneDir}/public/downloads/${guid}`;

    console.log(`checking for existence of ${workingDir}`)
    if (guid && fs.existsSync(workingDir)) {
      console.log(`${workingDir} exists`);
      // accumulate all the data that currently exists and give it back
      let status = require(`${workingDir}/status.json`);
      if(status.complete){
        let data = {};

        // sift through the data files and organize the results
        let files;
        if (fs.existsSync(`${workingDir}/${serialNumber}`)) {
          files = fs.readdirSync(`${workingDir}/${serialNumber}`)
            .sort((a,b) => {
              return fs.statSync(`${workingDir}/${serialNumber}/${a}`).mtime.getTime() -
                fs.statSync(`${workingDir}/${serialNumber}/${b}`).mtime.getTime();
            });
        }

        let fileIdx = 0;
        console.log(files);

        if(files.length === 0){
          console.log("Warning: Returning early because no files were generated...")
          rimraf(workingDir, () => {
            console.log("Egg to Client: ", data);
            res.json(false);
          }); //clean up after yourself
        }
        else{
          // there are files...
          promiseDoWhilst(() => {
            // do this...
            file = files.shift();
            require(`${workingDir}/${serialNumber}/${file}`).forEach((datum) => {
              if(data[datum.topic]){
                data[datum.topic].push(datum);
              }
              else{
                data[datum.topic] = [ datum ];
              }
            });
          }, () => {
            // and repeat while this returns true
            return files.length > 0;
          }).then(() => {
            rimraf(workingDir, () => {
              console.log("Egg to Client: ", data);
              res.json(data);
            }); //clean up after yourself
          }).catch((error) => {
            console.log(error.message, error.stack);
            rimraf(workingDir, () => {
              res.json(false);
            }); //clean up after yourself
          });
        }
      }
      else{
        res.json(false);
      }
    }
    else{
      console.log(`${workingDir} does not exists`);
      guid = uuid.v4();
      workingDir = `${upOneDir}/public/downloads/${guid}`;
      fs.mkdirSync(workingDir);
      fs.writeFileSync(`${workingDir}/status.json`, JSON.stringify({complete: false}));

      // create kue job...
      var apiParams = {};
      apiParams["start-date"] = moment().subtract(30, 'seconds').format();
      apiParams["end-date"] = moment().format();
      var urlparams = urlParams(apiParams);

      let serials = [ serialNumber ];
      let url = 'https://api.opensensors.io/v1/messages/device/${serial-number}' + urlparams;

      let job = queue.create('download', {
          title: 'Dashboard request for last data from ' + url.replace('${serial-number}', serials[0])
        , original_serials: serials.slice()
        , serials: serials.slice()
        , url: url
        , original_url: url
        , save_path: workingDir
        , sequence: 1
        , compensated: true
        , instantaneous: false
        , bypassjobs: ['stitch', 'zip', 'email']
      })
      .priority('high')
      .attempts(2)
      .backoff({delay: 60*1000, type:'exponential'})
      .save();

      res.json({guid});

      // set a timeout and cleanup regardless after a minute
      setTimeout(() => {
        if(fs.existsSync(workingDir)){
          rimraf(workingDir, () => {});
        }
      }, 60 * 1000)
    }
  }
  catch(err){
    console.log(err.message, err.stack);
    res.status(500).json({error: error.message});
  }
});

function urlParams(params){
  var ret = "";
  if(Object.keys(params).length > 0){ // if there are any optional params
    ret += '?';
    var encodeParams = Object.keys(params).map(function(key){
      if(key != "status") { // special case, not an OpenSensors parameter
        return key + '=' + encodeURIComponent(params[key]);
      }
    });

    ret += encodeParams.join('&');
  }
  return ret;
}


module.exports = router;
