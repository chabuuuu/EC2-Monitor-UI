require("dotenv").config();
var AWS = require("aws-sdk");
const axios = require("axios");
const thirtyMinutesInMs = 30 * 60 * 1000;
var ec2_instances_list = require("./ec2-instances");
const express = require("express");

const DBInstanceID = "i-0efddf44ae8538b54";

AWS.config.update({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
  region: "ap-southeast-1",
});

const EC2 = new AWS.EC2();

async function rebootInstances(instanceId) {
  EC2.rebootInstances({ InstanceIds: [instanceId] }, function (error, data) {
    if (error) {
      console.log(error, error.stack);
    } else {
      console.log(data);
    }
  });
}

let result = [];

async function checkInstanceStatus() {
  for (let ec2Instance of ec2_instances_list) {
    try {
      console.log(`Checking instance ${ec2Instance.name}`);
      const response = await axios.get(`http://${ec2Instance.ip}`);
      console.log(response.data);
      console.log(`Instance ${ec2Instance.name} is running`);
      result.push({
        name: ec2Instance.name,
        id: ec2Instance.id,
        status: "running",
      });
    } catch (error) {
      //Restart the instance
      console.log(`Instance ${ec2Instance.name} is not running`);
      await rebootInstances(instanceId);
      console.log(`Instance ${ec2Instance.name} is rebooting`);
      result.push({
        name: ec2Instance.name,
        id: ec2Instance.id,
        status: "offline",
      });
    }
  }
  return result;
}
let intervalId;
function startInterval() {
  intervalId = setInterval(() => {
    checkInstanceStatus(DBInstanceID);
  }, thirtyMinutesInMs);
}

const app = express();

let intervalEnabled = true;
startInterval();
app.get("/status", async (req, res) => {
  if (result.length == 0) {
    result = await checkInstanceStatus();
  }
  const status = {
    interval: intervalEnabled ? "enabled" : "disabled",
    ec2_instances_list,
    instance_status: result,
  };
  res.json(status);
});

app.get("/enable-interval", (req, res) => {
  intervalEnabled = true;
  startInterval();
  res.send("Interval enabled");
});

app.get("/disable-interval", (req, res) => {
  intervalEnabled = false;
  clearInterval(intervalId);
  res.send("Interval disabled");
});

app.get("/home", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
