var UI = require('./lib/ui/ui.js');
var AgentManager = require('./lib/agent/agentManager.js');

var os = require('os');
var ifaces = os.networkInterfaces();
const HashTable = require("jshashtable");

const {ipcMain, app, BrowserWindow } = require('electron');


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win = null;
let agentContents = new HashTable();
let agentWindow = {};

function getRandomInt(min, max)
{
	return Math.floor(Math.random() * (max - min)) + min;
}

ipcMain.on('onSelectFile',
	function(event, file)
	{
		var agentID = agentContents.get(event.sender);
		var excutor = agentManager.agentExecutors[agentID].executor;
		agentManager.requestUploadingByPath(excutor, file, 0, 9999999999);
		//agentManager.requestUploading(agentUI.agentExecutor, _id, _coin, _period);
	}
);




ipcMain.on('closeWindow', function ()
{
	process.exit();
});


ipcMain.on('selectAgent',
	function(event, id)
	{
		var window = new BrowserWindow({  frame: false, resizable: true, width: 800, height: 1000});
		agentContents.put(window.webContents, id);
		agentWindow[id] = window;
	  window.loadFile('page/agent.html');

		window.webContents.openDevTools();
		var executor = agentManager.agentExecutors[id].executor;


	 window.webContents.on('did-finish-load',
		function() {
		window.show();

		agentManager.setBlocksDataSync(executor, true);
		//window.webContents.send("setMenuForm", agentManager.getAgentInfo(executor, "job"));
		sendAgentDataToAgentWindow(executor);
	})

	  window.on('closed',
	  () => {
			window = null
			agentManager.setBlocksDataSync(executor, false);
			agentWindow[id] = null;
	  })
	}
);

ipcMain.on('requestBlocksData',
	function(event, startID, endID)
	{
		 var agentID = agentContents.get(event.sender);
		 var executor = agentManager.agentExecutors[agentID].executor;



	}
);

ipcMain.on('requestBlockData',
	function(event, id)
	{
		 var agentID = agentContents.get(event.sender);
		 var executor = agentManager.agentExecutors[agentID].executor;

		 agentManager.requestBlockData(executor, id);

	}
);


ipcMain.on('setAgentConnecting',
	function(event, id, value)
	{
		if(value)
		{


		}
		else
		{
			var executor = agentManager.agentExecutors[id].executor;
			agentManager.disconnectAgent(executor);
		}
	}
);


ipcMain.on('connectAgents',
	function ()
	{
		var opList = [];
		var count = agentManager.agentExecutors.length;
		for(var i = 0; i < count; i ++)
		{
			var executor = agentManager.agentExecutors[i].executor;
			if(agentManager.getAgentInfo(executor, "job") == "operator")
			{
				opList.push(executor);
			}

		}


		for(var i = 0; i < count; i ++)
		{
			var executor = agentManager.agentExecutors[i].executor;
			var opCount = opList.length;
			for(var j = 0; j < opCount; j++)
			{
				var op = opList[j];
				if(op != executor)
					agentManager.connectAgent(executor, op);
			}
		}
	}
);


ipcMain.on('addAgent',
	function ()
	{
		for(var i = 0; i < 1; i++)
		{
			var name = "bot_" + getRandomInt(0, 10000);
			var port =  getRandomInt(1024, 49151);

			agentManager.addAgent(name, port, "uploader");
		}

		for(var i = 0 ; i < 10; i++)
		{
			var name = "bot_" + getRandomInt(0, 10000);
			var port =  getRandomInt(1024, 49151);

			agentManager.addAgent(name, port, "hoster");
		}


		for(var i = 0 ; i < 5; i++)
		{
			var name = "bot_" + getRandomInt(0, 10000);
			var port =  getRandomInt(1024, 49151);

			agentManager.addAgent(name, port, "operator");
		}

		//updateAgentList();
	}
);

