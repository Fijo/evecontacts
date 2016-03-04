var request = require("request"),
    fs = require('fs'),
    express = require('express'),
	cookieParser = require('cookie-parser'),
	bodyParser = require('body-parser'),
	uuid = require('node-uuid'),
	_ = require('underscore'),
	Promise = require('promise'),
	base64 = require('base64encodedecode');


var getUtcTime = function()	{
	var now = new Date;
	var utc_timestamp = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(), now.getUTCDate() , 
      now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
	return utc_timestamp;
};

var crest = (function(request, _, getUtcTime)	{
	var cRestReqLimitPerSec = 20; //https://developers.eveonline.com/blog/article/a-note-on-crest-rate-limits
	var reqEveryXms = Math.ceil(1000 / cRestReqLimitPerSec);
	var reqQueue = [];
	var reqCount = 0;
	var startTime = getUtcTime();

	setInterval(function()	{
		if(reqQueue.length != 0)	{
			reqQueue.shift()();
			reqCount++;
		}
	}, reqEveryXms);

	var getStats = function()	{
		var runtimeInH = (getUtcTime() - startTime) / 3600000;
		return {
			totalRequests: reqCount,
			requestsPerHour: Math.round(reqCount / runtimeInH),
			runtimeInH: runtimeInH
		};
	};

	var pushReq = function(doRequest)	{
		reqQueue.push(doRequest);
	};
	var detectErrors = function(callback, errorCallback)	{
		return function(error, response, data)	{
			if(error) {
				errorCallback(error);
				return;
			}
			if(typeof data == "string")	{
				var tmp;
				try{
					tmp = JSON.parse(data);
				}
				catch(e){}
				if(tmp != null && tmp.exceptionType != null)	{
					errorCallback(tmp);
					return;
				}
			}
			if(data != null && data.exceptionType != null)	{
				errorCallback(data);
				return;
			}
			return callback.apply(this, arguments);
		};
	};
	var internalGet = function(token, url, callback, errorCallback)	{
		pushReq(function()	{
			request.get({
				url: url,
				json: true,
				headers: token == null ? null : {
					Accept: 'application/vnd.ccp.eve.Api-v3+json',
					Authorization: 'Bearer ' + token,
				}
			}, detectErrors(callback, errorCallback));
		});
	};
	var self = {
		get: function(token, url, callback, errorCallback, dataFromBefore)	{
			internalGet(token, url, function(error, response, data)	{
				if(data.items == null || !_.isArray(data.items))	{
					callback.apply(this, arguments);
					return;
				}
				var dataToPass = (dataFromBefore || []).concat(data.items);
				if(data.next != null) self.get(token, data.next.href, callback, errorCallback, dataToPass);
				else callback(error, response, dataToPass);
			}, errorCallback);
		},
		post: function(token, url, data, callback, errorCallback)	{
			pushReq(function()	{
				request.post({
					url: url,
					json: false,
					body:  JSON.stringify(data),
					headers: {
						Accept: 'application/vnd.ccp.eve.Api-v3+json',
					    'content-type': 'application/json',
						Authorization: 'Bearer ' + token
					}
				}, detectErrors(callback, errorCallback));
			});
		},
		del: function(token, url, callback, errorCallback)	{
			pushReq(function()	{
				request.del({
					url: url,
					json: false,
					headers: {
						Accept: 'application/vnd.ccp.eve.Api-v3+json',
					    'content-type': 'application/json',
						Authorization: 'Bearer ' + token
					}
				}, detectErrors(callback, errorCallback));
			});
		},
		stats: getStats
	};
	return self;
})(request, _, getUtcTime);

