const {ipcRenderer, remote} = require('electron');

var path = require('path');

// let mainWindow;
// var agentElements = {};
// app.on('ready', _ =>
// {
// 	mainWindows.webContents.on('did-finish-load',WindowsReady);
// 	function WindowsReady()
// 	{
// 		console.log('test');
// 	}
//
//   mainWindow.on('closed', _ =>
// 	{
//     console.log('closed')
//     mainWindow = null
//   })
// })






ipcRenderer.on("setAgentData",
	function(event, data)
	{
		if(typeof data.coins === 'number' )
			document.getElementById("coin").textContent = data.coins + "c";

		if(typeof data.blocks === 'number' )
		{

			document.querySelector(".blocks #length").textContent = data.blocks + " blocks ";
			//updateBlocksList(start, data.blocks);
		}

		document.querySelector(".wallet #address").textContent = "나의 지갑주소 : " +  data.wallet;
		document.querySelector(".server #address").textContent = "127.0.0.1:" + data.port;
		document.querySelector(".server #peer").textContent = data.peers + " peers ";

		//console.log(data.blockList);

		if(data.blockList != undefined)
		{
			var blockLength = data.blockList.length;
			for(var i = 0; i < blockLength; i++)
				updateBlockElement(data.blockList[i]);
		}
	}
);

ipcRenderer.on("blockData",
	function(event, blockData)
	{
		//console.log( blockData);
	}
);


ipcRenderer.on("setMenuForm",
	function(event, job)
	{
		console.log(job);
		setMenuEnable("segment", false);
		setMenuEnable("block", false);
		setMenuEnable("upload", false);
		if(job == "uploader")
		{
			setMenuEnable("upload", true);
		}
		else if(job == "hoster")
		{
			setMenuEnable("segment", true);
		}
		else if(job == "operator")
		{
			setMenuEnable("block", true);

		}

	}
);

function setMenuEnable(menu, enable)
{
	 tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++)
  {
    if(tablinks[i].id == menu)
		{
			if(enable)
			{
				tablinks[i].style.display = "block";
			}
			else
			{
				tablinks[i].style.display = "none";
			}
		}
  }
}




function updateBlocksList(start, end)
{
	var children = blockListElement.children;

	var currentBlockList_start = -1;
	var currentBlockList_end = -1;

	if(children)
	{
		currentBlockList_start = children[0].getAttribute("blockID");
		currentBlockList_end = children[children.length-1].getAttribute("blockID");
	}
	else
	{
		createBlockElement(blockData)
	}


	for(var i = start; i <= end; i++)
	{


	}

}

function findBorderElements(startID, endID)
{
	var children = blockListElement.children;
	var currentBlockList_startID = -1;
	var currentBlockList_endID = -1;

	if(children)
	{
		currentBlockList_startID = children[0].getAttribute("blockID");
		currentBlockList_endID = children[children.length-1].getAttribute("blockID");
	}
	else
	{
			return [null, null];
	}

	var topElement = null;
	var bottomElement = null;

}

var blockListElement = document.getElementById("blockList");
var blockElementTable = {};

function updateBlockElement(blockData)
{
	var blockElement = blockElementTable[blockData.index];
	if(blockElement == undefined)
	{
		blockElement = createBlockElement(blockData);
	}

	var blockElementID = blockElement.getAttribute("att_id");

	//console.log(blockElement);
	var block_id = blockElement.querySelector("#id");
	block_id.textContent = blockElementID;

	var block_time = blockElement.querySelector("#time");
//	var sysdate = new Date(blockData.timestamp);
	block_time.textContent = "timestamp :" + parseInt(blockData.timestamp);

	var block_hash = blockElement.querySelector("#hash");
	block_hash.childNodes[1].nodeValue = blockData.hash;
//	block_hash.innerText = blockData.hash;


	var block_nonce = blockElement.querySelector("#nonce");
	block_nonce.textContent = "nonce : " + blockData.nonce;

	var block_miner = blockElement.querySelector("#miner");
	var miner = "-";
	if(blockData.transactions[0] != undefined)
	{
		if(blockData.transactions[0].data.outputs[0] != undefined)
		{
			miner = blockData.transactions[0].data.outputs[0].address;
		}
	}

	block_miner.textContent = "miner : " + miner;

	var txCount = 1;
	if(blockElementID > 0)
		txCount = 10 + getRandomInt(0, 5);

	var block_merkle= blockElement.querySelector("#merkle");
	block_merkle.textContent = "merkleRoot : " + blockData.merkleRoot;

	var block_tx= blockElement.querySelector("#tx");
	block_tx.textContent = "transactions : " + txCount;

}