function updateAgentList()
{
	console.log("testaaa");
	var agents = [];
	var count = agentManager.agentExecutors.length;
	for(var i = 0; i < count; i ++)
	{
		var dict = agentManager.agentExecutors[i];
		var executor = dict.executor;

		var info =
		{
			name : dict.name,
			port : dict.port,
			blocks : agentManager.getAgentInfo(executor, "blocks"),
			coins : agentManager.getAgentInfo(executor, "coins"),
			segments : agentManager.getAgentInfo(executor, "segments"),
			peers : agentManager.getAgentInfo(executor, "peers"),
			job : agentManager.getAgentInfo(executor, "job")
		};

		agents.push(info);

		/*
		if(agentManager.getAgentInfo(executor, "job") == "operator")
			adminUI.agentList[i] = "["+ i + "] (Operator) " + dict.name + " ( 127.0.0.1:"+ dict.port + " ) (blocks :" + (agentManager.getAgentInfo(executor, "blocks")+1)+") (peers " + agentManager.getAgentInfo(executor, "peers") + ") (coins: " +agentManager.getAgentInfo(executor, "coins") +")";
		else if(agentManager.getAgentInfo(executor, "job") == "hoster")
			adminUI.agentList[i] = "["+ i + "] (Host) " + dict.name + " ( 127.0.0.1:"+ dict.port + " ) (segments :" + (agentManager.getAgentInfo(executor, "segments")+1)+") (peers " + agentManager.getAgentInfo(executor, "peers") + ") (coins: " +agentManager.getAgentInfo(executor, "coins") +")";
		else if(agentManager.getAgentInfo(executor, "job") == "uploader")
			adminUI.agentList[i] = "["+ i + "] (Uploader) " + dict.name + " ( 127.0.0.1:"+ dict.port + " ) (peers " + agentManager.getAgentInfo(executor, "peers") + ") (coins: " +agentManager.getAgentInfo(executor, "coins") +")";
		*/
	}


	win.webContents.send("updateAgentList", agents);
}


function onAgentGetBlockData(_executor, _blockData)
{
	var id = agentManager.getAgentExecutorIndex(_executor);
	if(agentWindow[id] != null)
	{
		agentWindow[id].webContents.send("blockData", _blockData);
	}

}

function onAgentInfoChange(_executor, _key, _value)
{
 var sent = sendAgentDataToAgentWindow(_executor);
 var id = agentManager.getAgentExecutorIndex(_executor);
	win.webContents.send("updateAgent", id, sent);


}

function sendAgentDataToAgentWindow(_executor)
{
	var id = agentManager.getAgentExecutorIndex(_executor);
	var dict = agentManager.agentExecutors[id];
	var info =
	{
		name : dict.name,
		port : dict.port,
		blocks : agentManager.getAgentInfo(_executor, "blocks"),
		blockList : agentManager.getAgentInfo(_executor, "blocksList"),
		wallet: agentManager.getAgentInfo(_executor, "walletAddress"),
		coins : agentManager.getAgentInfo(_executor, "coins"),
		segments : agentManager.getAgentInfo(_executor, "segments"),
		peers : agentManager.getAgentInfo(_executor, "peers"),
		job : agentManager.getAgentInfo(_executor, "job")
	};

	if(agentWindow[id] != null)
	{
		agentWindow[id].webContents.send("setAgentData", info);
	}

	return info;
}


function createWindow ()
{

  win = new BrowserWindow({  frame: false, resizable: true, width: 600, height: 800})
  win.loadFile('page/index.html')

	win.webContents.openDevTools()
  win.on('closed', () => {
    win = null
  })
}


app.on('ready', createWindow)


app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {

  if (win === null) {
    createWindow()
  }
})


