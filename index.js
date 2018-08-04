var request = require("request");
var eventSource = require('eventsource');
var Service, Characteristic;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
  
	homebridge.registerPlatform("homebridge-particle", "Particle", ParticlePlatform);
}

function ParticlePlatform(log, config){
	this.log = log;
	this.accessToken = config["access_token"];
	this.deviceId = config["deviceid"];
	this.url = config["cloudurl"];
	this.devices = config["devices"];
}

ParticlePlatform.prototype = {
	accessories: function(callback){
		var foundAccessories = [];
		
		var count = this.devices.length;
		
		for(index=0; index< count; ++index){
			var accessory  = new ParticleAccessory(
				this.log, 
				this.url,
				this.accessToken,
				this.devices[index]);
			
			foundAccessories.push(accessory);
		}
		
		callback(foundAccessories);
	}
};

function ParticleAccessory(log, url, access_token, device) {
	this.log = log;
	this.name = device["name"],
	this.args = device["args"];
	this.deviceId = device["deviceid"];
	this.type = device["type"];
	this.functionName = device["function_name"];
	this.eventName = device["event_name"];
	this.sensorType = device["sensorType"];
	this.key = device["key"];
	this.accessToken = access_token;
	this.url = url;
	this.value = 20;
	
	console.log(this.name + " = " + (this.sensorType ? this.sensorType : this.type) );
	
	this.services = [];
	
	this.informationService = new Service.AccessoryInformation();

	this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Particle")
		.setCharacteristic(Characteristic.Model, "Photon")
		.setCharacteristic(Characteristic.SerialNumber, "AA098BB09");
		
	this.services.push(this.informationService);

	var service;

	switch( this.type ) {
		case 'LIGHT': 
			this.lightService = new Service.Lightbulb(this.name);
			
			this.lightService
				.getCharacteristic(Characteristic.On)
				.on('set', this.setState.bind(this));
				
			this.services.push(this.lightService);
			break;
		case 'SENSOR':
			
			console.log("Sensor Type: " + this.sensorType.toLowerCase());

			if(this.sensorType.toLowerCase() === "temperature"){
				console.log("Temperature Sensor");
				
				service = new Service.TemperatureSensor(this.name);
				
				service
					.getCharacteristic(Characteristic.CurrentTemperature)
					.on('get', this.getDefaultValue.bind(this));
			}
			else if(this.sensorType.toLowerCase() === "humidity"){
				console.log("Humidity Sensor");
				
				service = new Service.HumiditySensor(this.name);
				
				service
					.getCharacteristic(Characteristic.CurrentRelativeHumidity)
					.on('get', this.getDefaultValue.bind(this));
			}
			else if(this.sensorType.toLowerCase() === "light"){
				console.log("Light Sensor");
				
				service = new Service.LightSensor(this.name);
				
				service
					.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
					.on('get', this.getDefaultValue.bind(this));
			}
				
			if(service != undefined){
				console.log("Initializing " + service.name + ", " + this.sensorType);
				
				var eventUrl = this.url + this.deviceId + "/events/" + this.eventName + "?access_token=" + this.accessToken;
				var es = new eventSource(eventUrl);

				console.log(eventUrl);

				es.onerror = function() {
					console.log('ERROR!');
				};

				es.addEventListener(this.eventName,
					this.processEventData.bind(this), false);
				
				this.services.push(service);
			}
			
			console.log("Service Count: " + this.services.length);
			break;
		case 'GARAGEDOOR':
			var service = new Service.GarageDoorOpener(this.name);
			
			service
				.getCharacteristic(Characteristic.CurrentDoorState)
				.on('get', this.getDefaultValue.bind(this))
				.on('set', this.setDoorState.bind(this));
				
			service
				.getCharacteristic(Characteristic.TargetDoorState)
				.on('get', this.getDefaultValue.bind(this))
				.on('set', this.setDoorState.bind(this));
				
			service
				.getCharacteristic(Characteristic.ObstructionDetected)
				.on('get', this.getDefaultValue.bind(this))
				.on('set', this.setDoorState.bind(this));

				console.log("Initializing " + service.name);
				
				var eventUrl = this.url + this.deviceId + "/events/" + this.eventName + "?access_token=" + this.accessToken;
				var es = new eventSource(eventUrl);

				console.log(eventUrl);

				es.onerror = function() {
					console.log('ERROR!');
				};

				es.addEventListener(this.eventName,
					this.processEventData.bind(this), false);

				
			this.services.push(service);

			break;
		default:
			console.log("Unknown service: " + this.type);
			break;
	}
  

}

