const R = require('ramda');
const netMgr = require('../network/netmanager.js');
const HashTable = require("jshashtable");
const os = require('os');
const ifaces = os.networkInterfaces();


/*
require('dns').lookup(require('os').hostname(), 
	function (err, add, fam) 
	{
		console.log('addr: '+add);
	}
)*/





class Peer
{
	constructor(_ip, _port, _port2,_localhost, _internal)
	{
		this.ip = _ip;
		this.serverPort = _port;
		this.clientPort = _port2;
		this.localhost = _localhost;
		this.internal = _internal;
	}
	
	getInputAddress()
	{
		return this.ip + ":" + this.clientPort;
	}	
	
	getOutputAddress()
	{
		return this.ip + ":" + this.serverPort;
	}
}

var node;
class Node 
{
    constructor(_netMgr)
	{
		node = this;
		
		this.netMgr = _netMgr;		
		

		this.eventHandlers = {};
		this.socketEventHandlers = {};
		
		
		this.peerAdvertisements = [];
		
		
		this.peersList = []; 
		this.peersByOutputAddress = {};
		this.peersByInputAddress = {};
		//this.connectedPeers = {}; // key : , value : peer object
		
		this.init();
	}
	
	
	
	init()
	{				
		this.netMgr.openServer();

		
		// Event 핸들러
		//this.netMgr.server.on("connection", this.givePeers);
		this.netMgr.server.on("connection", this.tryToBePeer);
		
		this.addEventHandler("onPeerConnect", this.deliverAdverts);
		this.addEventHandler("deliverAdvert", this.registerPeerAdvert);
		
		this.netMgr.connectEvent.push(this.onConnectToServer);		
		this.netMgr.disconnectEvent.push(this.onDisconnectToServer);
		this.netMgr.guest_disconnectEvent.push(this.onDisconnectToClient);		
				
		this.netMgr.fileUploadStartEvent.push(this.onfileUploadStartEvent);
		this.netMgr.fileUploadEndEvent.push(this.onfileUploadEndEvent);
		
		this.netMgr.fileDownloadPrestartEvent.push(this.onfileDownloadPrestartEvent);
		this.netMgr.fileDownloadStartEvent.push(this.onfileDownloadStartEvent);
		this.netMgr.fileDownloadEndEvent.push(this.onfileDownloadEndEvent);
		

	}
	
	release()
	{			
		this.netMgr.release();		
	}
	
	updateMyAdvert(newAD)
	{
		//var myAD = this.getAdvertisement();
		this.advertisement = newAD;
		node.triggerEvent(null, "deliverAdvert", newAD);
	}
	
	getAddressFromAdvert(ad)
	{
		var myAD = this.getAdvertisement();
		//console.log(myAD);
		//console.log(ad);
		//console.log(myAD["externalIP"]);
		//console.log(ad["externalIP"]);
		// 나 자신일 경우,
		if(myAD["externalIP"] == ad["externalIP"] && myAD["internalIP"] == ad["internalIP"] && myAD["port"] == ad["port"])
		{
			return "127.0.0.1:" + myAD["port"];
		}
		
		// 내부망(or 같은 기기), inIP로 접속
		if(myAD["externalIP"] == ad["externalIP"] && myAD["port"] != ad["port"])
		{
			if(ad["internalIP"]) // 내부 네트워크
			{
				return ad["internalIP"] +":" + ad["port"];
			}
			else // 같은 기기 (address : 127.0.0.1)
			{
				return "127.0.0.1:" + ad["port"];
			}
		}
			
		// 외부망
		if(myAD["externalIP"] != ad["externalIP"] )
		{
			
			return ad["externalIP"] + ":" + ad["port"];
		}
	}
	
	connectFromAdvert(ad)
	{
		var myAD = this.getAdvertisement();		
		// 나 자신일 경우, 무시
		
		if(myAD["externalIP"] == ad["externalIP"] && myAD["internalIP"] == ad["internalIP"] && myAD["port"] == ad["port"])
		{
			return;
		}
		
		// 내부망(or 같은 기기), inIP로 접속
		if(myAD["externalIP"] == ad["externalIP"] && myAD["port"] != ad["port"])
		{
			if(ad["internalIP"]) // 내부 네트워크
			{
				this.connectToPeer(ad["internalIP"], ad["port"]);
			}
			else // 같은 기기 (address : 127.0.0.1)
			{
				this.connectToPeer("127.0.0.1", ad["port"]);
			}
			return;
		}
		
		
		// 외부망
		if(myAD["externalIP"] != ad["externalIP"] )
		{
			this.connectToPeer(ad["externalIP"], ad["port"]);
			return;
		}
		
	}
	
