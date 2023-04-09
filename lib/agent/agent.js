var netMgr = require('../network/netmanager.js');
var node = require('../node/node.js');
var contributor = require('../contributor/contributor.js');
var miner = require('../miner/miner.js');
var uploader = require('../uploader/uploader.js');
var hoster = require('../hoster/hoster.js');
var blockchain = require('../blockchain/index.js').Blockchain;
var wallet = require('../wallet/wallet.js');


var agent;
class Agent
{
	constructor(_name, _serverPort)
	{
		agent = this;
		this.name = _name;
		this.port = _serverPort;
		this.netMgr = new netMgr(this.port, this.name);
		this.node = new node(this.netMgr);

		this.infos = {};
		this.infoChangeEvent = [];
		this.allEvent = [];

		this.setInfo("peers", 0);
		this.node.addEventHandler("onPeerConnect", this.onPeerConnect);
		this.node.addEventHandler("onPeerDisconnect", this.onPeerDisconnect);
		this.node.addEventHandler("requestYourWallet", this.giveMyWalletAddress);
		this.node.addEventHandler("giveMyWallet", this.keepHisWallet);
		this.autoTX = false;
		this.peerWalletAddresses = {};
		this.peerWalletsList = [];

		//this.walletAddresses =



		/*
		setInterval(
		function()
		{
			var amount = agent.contributor.getCoinsAmountFromAddress(agent.wallet.getAddress(1));
			var coins = agent.contributor.getCoinsFromAddress(agent.wallet.getAddress(1));
			console.log("=============");
			console.log(amount);
		}, 1000);
		*/
	}

	release()
	{
		if(this.uploader )
			this.uploader.release();
		if(this.hoster )
			this.hoster.release();
		if(this.contributor )
			this.contributor.release();

		this.node.release();
	}

	giveMyWalletAddress(address)
	{
		agent.node.triggerEvent([address], "giveMyWallet", agent.wallet.getAddress(1));
	}

	keepHisWallet(address, walletAddress)
	{
		agent.peerWalletAddresses[walletAddress] = true;
	}

	setInfo(_key, _value)
	{
		this.infos[_key] = _value;
		for(var func of this.infoChangeEvent)
		{
			func.call(this, _key, _value);
		}
	}

	setUploader()
	{
		if(this.uploader )
			return;
		this.addWallet();
		this.uploader = new uploader(this.node, this.wallet, this.name);
		this.uploader.userFilesUpdateEvent.push(this.onUserFilesUpdate);
		this.uploader.uploadingEvent.push(
			function(...args)
			{
				agent.allEventHandler("uploadingEvent", args);
			}
		);
		this.uploader.updateUserFileList();
	}



	setContributor()
	{
		if(this.contributor)
			return;

		this.addWallet();
		this.addBlockchain();
		this.contributor = new contributor(this.node, this.blockchain, this.wallet);

		//this.node.connectToMe(); // peer 관련 에러 있음.

	}

	setHoster()
	{
		if(this.hoster )
			return;

		this.addWallet();
		this.hoster = new hoster(this.node, this.wallet, this.name);
		this.hoster.segmentLoadEvent.push(this.onSegmentLoaded);
	}

	addWallet()
	{
		if(!this.wallet)
		{
			this.wallet = new wallet(this.node, this.name);
			this.wallet.coinUpdateEvent.push(this.onCoinsUpdate);
			this.setInfo("walletAddress", this.wallet.getAddress(1));
		}
	}

	addBlockchain()
	{
		if(!this.blockchain)
		{
			this.blockchain = new blockchain(this.name);
			this.blockchain.blockAddEvent.push(this.onBlockAdded);
		}
	}

	allEventHandler(eventName, extra)
	{
		for(var func of agent.allEvent)
		{
			func.call(agent, eventName, extra);
		}
	}

	getRandomInt(min, max)
	{
		return Math.floor(Math.random() * (max - min)) + min;
	}
	setAutoTX(auto)
	{
		this.autoTX = auto;

		if(auto)
		{
			if(!this.autoTX_Timer)
			{

				agent.node.triggerEvent(null, "requestYourWallet");

					//agent.peerWalletAddresses[agent.wallet.getAddress(1)] = true;
				this.autoTX_Timer = setInterval(
					function()
					{
						agent.node.triggerEvent(null, "requestYourWallet");
						if(Object.keys(agent.peerWalletAddresses).length > 0)
						{
							if(agent.wallet && agent.wallet.getCoins() > 0)
							{
								var addresses = Object.keys(agent.peerWalletAddresses);
								var randomIndex =  agent.getRandomInt(0, addresses.length);
								var targetAddress = addresses[randomIndex];
								agent.wallet.sendCoin(targetAddress, 1);

							}
						}
					}
				, 3000);

			}
		}
		else
		{
			if(this.autoTX_Timer)
			{
				clearInterval(this.autoTX_Timer);
				this.autoTX_Timer = null;
			}

;		}



	}

	connectAgent(_target)
	{
		this.node.connectToPeer("127.0.0.1", parseInt(_target.port));
		//this.node.
	}

	disconnect()
	{
		this.node.release();
	}

	connectTo(_ip, _port)
	{
		this.node.connectToPeer(_ip, parseInt(_port));
	}

	onCoinsUpdate()
	{
		agent.setInfo("walletAddress", agent.wallet.getAddress(1));
		agent.setInfo("coins", agent.wallet.getCoins());

	}

	onSegmentLoaded(file)
	{
		agent.setInfo("segments", Object.keys(agent.hoster.segments).length);
	}

	onRequestUploadingResult(_file, _result, _reason)
	{

	}

	onUserFilesUpdate()
	{
		//console.log(agent.uploader.userFileList);
		agent.setInfo("userFiles", agent.uploader.userFileList);
	}

	onBlockAdded(name, block, fork)
	{
		agent.setInfo("blocks", agent.blockchain.getLastBlock().index);
		agent.setInfo("blocksList", agent.blockchain.blocks);


		this.peerWalletsList = [];
		var walletsUTXO = agent.blockchain.getRecentStateContainer().addressUTXO;
		var keys = Object.keys(walletsUTXO);
		var count = keys.length;
		for(var i = 0; i < count; i ++)
		{
			var key = keys[i]; // walletAddress
			var info = {};
			info.walletAddress = key;
			info.amount = 0;

			var coinCount = walletsUTXO[key].length;
			for(var j = 0; j < coinCount; j++)
			{
				info.amount = info.amount + walletsUTXO[key][j].amount;
			}
			this.peerWalletsList.push(info);
		}
		agent.setInfo("walletsList", this.peerWalletsList);

		//agent.setInfo("heights", agent.blockchain.getHeight());
	}

	onPeerConnect(address)
	{
		agent.setInfo("peers", agent.node.getPeerCount());
		agent.setInfo("peersList", agent.node.peersList);
	}

	onPeerDisconnect(address)
	{
		agent.setInfo("peers", agent.node.getPeerCount());
		agent.setInfo("peersList", agent.node.peersList);

	}

}

module.exports = Agent;