function onAgentEventCall(_agentExecutor, _eventName, _extra)
{
	if(_eventName == "uploadingEvent")
	{
		//console.log(_extra);
		var file = _extra[0];
		var result = _extra[1];
		var reason = _extra[2];

		if(reason == "spliting")
		{
			console.log("spliting file..");
		}

		else if(reason == "splited")
		{
			if(result)
				console.log("file split finish");
			else
			{
				console.log("file split failed");
			}
		}

		else if(reason == "requested")
		{
			if(result)
				console.log("Waiting for uploading permission...");
			else
			{
				console.log("uploading permission failed");
			}
		}

		else if(reason == "noReply")
		{
			console.log("no replaying ");
		}

		else if(reason == "notEnoughHoster")
		{
			console.log("not enough hosters");
		}


		else if(reason == "uploading")
		{
			if(result)
				console.log("file sending..");
			else
			{
				console.log("file transmission failed");
			}
		}

		else if(reason == "uploaded")
		{
			if(result)
				console.log("uploading finished ");
		}

	}
	//console.log(_eventName + "  " + args);
}


var agentManager = new AgentManager();
agentManager.agentInfoChangeEvent.push(onAgentInfoChange);
/*
agentManager.agentAddedEvent.push(refreshAgentList);
agentManager.agentRemovedEvent.push(refreshAgentList);
*/
agentManager.agentAllEvent.push(onAgentEventCall);
agentManager.getBlockDataEvent.push(onAgentGetBlockData);