	findAdvert(exIP, inIP, port)
	{
		var adCount = node.peerAdvertisements.length;
		for(var i = 0; i < adCount; i++)
		{
			var ad = node.peerAdvertisements[i];
			if(ad["externalIP"] == exIP && ad["internalIP"] == inIP && ad["port"] == port)
			{
				return i;
			}
		}		
		return -1;
	}
	
	deliverAdverts(address)
	{				
		var adCount = node.peerAdvertisements.length;
		node.triggerEvent([address], "deliverAdvert", node.getAdvertisement()); // 자기 광고 
		for(var i = 0; i < adCount; i++)
		{
			node.triggerEvent([address], "deliverAdvert", node.peerAdvertisements[i]);		
		}
		
	}
	
	registerPeerAdvert(address, advert)
	{
		
		var myAD = this.getAdvertisement();
		// 나 자신일 경우, 무시
		if(myAD["externalIP"] == advert["externalIP"] && myAD["internalIP"] == advert["internalIP"] && myAD["port"] == advert["port"])
		{
			return;
		}
		
		var adCount = node.peerAdvertisements.length;
		for(var i = 0; i < adCount; i++)
		{
			var ad = node.peerAdvertisements[i];
			if(ad["externalIP"] == advert["externalIP"] && ad["internalIP"] == advert["internalIP"] && ad["port"] == advert["port"])
			{			
				if(JSON.stringify(ad) != JSON.stringify(advert))
				{
					node.triggerEvent(null, "deliverAdvert", node.peerAdvertisements[i]);
					node.peerAdvertisements[i] = advert;

				}
				
				return;
			}
		}		
		node.peerAdvertisements.push(advert);	
		//console.log(node.peerAdvertisements.length);		
		node.triggerEvent(null, "deliverAdvert", advert);			
	}
	
	getAdvertisement()
	{
		if(!this.advertisement)
		{
			//console.log("------------------------");
			var exip;
			var inip = null;
			Object.keys(ifaces).forEach(function (ifname) 
			{
			  var alias = 0;
			  ifaces[ifname].forEach(function (iface) 
			  {
				if ('IPv4' !== iface.family ) 
				{
					return;
				}
				//console.log(iface);
				if(iface.internal )
				{
					if(iface.address != "127.0.0.1")
						inip = iface.address;
				}
				else
				{
					exip = iface.address
				}
			  });
			});
			
			//console.log("------------------------");
			this.advertisement = {};
			this.advertisement["externalIP"] = exip;
			this.advertisement["internalIP"] = inip;
			this.advertisement["port"]= this.netMgr.serverPort;			
			
			
		}
		
		return this.advertisement;
	}
	
	onfileUploadStartEvent(socket , stream, data)
	{
		node.triggerEventToMe(node.getPeer(socket), "onfileUploadStartEvent", stream, data);
	}
	
	onfileUploadEndEvent(socket , stream, data)
	{
		node.triggerEventToMe(node.getPeer(socket), "onfileUploadEndEvent", stream, data);
	}
	
	onfileDownloadPrestartEvent(socket , stream, data)
	{

		node.triggerEventToMe(node.getPeer(socket), "onfileDownloadPrestartEvent", stream, data);
	}
	
	onfileDownloadStartEvent(socket , stream, data)
	{
		node.triggerEventToMe(node.getPeer(socket), "onfileDownloadStartEvent", stream, data);
	}
	onfileDownloadEndEvent(socket , stream, data)
	{
		node.triggerEventToMe(node.getPeer(socket), "onfileDownloadEndEvent", stream, data);
	}
	
	onConnectToServer(socket, address)
	{
		node.registerEventHandler(address);
		if(node.isMe(address))
		{
			node.registerEventHandlerToMe();
		}

	}
	
	onDisconnectToServer(socket, address)
	{
		var peer = node.getPeerByOutputAddress(address);
		if(peer)
		{
			node.removePeer(peer);
			node.triggerEventToMe(address, "onPeerDisconnect", address);
			
		}
		
		node.unregisterEventHandler(address);
		
	}
	
	onDisconnectToClient(socket, address)
	{
		//console.log(socket);
		//console.log("test1");
		//console.log(address);
		var peer = node.getPeerByInputAddress(address);
		if(peer)
		{
			//console.log("peer exist : " + address);
			var outputAddress = peer.getOutputAddress();
			node.removePeer(peer);
			node.triggerEventToMe(outputAddress, "onPeerDisconnect", outputAddress);
		}

	}
	
	
	unregisterEventHandler(peer)
	{
		if(node.socketEventHandlers[peer])
			delete node.socketEventHandlers[peer];
	}
	
	registerEventHandlerToMe()
	{
		
		
	}
	
