/**
 * homebridge-particle-service -- Particle Service plugin for homebridge
 */

const ParticleAPI = require("particle-api-js");
//var request = require("request");
//var eventSource = require('eventsource');
var Service, Characteristic;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
  
	homebridge.registerPlatform("homebridge-particle-service", "ParticleService", ParticlePlatform);
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
	this.this_pa = this_pa;
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
	this.value;

	var processEventData = this.processEventData.bind(this);
	
	//var Particle = new ParticleAPI();
	
	var Particle = this.Particle || new ParticleAPI();
	this.Particle = Particle;

	console.log('Initializing: ' + this.name + " = " + (this.sensorType ? this.sensorType : this.type) );
	
	this.services = [];
	
	this.informationService = new Service.AccessoryInformation();

	this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Particle")
		.setCharacteristic(Characteristic.Model, "Photon")
		.setCharacteristic(Characteristic.SerialNumber, "AA098BB09");
		
	this.services.push(this.informationService);

	var service;

	switch( this.type ) {
		case 'Lightbulb': 
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
				Particle.getEventStream( { 
					'auth': this.accessToken, 
					'deviceId': this.deviceId,
					'name': this.eventName
				} )
					.then(
						function( stream ) {
							stream.on(device['event_name'], function(data) {
								console.log('EventStream Data:', data.data);
								processEventData(data);
							});
						},
						function(err) {
							console.log("Error in event stream:", err);
						});

				this.services.push(service);
			}
			
			break;
		case 'GarageDoorOpener':
			// At startup, assume the door is closed:
			this.value = Characteristic.CurrentDoorState.CLOSED;
			var service = new Service[this.type](this.name);
			//console.log('Characteristics:', service.characteristics);
			/*
			service.characteristics.forEach(function(char){
				char
					.on('get', this.getDefaultValue.bind(this))
					.on('set', this.setDoorState.bind(this));
			});
			//*/
			//*
			service
				.getCharacteristic(Characteristic.CurrentDoorState)
				.setValue(Characteristic.CurrentDoorState.CLOSED) // Default to CLOSED
				.on('get', this_pa.getDefaultValue.bind(this_pa))
				.on('set', this_pa.setDoorState.bind(this_pa)); // CurrentDoorState not writable?
				
			service
				.getCharacteristic(Characteristic.TargetDoorState)
				.setValue(Characteristic.TargetDoorState.CLOSED) // Default to CLOSED
				.on('get', this_pa.getDefaultValue.bind(this_pa))
				.on('set', this_pa.setDoorState.bind(this_pa));

			// Let's ignore ObstructionDetected for now...
			/*				
			service
				.getCharacteristic(Characteristic.ObstructionDetected)
				.on('get', this.getDefaultValue.bind(this))
				.on('set', this.setDoorState.bind(this));
			//*/
			console.log("Initialized " + service.displayName);

				
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
			
			Particle.getEventStream( { 
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

						/*
						stream.on('event', function(data) {
							console.log('EventStream Data:', data.data);
							this_pa.processEventData(data);
						});
						*/
					
						stream.on('event', processEventData);

					},
					function(err) {
						console.log("Error in event stream:", err);
					})
				.catch( err => {
					console.log('getEventStream error caught: ', err);
				});
				
			this.services.push(service);

			break;
		default:
			console.log("Unknown service: " + this.type);
			break;
	}
  
	console.log("Service Count: " + this.services.length);

}

ParticleAccessory.prototype.setState = function(state, callback) {
	var this_pa = this;
	console.info("Setting current state...");
	
	console.info("URL: " + this.url);
	console.info("Device ID: " + this.deviceId);
  
	//var onUrl = this.url + this.deviceId + "/" + this.functionName;
	
	//console.info("Calling function: " + onUrl);
	
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

	var Particle = this.Particle || new ParticleAPI();
	this.Particle = Particle; // save a reference

	Particle.callFunction({
		'auth': this_pa.accessToken,
		'deviceId': this_pa.deviceId,
		'name': this_pa.functionName,
		'argument': argument
	})
		.then(
			function(data) {
				console.log('Called function: ' + this_pa.functionName);
				console.log('device = ', this_pa.deviceId);
				console.log('state = ', state);
				console.log('args = ', argument);
				callback(null, data.return_value);
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
	console.info("Setting current door state...");

	console.info("Calling function: " + this.functionName);
	
	var argument = state;

	console.log('device = ', this.deviceId);
	console.log('state = ', state);
	console.log('args = ', argument);
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

	var Particle = this.Particle || new ParticleAPI();
	this.Particle = Particle;

	Particle.callFunction({
		'auth': this.accessToken,
		'deviceId': this.deviceId,
		'name': this.functionName,
		'argument': argument
	})
		.then(
			function(data) {
				console.log('Called function: ' + this_pa.functionName);
				console.log('function returned data: ', data);
				//console.log('callback: ', callback);
				callback(null, data.return_value);
			},
			function(err) {
				console.log('setDoorState Error!');
				console.log('device = ', this_pa.deviceId);
				console.log('state = ', state);
				console.log('args = ', argument);
				console.log('Error calling function ' + this_pa.functionName, JSON.stringify(err));
				callback(err);
			}
		)
		.catch( err => {
			console.log('Particle.callFunction error caught:', err);
		});
}

ParticleAccessory.prototype.processEventData = function(obj){
	console.log('In processEventData()');

	var data = obj.data;
	console.log('obj.data: ', data);
	var tokens = data.split('=');
	var characteristic = tokens[0].toLowerCase();
	var value = tokens[1];
	var service = this.services[1];
	
	console.log(characteristic + " = " + value + ", " + service.displayName);
	
	if(service != undefined){
		switch( characteristic ) {
		case "temperature":
			this.value = parseFloat(value);

			service
				.getCharacteristic(Characteristic.CurrentTemperature)
				.setValue(parseFloat(value));
			break;
		 case "humidity":
			this.value = parseFloat(value);

			service
				.getCharacteristic(Characteristic.CurrentRelativeHumidity)
				.setValue(parseFloat(value));
			break;
		case "light":
			this.value = parseFloat(value);

			service
				.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
				.setValue(parseFloat(value));
			break;
		case "currentdoorstate":
			this.value = parseInt(value, 10);

			service
				.getCharacteristic(Characteristic.CurrentDoorState)
				.setValue(parseInt(value, 10));
			break;
		case "targetdoorstate":
			this.value = parseInt(value, 10);

			service
				.getCharacteristic(Characteristic.TargetDoorState)
				.updateValue(parseInt(value, 10));
			break;
		case "obstructiondetected":
			console.log('Characteristic ObstructionDetected: ', value);
			//this.value = parseInt(value, 10);

			service
				.getCharacteristic(Characteristic.ObstructionDetected)
				.updateValue(value);
			break;
		default:
			console.log('Unknown Characteristic: ' + characteristic);
			break;

		}

		// Just an experiment...
		//console.log('Current Door State characteristic fetch by string:', service.getCharacteristic('Current Door State'));
	}
}

ParticleAccessory.prototype.getDefaultValue = function(callback) {
	console.log('getDefaultValue, value: ' + this.value);
	callback(null, this.value);
}

ParticleAccessory.prototype.setCurrentValue = function(value, callback) {
	console.log("setCurrentValue, Value: " + value);
	this.value = value;

	callback(null, value);
}

ParticleAccessory.prototype.getServices = function() {
	return this.services;
}