// <div id = "block">
// 	<div id = "id">1</div>
// 	<div id = "time">2019-09-01</div>
// 	<div id = "hash">
// 		<div id ="hash_title">HASH</div>
// 		32r32r32seafwefwbwebeawfbawefbwefaewbawefbwdfs
// 	</div>
// 	<div id = "miner">wfvwefwebwetgrvwevwefewfwefwfefw </div>
// 	<div id = "nonce">23426523</div>
// </div>


function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function createBlockElement(blockData)
{
	var block = document.createElement("div");
	block.id = "block";
	block.setAttribute("att_id", blockData.index);

	var block_id = document.createElement("div");
	block_id.id = "id";
	var block_time = document.createElement("div");
	block_time.id = "time";
	var block_hash = document.createElement("div");
	block_hash.id = "hash";

	var block_hash_title = document.createElement("div");
	block_hash_title.id = "hash_title";
	block_hash_title.textContent = "HASH";
	var block_miner = document.createElement("div");
	block_miner.id = "miner";
	var block_nonce = document.createElement("div");
	block_nonce.id = "nonce";

	var block_nonce = document.createElement("div");
	block_nonce.id = "nonce";

	var block_merkle = document.createElement("div");
	block_merkle.id = "merkle";

	var block_tx = document.createElement("div");
	block_tx.id = "tx";

	block.appendChild(block_id);

	block_hash.appendChild(block_hash_title);
	block_hash.appendChild(document.createTextNode(""));


	block.appendChild(block_hash);
	block.appendChild(block_time);
	block.appendChild(block_miner);
	block.appendChild(block_nonce);
	block.appendChild(block_merkle);
	block.appendChild(block_tx);
	/*
	blockHeader.id = "block_header";
	blockHeader.textContent = getBlockElementString(blockData);

	block.appendChild(blockHeader);
	*/

	blockElementTable[blockData.index] = block;
	document.querySelector(".blocks #list").appendChild(block);


	return block;
}

function getBlockElementString(blockData)
{
	return `id : ${blockData.index}\nhash : ${blockData.hash}`;
}


function onSelectFile(evt)
{
	//console.log(evt.target.files[0].path);
	ipcRenderer.send('onSelectFile', evt.target.files[0].path);
}

// function setMenu(menuName)
// {
// 	var i, tabcontent, tablinks;
// 	// Get all elements with class="tabcontent" and hide them
//   tabcontent = document.getElementsByClassName("tabcontent");
//   for (i = 0; i < tabcontent.length; i++)
//   {
//     tabcontent[i].style.display = "none";
//   }
//
// 	// Get all elements with class="tablinks" and remove the class "active"
//   tablinks = document.getElementsByClassName("tablinks");
//   for (i = 0; i < tablinks.length; i++) {
//     tablinks[i].className = tablinks[i].className.replace(" active", "");
//   }
//
//   // Show the current tab, and add an "active" class to the link that opened the tab
//   document.querySelector("#" + menuName + ".tabcontent").style.display = "block";
//   document.querySelector("#" + menuName + ".tablinks").className += " active";
//
// 	//ipcRenderer.send('requestBlockData', i);
//
// }

// function onClickMenu(evt)
// {
// 	var menuName = evt.currentTarget.id;
// 	setMenu(menuName);
// }

function closeWindow()
{
	var window = remote.getCurrentWindow();
    window.close();
}

function RequestBlocksData(startID, endID)
{

	ipcRenderer.send('requestBlocksData', startID, endID);
}

function RequestBlockData(id)
{
	ipcRenderer.send('requestBlockData', id);
}
