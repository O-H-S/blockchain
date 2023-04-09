var app = require('express')();
var http = require('http');
var socketio = require('socket.io');
var ss = require('socket.io-stream');
var socketio_client = require("socket.io-client");
var path = require('path');
var fs = require('fs');
var HashTable = require("jshashtable");
const CryptoUtil = require('../security/cryptoUtil');

var netManager;

class NetManager
{
	constructor(_port, _user)
	{
		netManager = this;
		this.user = _user;
		
		this.serverPort = _port;
		this.socketio_client = socketio_client;
		this.clients = {};
		this.clientConnections = {};
		this.connectEvent = [];
		this.disconnectEvent = [];
		
		this.guests = {};
		this.guestConnections = {};
		this.guest_connectEvent = [];
		this.guest_disconnectEvent = [];
		
		
		
		this.fileDownloadState = new HashTable();
		this.fileUploadState = new HashTable();
		
		this.fileUploadStartEvent = [];
		this.fileUploadEndEvent = [];
		
		this.fileDownloadPrestartEvent = [];
		this.fileDownloadStartEvent = [];
		this.fileDownloadEndEvent = [];
		
		
		this.fileDownloadPath = '';
		
		if (!fs.existsSync('data/' + netManager.user)) 
			fs.mkdirSync('data/' + netManager.user );
		if (!fs.existsSync('data/' + netManager.user + '/files')) 
			fs.mkdirSync('data/' + netManager.user + '/files');
		
	}
	
	
	release()
	{
		this.closeServer();
		this.closeClients();	
		
	}
	
	openServer()
	{
		this.httpServer = http.createServer(app);
		this.server = socketio(this.httpServer);
		
		this.httpServer.listen(this.serverPort, 
			function() 
			{
				//console.log('Net : listening..');
			}
		);
		
		this.server.on('connection', 
			function(socket) 
			{
				var ip = netManager.getIP(socket);
				var port = socket.request.connection._peername.port;
				
				var address = netManager.getAddress(ip, port);
				//console.log(address);
				//console.log('client connected : ' + ip + ':' + port);
				if(!netManager.guestConnections[address])
					netManager.guestConnections[address] = true;
				
				netManager.guests[address] = socket;
				
				for(var func of netManager.guest_connectEvent)
				{						  
					func.call(this, socket, address);
				}
				
				ss(socket).on('upload',
					function(stream, data)
					{
						for(var func of netManager.fileDownloadPrestartEvent)
						{						  
							func.call(this, socket, stream, data);
						}
						
						
						var fn = CryptoUtil.randomId(32);
						if(data.name)
						{
							fn = path.basename(data.name);
						}
						else
						{
							data.name = fn;
						}
						stream.pipe(fs.createWriteStream('data/' + netManager.user + '/files/' + netManager.fileDownloadPath + fn));
						data.path = 'data/' + netManager.user + '/files/' + netManager.fileDownloadPath + fn;
						netManager.fileDownloadPath = '';
						netManager.setFileDownloading(socket, data.name, data, true);
						for(var func of netManager.fileDownloadStartEvent)
						{						  
							func.call(this, socket, stream, data);
						}
						
						stream.on('end', 
							function()
							{
								netManager.setFileDownloading(socket, data.name, data, false);
								for(var func of netManager.fileDownloadEndEvent)
								{						  
									func.call(this, socket, stream, data);
								}
							}
						);
					}
				);
				
				
				
				socket.on('disconnect', 
					function() 
					{
						if(netManager.guestConnections[address])
						{
							netManager.guestConnections[address] = false;
							delete netManager.guests[address];
						}
						var address = netManager.getAddress(ip, port);
						for(var func of netManager.guest_disconnectEvent)
						{						  
							func.call(this, socket, address);
						}
						
					}
				);
			}
		);
		

	}
	
	closeServer()
	{
		if(this.server)
			this.server.close();		
	}
	