ParticleAccessory.prototype.setState = function(state, callback) {
	this.log.info("Getting current state...");
	
	this.log.info("URL: " + this.url);
	this.log.info("Device ID: " + this.deviceId);
  
	var onUrl = this.url + this.deviceId + "/" + this.functionName;
	
	this.log.info("Calling function: " + onUrl);
	
	var argument = this.args.replace("{STATE}", (state ? "1" : "0"));

	request.post(
		onUrl, {
			form: {
				access_token: this.accessToken,
				args: argument
			}
		},
		function(error, response, body) {
			//console.log(response);

			if (!error) {
				callback();
			} else {
				callback(error);
			}
		}
	);
}

ParticleAccessory.prototype.setDoorState = function(state, callback) {
	this.log.info("Getting current state...");
	
	this.log.info("URL: " + this.url);
	this.log.info("Device ID: " + this.deviceId);
  
	var onUrl = this.url + this.deviceId + "/" + this.functionName;
	
	this.log.info("Calling function: " + onUrl);
	
	var argument = this.args.replace("{STATE}", (state ? "1" : "0"));

	request.post(
		onUrl, {
			form: {
				access_token: this.accessToken,
				args: argument
			}
		},
		function(error, response, body) {
			//console.log(response);

			if (!error) {
				console.log('setDoorState success! state = ', state);
				callback();
			} else {
				console.log('setDoorState Error!');
				console.log('state = ', state);
				console.log('error: ', error);
				callback(error);
			}
		}
	);
}

ParticleAccessory.prototype.processEventData = function(e){
	var data = JSON.parse(e.data);
	var tokens = data.data.split('=');
	var characteristic = tokens[0].toLowerCase();
	
	console.log(tokens[0] + " = " + tokens[1] + ", " + this.services[1].name + ", " + this.sensorType + ", " + this.key.toLowerCase() + ", " + tokens[0].toLowerCase());
	console.log(this.services[1] != undefined && this.key.toLowerCase() === tokens[0].toLowerCase());
	
	if(this.services[1] != undefined && this.key.toLowerCase() === tokens[0].toLowerCase()){
		switch( characteristic ) {
		case "temperature":
			this.value = parseFloat(tokens[1]);

			this.services[1]
				.getCharacteristic(Characteristic.CurrentTemperature)
				.setValue(parseFloat(tokens[1]));
			break;
		 case "humidity":
			this.value = parseFloat(tokens[1]);

			this.services[1]
				.getCharacteristic(Characteristic.CurrentRelativeHumidity)
				.setValue(parseFloat(tokens[1]));
			break;
		case "light":
			this.value = parseFloat(tokens[1]);

			this.services[1]
				.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
				.setValue(parseFloat(tokens[1]));
			break;
		case "currentdoorstate":
			this.value = parseInt(tokens[1], 10);

			this.services[1]
				.getCharacteristic(Characteristic.CurrentDoorState)
				.setValue(parseInt(tokens[1], 10));
			break;
		case "targetdoorstate":
			this.value = parseInt(tokens[1], 10);

			this.services[1]
				.getCharacteristic(Characteristic.TargetDoorState)
				.setValue(parseInt(tokens[1], 10));
			break;
		case "obstructiondetected":
			console.log('Characteristic ObstructionDetected: ', tokens[1]);
			this.value = parseInt(tokens[1], 10);

			this.services[1]
				.getCharacteristic(Characteristic.CurrentDoorState)
				.setValue(parseInt(tokens[1], 10));
			break;
		default:
			console.log('Unknown Characteristic: ' + characteristic);
			break;

		}
	}
}

ParticleAccessory.prototype.getDefaultValue = function(callback) {
	callback(null, this.value);
}

ParticleAccessory.prototype.setCurrentValue = function(value, callback) {
	console.log("Value: " + value);

	callback(null, value);
}

ParticleAccessory.prototype.getServices = function() {
	return this.services;
}
