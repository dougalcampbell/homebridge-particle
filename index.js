var ParticleAPI = require("particle-api-js");
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
	var this_pa = this;
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
	
	this.Particle = new ParticleAPI();
		
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
				console.log("Initializing " + service.displayName + ", " + this.sensorType);
				
				/*
				var eventUrl = this.url + this.deviceId + "/events/" + this.eventName + "?access_token=" + this.accessToken;
				var es = new eventSource(eventUrl);

				console.log(eventUrl);

				es.onerror = function() {
					console.log('ERROR!');
				};

				es.addEventListener(this.eventName,
					this.processEventData.bind(this), false);
				*/
				this.Particle.getEventStream( { 
					'auth': this.accessToken, 
					'deviceId': this.deviceId,
					'name': this.eventName
				} )
					.then(
						function( stream ) {
							stream.on(this_pa.eventName, function(data) {
								console.log('EventStream Data:', data.data);
								this_pa.processEventData(data);
							});
						},
						function(err) {
							console.log("Error in event stream:", err);
						});

				this.services.push(service);
			}
			
			console.log("Service Count: " + this.services.length);
			break;
		case 'GARAGEDOOR':
			var service = new Service.GarageDoorOpener(this.name);
			
			service
				.getCharacteristic(Characteristic.CurrentDoorState)
				//.on('get', this.getDefaultValue.bind(this))
				//.on('set', this.setDoorState.bind(this));
				.on('get', this.getDefaultValue)
				.on('set', this.setDoorState);
				
			service
				.getCharacteristic(Characteristic.TargetDoorState)
				//.on('get', this.getDefaultValue.bind(this))
				//.on('set', this.setDoorState.bind(this));
				.on('get', this.getDefaultValue)
				.on('set', this.setDoorState);
				
			service
				.getCharacteristic(Characteristic.ObstructionDetected)
				//.on('get', this.getDefaultValue.bind(this))
				//.on('set', this.setDoorState.bind(this));
				.on('get', this.getDefaultValue)
				.on('set', this.setDoorState);

			console.log("Initializing " + service.displayName);
				
				/*
				var eventUrl = this.url + this.deviceId + "/events/" + this.eventName + "?access_token=" + this.accessToken;
				var es = new eventSource(eventUrl);

				console.log(eventUrl);

				es.onerror = function() {
					console.log('ERROR!');
				};

				es.addEventListener(this.eventName,
					this.processEventData.bind(this), false);
				*/
			
			this.Particle.getEventStream( { 
				'auth': this.accessToken, 
				'deviceId': this.deviceId,
				'name': this.eventName
			} )
				.then(
					function( stream ) {
						/*
						stream.on( 'event', function(data) {
							console.log('EventStream Data:', data);
							this.processEventData.bind(this);
						});
						*/
						//console.log('stream', stream);
						console.log('Got a stream. Adding EventListener...');
						console.log('listening for:' + this_pa.eventName);

						stream.on('event', function(data) {
							console.log('EventStream Data:', data.data);
							this_pa.processEventData(data);
						});
					},
					function(err) {
						console.log("Error in event stream:", err);
					});
				
			this.services.push(service);

			break;
		default:
			console.log("Unknown service: " + this.type);
			break;
	}
  

}

ParticleAccessory.prototype.setState = function(state, callback) {
	var this_pa = this;
	console.log.info("Getting current state...");
	
	console.log.info("URL: " + this.url);
	console.log.info("Device ID: " + this.deviceId);
  
	var onUrl = this.url + this.deviceId + "/" + this.functionName;
	
	console.log.info("Calling function: " + onUrl);
	
	var argument = this.args.replace("{STATE}", (state ? "1" : "0"));

	/*
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
	*/

	this.Particle.callFunction({
		'auth': this_pa.accessToken,
		'deviceId': this_pa.deviceId,
		'name': this_pa.functionName,
		'argument': argument
	})
		.then(
			function(data) {
				console.log('Called function: ' + this_pa.functionName);
				callback();
			},
			function(err) {
				console.log('setState Error!');
				console.log('device = ', this_pa.deviceId);
				console.log('state = ', state);
				console.log('args = ', argument);
				console.log('Error calling function ' + this_pa.functionName, err);
				callback(err);
			}
		);
}

ParticleAccessory.prototype.setDoorState = function(state, callback) {
	var this_pa = this;
	console.log.info("Getting current state...");
	
	console.log.info("URL: " + this.url);
	console.log.info("Device ID: " + this.deviceId);
  
	var onUrl = this.url + this.deviceId + "/" + this.functionName;
	
	console.log.info("Calling function: " + onUrl);
	
	var argument = this.args.replace("{STATE}", state);

	/*
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
	*/

	this.Particle.callFunction({
		'auth': this_pa.accessToken,
		'deviceId': this_pa.deviceId,
		'name': this_pa.functionName,
		'argument': argument
	})
		.then(
			function(data) {
				console.log('Called function: ' + this_pa.functionName);
				callback();
			},
			function(err) {
				console.log('setDoorState Error!');
				console.log('device = ', this_pa.deviceId);
				console.log('state = ', state);
				console.log('args = ', argument);
				console.log('Error calling function ' + this_pa.functionName, JSON.stringify(err));
				callback(err);
			}
		);
}

ParticleAccessory.prototype.processEventData = function(obj){
	console.log('In processEventData()');

	var data = obj.data;
	console.log('obj.data: ', data);
	var tokens = data.split('=');
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
	console.log('getDefaultValue, value: ' + this.value);
	callback(null, this.value);
}

ParticleAccessory.prototype.setCurrentValue = function(value, callback) {
	console.log("setCurrentValue, Value: " + value);

	callback(null, value);
}

ParticleAccessory.prototype.getServices = function() {
	return this.services;
}