	registerEventHandler(peer)
	{
		if(!node.socketEventHandlers[peer])
			node.socketEventHandlers[peer] = {};
		
		//for(var eventName in node.eventHandlers)
		//{
		//	if(!node.socketEventHandlers[peer][eventName])
		//		node.socketEventHandlers[peer][eventName] = ;
		//}
		
		for(var eventName in node.eventHandlers)
		{
			//for(var eventHandler of node.eventHandlers[eventName]) // of? in?
			//{
				if(node.isSocketHasEventHandler(peer, eventName))
				{
					
				}
				else
				{
					this.socketEventHandlers[peer][eventName] = true;
									
					node.getSocket(peer).on(eventName, 					
					(...args) =>
					{
						var calledEvent = args[args.length-1]
						//console.log(peer + " " + calledEvent);
						for(var eventHandler of node.eventHandlers[calledEvent])
						{
							if(eventHandler)
								eventHandler.call(this, peer,...args);
						}
					});
					//console.log(" registered !! " + eventName+ " "  + peer );	
					//console.log(node.getSocket(peer)._callbacks);
				}
				
			//}
		}
		
	}
	
	isSocketHasEventHandler(socket, eventName)
	{
		if(!this.socketEventHandlers[socket])
			this.socketEventHandlers[socket] = {};
		
		var handler = this.socketEventHandlers[socket][eventName];
		return handler;
	}
	
	uploadFile(address, path, data)
	{
		return this.netMgr.uploadFile( this.netMgr.getClientSocket(address), path, data);
		
	}
	
	setDownloadPath(path)
	{
		this.netMgr.fileDownloadPath = path;		
	}
	
	
	
	givePeers(socket)
	{	
		socket.emit("getPeers", [0]);
	}
	
	tryToBePeer(socket)
	{	
		socket.once("giveport", node.bindPeer);
		socket.emit("tryPeer");
		
	}
	
	bindPeer( port)
	{
		var socket = this;
		var targetAddress = node.netMgr.getAddress(node.netMgr.getIP(socket), port);	

		
		
		var socketIP = node.netMgr.getIP(socket);
		var socketPort = node.netMgr.getPort(socket);
		
		//console.log(socketIP + " " + socketPort + " " + port);
		
		
		if( node.netMgr.clientConnections[targetAddress]) // 이미 거기에 연결되어 있다면..
		{
			if( !node.getPeer(node.netMgr.getIP(socket), port, node.netMgr.getPort(socket))) // 해당 peer 오브젝트가 없다면
			{
				node.addPeer(node.netMgr.getIP(socket), port, node.netMgr.getPort(socket) , false, false);
				/*
				var newPeer = new Peer(node.netMgr.getIP(socket), port, node.netMgr.getPort(socket) , false, false);
				node.peersByOutputAddress[newPeer.getOutputAddress()] = newPeer;
				node.peersByInputAddress[newPeer.getInputAddress()] = newPeer;
				
				
				node.triggerEventToMe(newPeer.getOutputAddress(), "onPeerConnect", newPeer.getOutputAddress());
				*/
				//console.log("peer created : " + newPeer);
			}
			
			node.netMgr.clients[targetAddress].emit("tryPeer");
			
			return;
		}
		
		
		// 연결되어있지 않다면..
		
		var newsocket = node.connectToPeer(node.netMgr.getIP(socket), port);
		
		newsocket.once("connect",
			function()
			{
				if(!node.getPeer(socketIP, port, socketPort) ) // 해당 peer 오브젝트가 없다면
				{
					
					node.addPeer(socketIP, port, socketPort , false, false);
					/*
					var newPeer = new Peer(socketIP, port, socketPort , false, false);					
					node.peersByOutputAddress[newPeer.getOutputAddress()] = newPeer;
					node.peersByInputAddress[newPeer.getInputAddress()] = newPeer;
					node.triggerEventToMe(newPeer.getOutputAddress(), "onPeerConnect", newPeer.getOutputAddress());
					*/
					//console.log("peer created2 : " + newPeer);
				}
			}
		);
		
	}
	
	
	isMe(address)
	{
		var myAddress = "127.0.0.1:" +  node.netMgr.serverPort;
		return address;		
	}
	
	getClientAddressFromMe()
	{
		var myAddress = "127.0.0.1:" +  node.netMgr.serverPort;
		return node.netMgr.guests[myAddress];
	}
	
	connectToPeerByAddress(address)
	{
		var ip;
		var port;
		
		var idx = address.lastIndexOf(':');
		if (~idx && ~address.indexOf('.'))
		{
			ip = address.slice(0, idx );
			port = address.slice(idx + 1, address.length);
		}

		
		
		this.connectToPeer(ip, port);
	}
	