var eveapi = (function(request, crest, fs, _, base64)	{
	var config = {}; 
	fs.readFile('.apiKey', 'utf8', function(err, data)	{
		if(err) throw err;
		config.apiKey = data.trim();
	});
	fs.readFile('.clientId', 'utf8', function(err, data)	{
		if(err) throw err;
		config.clientId = data.trim();
	});

	var getContactData = function(contact)	{
		return {
			standing: parseInt(contact.standing),
			contactType: contact.contactType,
			watched: contact.watched,
			contact: {
				id_str: contact.contact.id_str,
				href: contact.contact.href,
				name: contact.contact.name,
				id: contact.contact.id
			}
		};
	};
	var baseUrl = {
		auth: 'https://login.eveonline.com/',
		crest: 'https://crest-tq.eveonline.com/',
		publicCrest: 'https://public-crest.eveonline.com/'
	};

	return {
		getClientId: function()	{
			return config.clientId;
		},
		getToken: function(code, callback, errorCallback)	{
			request.post({
			    url: baseUrl.auth + 'oauth/token',
			    json: true,
			    form: {
			    	grant_type: 'authorization_code',
			    	code: code
			    },
			    headers: {
			    	'Content-Type': 'application/x-www-form-urlencoded',
			    	Authorization: 'Basic ' + base64.base64Encode(config.clientId + ':' + config.apiKey),
			    	Host: 'login.eveonline.com'
			    }
			}, function (error, response, data) {
				if(data.error_description == 'Authorization code not found') errorCallback(data);
				else callback(data.access_token);
			}, errorCallback);
		},
		getCharacter: function(token, callback, errorCallback)	{
			crest.get(token, baseUrl.crest + 'decode/', function(error, response, data)	{
				if(!data)	{
					errorCallback();
					return;
				}
				crest.get(token, data.character.href, function(error, response, data)	{
					callback(data);
				}, errorCallback);
			}, errorCallback);
		},
		getContacts: function(token, characterId, callback, errorCallback)	{
			crest.get(token, baseUrl.crest + 'characters/' + characterId + '/contacts/', function(error, response, data)	{
				callback(data);
			}, errorCallback);
		},
		addContacts: function(token, characterId, contacts, callback, errorCallback)	{
			var count = contacts.length, i = 0;
			var innerCallback = function(error, response, data)	{
				if(++i == count) callback(error, response, data);
			};
			_.each(contacts, function(contact)	{
				var url = baseUrl.crest + 'characters/' + characterId + '/contacts/';
				crest.del(token, url + contact.contact.id + '/', function(error, response, data)	{
					crest.post(token, url, getContactData(contact), innerCallback, errorCallback);
				}, errorCallback);
			});
		},
		delContacts: function(token, characterId, contacts, callback, errorCallback)	{
			var count = contacts.length, i = 0;
			var innerCallback = function(error, response, data)	{
				if(++i == count) callback(error, response, data);
			};
			_.each(contacts, function(contact)	{
				crest.del(token, baseUrl.crest + 'characters/' + characterId + '/contacts/' + contact.contact.id + '/', innerCallback, errorCallback);
			});
		},
		getStatus: function(token, callback, errorCallback)	{
			crest.get(token, baseUrl.publicCrest, function(error, response, data)	{
				if(!data)	{
					errorCallback();
					return;
				}
				crest.get(token, data.character.href, function(error, response, data)	{
					callback(data);
				}, errorCallback);
			}, errorCallback);
		}
	};
})(request, crest, fs, _, base64);




var app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json({
	limit: '50mb'
}));
app.use(express.static('site'));
app.use(cookieParser('ivTpZfgXCJ'));

var nodePersistor = (function(fs, Promise, _)	{
	var ensureDirExists = function(path, mask, cb) {
		fs.mkdir(path, mask, function(err) {
			if (err && err.code != 'EEXIST') cb(err);
			cb(null);
		});
	}

	var baseDir = __dirname + '/.pnode';
	var dirInitPromise = new Promise(function (resolve, reject) {
		ensureDirExists(baseDir, 0744, function(err) {
			if (err)	{
				console.warn('NodePersistor could not be initialized! (I/O Error)');
				console.warn(err);
				reject(err);
			}
			else resolve();
		});
	});

	return function(name, obj)	{
		var fileName = baseDir + '/' + name + '.json';
		dirInitPromise.then(function()	{
			fs.readFile(fileName, 'utf8', function(err, data)	{
				if(err && err.code != 'ENOENT') throw err;
				else	{
					try{
						_.defaults(obj, JSON.parse(data));
					}
					catch(e)	{
						console.warn('NodePersistor could not restore the data for ´' + name + '´. (invalid JSON)');
						console.warn(e);
					}
					setInterval(function()	{
						var content;
						try	{
							content = JSON.stringify(obj);
						}
						catch(e)	{
							console.warn('NodePersistor could serialize data for ´' + name + '´. (JSON.stringify faild)');
							console.warn(e);
							return;
						}
						fs.writeFile(fileName, content, function(err, data)	{
							if(err)	{
								console.warn('NodePersistor could not persist data for ´' + name + '´. (I/O Error)');
								return;
							}
						});
					}, 5000);
				}
			})

		});
	};
})(fs, Promise, _);