	closeClients()
	{
		var keys = Object.keys(this.clients);
		for(var address of keys)
		{
			var soc = this.clients[address];
			soc.close();
		}
	}

	
	isFileUploading(socket, path, data) // 절대 경로
	{		
		var pathTable = this.fileUploadState.get(socket); // call by reference		
		if(!pathTable)
		{
			return false;
		}
		
		if(!pathTable[path])
			return false;
		
		return pathTable[path][JSON.stringify(data)];
	}
	
	isFileDownloading(socket, relpath, data) // 상대 경로
	{		
		var pathTable = this.fileDownloadState.get(socket); // call by reference		
		if(!pathTable)
		{
			return false;
		}
		
		if(!pathTable[path])
			return false;
		
		return pathTable[path][JSON.stringify(data)];
	}
	
	setFileUploading(socket, path, data, state)
	{
		// deep copy => JSON.parse(JSON.stringify(a))		
		var pathTable = this.fileUploadState.get(socket); // call by reference		
		if(!pathTable)
		{
			pathTable = {};		
			this.fileUploadState.put(socket, pathTable);
		}
		
		var pathEntry = pathTable[path];
		if(!pathEntry)
		{
			pathEntry = {};
			pathTable[path] = pathEntry;
		}		
		
		var dataKey = JSON.stringify(data);
		pathEntry[dataKey] = state;
	}
	
	setFileDownloading(socket, path, data, state)
	{
		// deep copy => JSON.parse(JSON.stringify(a))		
		var pathTable = this.fileUploadState.get(socket); // call by reference		
		if(!pathTable)
		{
			pathTable = {};		
			this.fileUploadState.put(socket, pathTable);
		}
		
		var pathEntry = pathTable[path];
		if(!pathEntry)
		{
			pathEntry = {};
			pathTable[path] = pathEntry;
		}		
		
		var dataKey = JSON.stringify(data);
		pathEntry[dataKey] = state;
	}
	
	
	
	uploadFile(socket, path, data)
	{
		if(this.isFileUploading(socket, path, data))
			return false;
		
		this.setFileUploading(socket, path, data, true);
		
		var stream = ss.createStream();
		var filename = path;
 
		ss(socket).emit('upload', stream, data);
		fs.createReadStream(filename).pipe(stream);
		
		for(var func of netManager.fileUploadStartEvent)
		{						  
			func.call(this, socket, stream, data);
			
		}
		
		
		stream.on('end', 
			function()
			{
				netManager.setFileUploading(socket, path, data, false);
				//console.log("uploaded");
				for(var func of netManager.fileUploadEndEvent)
				{						  
					func.call(this, socket, stream, data);
					
				}
			}
		);
		
		return true;
	}
	
	tryConnectTo(ip, port)
	{		

		var address = this.getAddress(ip, port);
		if(this.clientConnections[address]) // 이미 연결된 경우.
			return false;
		
		if( this.clients[address]) // 연결 시도중인 경우?
		{
			return false;
		}
		else		
		{
			this.clients[address] = socketio_client.connect('http://'+ip+':' + port);
			this.clients[address].on('connect', 
				() => 
				{
				  //console.log('connected to server : ' + ip + ':' + port);				  
				  this.clientConnections[address] = true;
				  for(var func of netManager.connectEvent)
				  {					  
					  func.call(this, this.clients[address], address);
				  }
				}
			);
			
			
			this.clients[address].on('disconnect', 
				() => 
				{
				 // console.log('disconnected to server');
				  this.clientConnections[address] = false;
				  for(var func of netManager.disconnectEvent)
				  {
					  func.call(this, this.clients[address], address);
				  }
				}
			);
			
			
			//this.clientsAddress[this.clients[address]] = address;
			//console.log(this.clients[address]);
			return this.clients[address];
		}

	}
	
	getIP(socket)
	{
		var address = socket.handshake.address;
		var idx = address.lastIndexOf(':');
		if (~idx && ~address.indexOf('.'))
			address = address.slice(idx + 1);
		return address;
	}
	
	getPort(socket)
	{
		var port = socket.request.connection._peername.port;
		return port;
	}
	
	getAddress(ip, port)
	{
		return ip + ":" + port;
	}
	
	getClientSocket(address)
	{
		return this.clients[address];
	}
	
}

module.exports = NetManager;