/*



function onAdminUIDisplay()
{
	updateAgentsList();
}

function onTryAddAgent(_name, _port, _job)
{
	agentManager.addAgent(_name, _port, _job);

}


function onConnectRemote(_id, _ip, _port)
{
	if(_id < 0 || _id >= agentManager.agentExecutors.length)
	{
		renderer.clear();
		adminUI.display();
		return;
	}
	var sourceAgent = agentManager.agentExecutors[_id].executor;

	agentManager.connectRemote(sourceAgent, _ip, _port);
}

function onSelectAgent(_id)
{
	if( _id < 0 || _id >= agentManager.agentExecutors.length)
	{
		renderer.clear();
		adminUI.display();
		return;
	}

	if(!agentManager.agentExecutors[_id])
		return;

	agentUI.agentExecutor = agentManager.agentExecutors[_id].executor;
	renderer.clear();
	renderer.setUI(agentUI);

}

function onSelectBlock(_id)
{
	var blocks = agentManager.getAgentInfo(agentUI.agentExecutor, "blocksList");
	if( _id < 0 || _id >= blocks.length)
	{
		renderer.clear();
		agentUI.display();
		return;
	}


}

function onSelectUserFile(_id, _coin, _period)
{
	var userFiles = agentManager.getAgentInfo(agentUI.agentExecutor, "userFiles");
	if(_id < 0 || _id >= userFiles.length)
	{
		renderer.clear();
		agentUI.display();
		return;
	}

	agentManager.requestUploading(agentUI.agentExecutor, _id, _coin, _period);

}

function onRemoveAgent(_id)
{
	if(_id < 0 || _id >= agentManager.agentExecutors.length)
	{
		renderer.clear();
		adminUI.display();
		return;
	}

	agentManager.removeAgent(_id);


	renderer.clear();
	adminUI.display();
}

function onConnectAgent(_id, _target)
{
	if(_id < 0 || _id >= agentManager.agentExecutors.length)
	{
		renderer.clear();
		adminUI.display();
		return;
	}

	if(_target < 0 || _target >= agentManager.agentExecutors.length)
	{
		renderer.clear();
		adminUI.display();
		return;
	}



	var sourceAgent = agentManager.agentExecutors[_id].executor;
	var targetAgent =  agentManager.agentExecutors[_target].executor;

	agentManager.connectAgent(sourceAgent, targetAgent);

	renderer.clear();
	adminUI.display();

}

function onAutoConnect()
{
	var opList = [];
	var count = agentManager.agentExecutors.length;
	for(var i = 0; i < count; i ++)
	{
		var executor = agentManager.agentExecutors[i].executor;
		if(agentManager.getAgentInfo(executor, "job") == "operator")
		{
			opList.push(executor);
		}

	}


	for(var i = 0; i < count; i ++)
	{
		var executor = agentManager.agentExecutors[i].executor;
		var opCount = opList.length;
		for(var j = 0; j < opCount; j++)
		{
			var op = opList[j];
			if(op != executor)
				agentManager.connectAgent(executor, op);
		}
	}



	renderer.clear();
	adminUI.display();
	console.log("start connecting..");

}

function onSendTransation(_id, _amount)
{
	var wallets = agentManager.getAgentInfo(agentUI.agentExecutor, "walletsList");
	if( _id < 0 || _id >= wallets.length)
	{
		renderer.clear();
		agentUI.display();
		return;
	}

	if(!wallets[_id])
	{
		renderer.clear();
		agentUI.display();
		return;
	}

	if(_amount <= 0)
	{
		renderer.clear();
		agentUI.display();
		return;
	}
	var targetAddr = agentManager.getAgentInfo(agentUI.agentExecutor, "walletsList")[_id].walletAddress;
	agentManager.sendAgentCoin(agentUI.agentExecutor, targetAddr, _amount)

	renderer.clear();
	renderer.setUI(agentUI);

	console.log("Transaction broadcasted ");
}

function onSetAutoTX(_id)
{
	if(_id < 0 || _id >= agentManager.agentExecutors.length)
	{
		renderer.clear();
		adminUI.display();
		return;
	}
	var sourceAgent = agentManager.agentExecutors[_id].executor;
	agentManager.setAgentAutoTX(sourceAgent);
}

function onAgentUIDisplay()
{
	agentUI.userName = agentManager.getAgentInfo(agentUI.agentExecutor, "name");
	agentUI.walletAddress = agentManager.getAgentInfo(agentUI.agentExecutor, "walletAddress");
	agentUI.coins = agentManager.getAgentInfo(agentUI.agentExecutor, "coins");


	agentUI.blocksList = [];
	var blocks = agentManager.getAgentInfo(agentUI.agentExecutor, "blocksList");
	if(blocks)
	{
		var blockCount = blocks.length;
		for(var i = 0 ; i < blockCount; i++)
		{
			var block = blocks[i];
			agentUI.blocksList.push("["+ block.index +"] [TXs: " + block.transactions.length +"] " + block.hash);

		}
	}

	var wallets = agentManager.getAgentInfo(agentUI.agentExecutor, "walletsList");
	if(wallets)
	{
		var walletCount = wallets.length;
		agentUI.walletsList = [];
		for(var i = 0 ; i < walletCount; i++)
		{
			var wallet = wallets[i];
			agentUI.walletsList[i] = "[" + i + "] (" +  wallet.walletAddress + ") ("+ wallet.amount + ")";
		}
	}

	var userFiles = agentManager.getAgentInfo(agentUI.agentExecutor, "userFiles");
	//console.log(userFiles);
	if(userFiles)
	{

		var userFilesCount = userFiles.length;
		agentUI.userFileList = [];
		for(var i = 0 ; i < userFilesCount; i++)
		{
			var userFile = userFiles[i];
			agentUI.userFileList[i] = "[" + i + "] " +  userFile.name ;
		}
	}
}



function refreshAgentList(_executor, _name, _port)
{


	updateAgentsList(_executor, _name, _port);
	renderer.clear();
	adminUI.display();
}

function updateAgentsList(_executor, _name, _port)
{
	adminUI.agentList = null;
	adminUI.agentList = [];
	var count = agentManager.agentExecutors.length;
	for(var i = 0; i < count; i ++)
	{
		var dict = agentManager.agentExecutors[i];
		var executor = dict.executor;
		if(agentManager.getAgentInfo(executor, "job") == "operator")
			adminUI.agentList[i] = "["+ i + "] (Operator) " + dict.name + " ( 127.0.0.1:"+ dict.port + " ) (blocks :" + (agentManager.getAgentInfo(executor, "blocks")+1)+") (peers " + agentManager.getAgentInfo(executor, "peers") + ") (coins: " +agentManager.getAgentInfo(executor, "coins") +")";
		else if(agentManager.getAgentInfo(executor, "job") == "hoster")
			adminUI.agentList[i] = "["+ i + "] (Host) " + dict.name + " ( 127.0.0.1:"+ dict.port + " ) (segments :" + (agentManager.getAgentInfo(executor, "segments")+1)+") (peers " + agentManager.getAgentInfo(executor, "peers") + ") (coins: " +agentManager.getAgentInfo(executor, "coins") +")";
		else if(agentManager.getAgentInfo(executor, "job") == "uploader")
			adminUI.agentList[i] = "["+ i + "] (Uploader) " + dict.name + " ( 127.0.0.1:"+ dict.port + " ) (peers " + agentManager.getAgentInfo(executor, "peers") + ") (coins: " +agentManager.getAgentInfo(executor, "coins") +")";
	}
}

function onRefreshAgentInfo()
{
	updateAgentsList();

	renderer.clear();
	adminUI.display();
}

function onBack(menu)
{
	if(menu == "admin")
	{
		renderer.clear();
		renderer.setUI(adminUI);
		agentUI.agentExecutor = null;
	}
	else if(menu == "main")
	{
		renderer.clear();
		agentUI.setMenu("main");
		renderer.setUI(agentUI);
	}
}

function onShowPeer()
{
	renderer.clear();

	var peers = agentManager.getAgentInfo(agentUI.agentExecutor, "peersList");
	var peerCount = peers.length;
	agentUI.peersList = [];
	for(var i = 0 ; i < peerCount; i++)
	{
		var peer = peers[i];
		agentUI.peersList[i] = "[" + i + "] " +  peer.ip + ":" + peer.serverPort;
	}

	agentUI.setMenu("peers");
	renderer.setUI(agentUI);

}

function onShowWallets()
{
	renderer.clear();


	agentUI.setMenu("wallets");
	renderer.setUI(agentUI);
}

function onShowBlocks()
{
	renderer.clear();
	agentUI.setMenu("blocks");
	renderer.setUI(agentUI);

}

function onShowUpload()
{
	renderer.clear();
	agentUI.setMenu("upload");
	renderer.setUI(agentUI);

}
 */