	connectToPeer(ip, port)
	{
		var socket = node.netMgr.tryConnectTo(ip, port);
		if(socket)
		{

			socket.once("tryPeer",
				() =>
				{

					socket.emit("giveport", node.netMgr.serverPort);
					//socket.emit("giveport", 345345);
					
				}
			);
			
			socket.once("connect",
			function()
			{
				/*
					if(!node.getPeer(node.netMgr.getIP(socket), port, socketPort) ) // 해당 peer 오브젝트가 없다면
					{
						
						var newPeer = new Peer(node.netMgr.getIP(socket), port, socketPort , false, false);
						node.peersByOutputAddress[newPeer.getOutputAddress()] = newPeer;
						node.peersByInputAddress[newPeer.getInputAddress()] = newPeer;
						
						console.log("peer created2 : " + newPeer);
					}
				*/
			}
		);
			
		}
		return socket;
	}
	

	
	checkPeers(peers)
	{	
		for(var peer of peers) 
		{
			this.connectToPeer(peer);
		}		
	}
	

	
	getPeerCount()
	{
		return Object.keys(this.peersByInputAddress).length;
	}
	
	removePeer(peer)
	{
		var count = node.peersList;
		for(var i =0 ; i < count; i ++)
		{
			if(node.peersList[i] == peer)
			{
				node.peersList.splice(i, 1);
				break;
			}
		}
		delete node.peersByOutputAddress[peer.getOutputAddress()];
		delete node.peersByInputAddress[peer.getInputAddress()];
	}
	
	addPeer(_ip, _port, _port2,_localhost, _internal)
	{
		var newPeer = new Peer(_ip, _port, _port2 , _localhost, _internal);
		node.peersByOutputAddress[newPeer.getOutputAddress()] = newPeer;
		node.peersByInputAddress[newPeer.getInputAddress()] = newPeer;
		node.peersList.push(newPeer);
		node.triggerEventToMe(newPeer.getOutputAddress(), "onPeerConnect", newPeer.getOutputAddress());
	}
	
	getPeer(ip, outPort, inPort)
	{
		var address = this.netMgr.getAddress(ip, outPort);
		var address2 = this.netMgr.getAddress(ip, inPort);
		if(node.peersByOutputAddress[address] == node.peersByInputAddress[address2])
			return node.peersByOutputAddress[address];
		return null;
	}
	
	getPeerByOutputAddress(address)
	{
		//var address = this.netMgr.getAddress(ip, port);
		return this.peersByOutputAddress[address];
	}
	
	getPeerByInputAddress(address)
	{
		//var address = this.netMgr.getAddress(ip, port);
		return this.peersByInputAddress[address];
	}
	
	getPeerBySocket(socket)
	{
		var ip = this.netMgr.getIP(socket); 
		var port = socket.request.connection._peername.port;
		var address = this.netMgr.getAddress(ip, port);
		return this.connectedPeers[address];
	}
	
	getSocket(address)
	{		
		return this.netMgr.clients[address];
	}

	addEventHandler(name, fn)
	{
		if(!this.eventHandlers[name])
		{
			this.eventHandlers[name] = [];
			this.eventHandlers[name].push(fn);
		}
		else
		{
			this.eventHandlers[name].push(fn);
		}
		/*
		for (const [ key, value ] of Object.entries(this.netMgr.clientsAddress)) 
		{
			console.log(key);
		}
		
		*/
		var keys = Object.keys(this.netMgr.clients);
		for(var i = 0; i < keys.length; i++)
		{
			var key = keys[i];
			this.registerEventHandler(key);
		}
		
		
	}
	
	triggerEventToMe(sender, eventName, ...args)
	{
		if(!node.eventHandlers[eventName])
			return;
		
		for(var eventHandler of node.eventHandlers[eventName])
		{
			//if(node.isSocketHasEventHandler(sender, eventName))
			//{
				eventHandler.call(this, sender,...args);
			//}		
		}
	}

	triggerEvent(target, name, ...args) // 
	{
		//console.log("test");
		if(!target)
		{
			var guests = this.netMgr.guests;
			
			for(var guest in guests)
			{
				//console.log("trigger : "+ name+  " to " + guest );
				args.push(name);
				this.netMgr.guests[guest].emit(name, ...args);			
			}
		}
		else
		{
			var len = target.length;
			for(var i = 0 ; i < len; i ++)
			{
				args.push(name);
				var address = false;
				var peer = this.getPeerByOutputAddress(target[i]);	
				if(peer)
				{
					address = peer.getInputAddress();
				}
				//else if(this.isMe(target[i]))
				//	address   = "127.0.0.1:" +  node.netMgr.serverPort;
				if(address)
				{
					this.netMgr.guests[address].emit(name, ...args);		
					//console.log("peer: " + peer + " name : " + name + " target address : " + target[i] + " input address : " + address);
					//console.log("peer: " + peer + " name : " + name + " target address : " + target[i] + " input address : " + address);
				}
				else
				{					
					//console.log("[error]peer: " + peer + " name : " + name + " target address : " + target[i] + " input address : " + address);
				}
			}		
		}		
	}
	
	
}

module.exports = Node;