var userManager = (function(uuid)	{
	var generateHash = uuid.v4;
	var users = {

	};
	new nodePersistor('user', users);
	var getInitialData = function()	{
		return {
			api: {
			},

			public: {
				characters: [
					{
						type: 'Source'
					},
					{
						type: 'Target'
					}
				],
				errors: []
			}
		};
	};
	var addUser = function()	{
		var id = generateHash();
		users[id] = {
			data: getInitialData()
		};
		return id;
	};
	var getUserData = function(id)	{
		if(users[id] == null) return null;
		return users[id].data;
	};
	var maxCookieAge = 2 * 60 * 60 * 1000;
	var setCookie = function(res, id)	{
		res.cookie('id', id, { maxAge: maxCookieAge });
	};
	var getCookieData = function(req)	{
		if(req.cookies.id != null)
			return getUserData(req.cookies.id);
	}

	return {
		getInfo: function(req, res)	{
			var cookieData = getCookieData(req);
			if(cookieData != null) return cookieData;
			var id = addUser();
			setCookie(res, id);
			return getUserData(id);
		}
	};
})(uuid, nodePersistor);


var logErrorCallback = function(data)	{
	return function(error)	{
		data.public.errors.push({
			data: error,
			time: getUtcTime(),
			id: uuid.v4()
		});
	};
};

app.get('/stats', function(req, res)	{
	res.send(JSON.stringify(crest.stats()));
})

app.get('/clientId', function(req, res)	{
	res.send(eveapi.getClientId());
})

app.post('/ex/del', function (req, res) {
	var data = userManager.getInfo(req, res);
	var id = req.body.id;
	data.public.errors = _.filter(data.public.errors, function(error)	{
		return error.id != id;
	});
	res.send('gotcha');
});

app.post('/user/add', function (req, res) {
	var data = userManager.getInfo(req, res);
	eveapi.getToken(req.body.code, function(token)	{
		var apiData = data.api[req.body.characterType] = {
			token: token
		};
		eveapi.getCharacter(token, function(character)	{
			apiData.character = character;
			var publicCharData = _.findWhere(data.public.characters, {type: req.body.characterType});
			publicCharData.character = character;
			eveapi.getContacts(token, character.id, function(contacts)	{
				publicCharData.contacts = contacts;
			}, logErrorCallback(data));
		}, logErrorCallback(data));
	}, logErrorCallback(data));
	res.send('gotcha');
});

app.post('/user/remove', function (req, res) {
	var data = userManager.getInfo(req, res);
	data.api[req.body.characterType] = null;
	var publicData = _.findWhere(data.public.characters, {type: req.body.characterType});
	publicData.character = null;
	publicData.contacts = null;
	res.send('gotcha');
});



app.post('/contact/add', function (req, res) {
	var contacts = JSON.parse(req.body.contacts);
	var destType = req.body.destType;

	var data = userManager.getInfo(req, res);
	var destApi = data.api[destType];

	var publicData = _.findWhere(data.public.characters, {type: destType});
	var publicContacts = publicData.contacts;
	_.each(contacts, function(contact)	{
		var found = false;
		_.each(publicContacts, function(publicContact)	{
			if(publicContact.contact.href == contact.contact.href)	{
				_.extend(publicContact, contact);
				found = true;
			}
		});
		if(!found) publicContacts.push(contact);
	});

	eveapi.addContacts(destApi.token, destApi.character.id, contacts, function(){}, logErrorCallback(data));
	res.send('gotcha');
});

app.post('/contact/del', function (req, res) {
	var contacts = JSON.parse(req.body.contacts);
	var destType = req.body.destType;

	var data = userManager.getInfo(req, res);
	var destApi = data.api[destType];

	var publicData = _.findWhere(data.public.characters, {type: destType});
	var publicContacts = publicData.contacts;
	publicData.contacts = _.filter(publicContacts, function(publicContact)	{
		return _.every(contacts, function(contact)	{
			return publicContact.contact.href != contact.contact.href;
		});
	});

	eveapi.delContacts(destApi.token, destApi.character.id, contacts, function(){}, logErrorCallback(data));
	res.send('gotcha');
});

app.post('/user', function (req, res) {
	var data = userManager.getInfo(req, res);
	res.send(JSON.stringify(data.public));
});

app.listen(3000, function () {
  console.log('Server listening on port 3000!');
});