/*
var renderer = new UI.Renderer();
renderer.clear();

var adminUI = new UI.Admin(renderer);
adminUI.onDisplayEvent.push(onAdminUIDisplay);
adminUI.addAgentEvent.push(onTryAddAgent);
adminUI.selectAgentEvent.push(onSelectAgent);
adminUI.removeAgentEvent.push(onRemoveAgent);
adminUI.connectAgentEvent.push(onConnectAgent);
adminUI.autoConnectEvent.push(onAutoConnect);
adminUI.refreshAgentInfoEvent.push(onRefreshAgentInfo);
adminUI.connectRemoteEvent.push(onConnectRemote);
adminUI.setAutoTXEvent.push(onSetAutoTX);

var agentUI = new UI.Agent(renderer);
agentUI.onDisplayEvent.push(onAgentUIDisplay);
agentUI.backEvent.push(onBack);
agentUI.showPeerEvent.push(onShowPeer);
agentUI.showWalletsEvent.push(onShowWallets);
agentUI.showBlocksEvent.push(onShowBlocks);
agentUI.showUploadEvent.push(onShowUpload);
agentUI.onSelectBlockEvent.push(onSelectBlock);
agentUI.onSelectUserFileEvent.push(onSelectUserFile);
agentUI.onSendTXEvent.push(onSendTransation);
renderer.setUI(adminUI);
*/
