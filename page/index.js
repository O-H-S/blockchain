const {ipcRenderer} = require('electron');

var path = require('path');

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

//ctx.fillStyle = "green";
//ctx.fillRect(10, 10, 100, 100);

var agentElements = {};
var agentInfo = {};

function rgba(r, g, b, a) 
{
    return '#' + (256 + r).toString(16).substr(1) +((1 << 24) + (g << 16) | (b << 8) | a).toString(16).substr(1);
}

function getAgentElement(id)
{
	var agentElement = agentElements[id];
	if(!agentElement)
	{
		agentElement = {};
		
		
		
		var connnectButton = document.createElement("div");		
		connnectButton.className = "connectButton";
		
		connnectButton.addEventListener('click', 
			function(ev) 
			{
				var agentID = id;		
				console.log(agentID);
				if(connnectButton.getAttribute("connected") == "true")
				{
					ipcRenderer.send('setAgentConnecting', agentID, false);
				}
				else
				{					
					ipcRenderer.send('setAgentConnecting', agentID, true);					
				}
			}
		, false);
		
		connnectButton.addEventListener("mouseout", 
			function(ev)
			{
				if(connnectButton.getAttribute("connected") == "true")
					connnectButton.style.backgroundColor = rgba(0,255,0,50);
				else
					connnectButton.style.backgroundColor = rgba(0,0,0,50);
			}
		, false);
		
		connnectButton.addEventListener("mouseover", 
			function(ev)
			{
				if(connnectButton.getAttribute("connected") == "true")
					connnectButton.style.backgroundColor = rgba(255,255,0,255);
				else
					connnectButton.style.backgroundColor = rgba(255,255,0,255);
			}
		, false);
		
		
		var li = document.createElement("li");
		
		agentElement.listItem = li;
		agentElement.connectButton = connnectButton;
		
		agentElement.texts = [];
		
		li.setAttribute("id", id);
		
		document.getElementById("agentList").appendChild(li);
		li.appendChild(connnectButton);
		
		
		
		agentElements[id] = agentElement;
		
		setAgentElementConnectButton(id, 0);
	}
	return agentElement;
}


	
function setAgentElementText(id , text)
{
	 
	
	var agentElement = agentElements[id].listItem;
	var textNodes = agentElement.childNodes ;

	for(var j = textNodes.length - 1; j >= 0; j--)
	{
		if(textNodes[j].className != "connectButton")
			agentElement.removeChild(textNodes[j]);
	}
	
	var t = text.split(/\s*<br ?\/?>\s*/i), i;
	if(t[0].length>0)
	{         
		agentElement.appendChild(document.createTextNode(t[0]));
	}
	for(i = 1; i < t.length; i++)
	{
		agentElement.appendChild(document.createElement('BR'));
		if(t[i].length>0)
		{
			agentElement.appendChild(document.createTextNode(t[i]));
		}
	} 
	
}     

function setAgentElementConnectButton(id, connectCount)
{
	var button = agentElements[id].connectButton;
	if(connectCount > 0)
	{
		button.setAttribute("connected", "true");
		button.style.backgroundColor = rgba(0,255,0,50);
	}
	else
	{
		button.setAttribute("connected", "false");
		button.style.backgroundColor = rgba(0,0,0,50);
	}
	
}

ipcRenderer.on("updateAgent",
	function(event, id, agent)
	{
		//console.log(id);
		var element = getAgentElement(id);
		var info = agent;
		var text = "";
		if( info.job == "operator")
			text = "[Operator] " + info.name + " ( 127.0.0.1:"+ info.port + " ) <br> (blocks :" + info.blocks +") (peers " + info.peers + ") (coins: " +info.coins +")";
		else if(info.job == "hoster")
			text = "[Host] " + info.name + " ( 127.0.0.1:"+ info.port + " )  <br>(segments :" + info.segments +") (peers " + info.peers  + ") (coins: " +info.coins +")";
		else if(info.job == "uploader")
			text = "[Uploader] " + info.name + " ( 127.0.0.1:"+ info.port + " ) <br> (peers " + info.peers + ") (coins: " +info.coins +")";
		
		setAgentElementText(id , text);
		setAgentElementConnectButton(id, info.peers);
		//element.textNode.nodeValue = text;
	}
);

ipcRenderer.on("updateAgentList",
	function(event, agents)
	{
		
		var count = agents.length;
		for(var i = 0; i < count; i++)
		{
			var element = getAgentElement(i);
			var info = agents[i];
			var text = "";
			if( info.job == "operator")
				text = "(Operator) " + info.name + " ( 127.0.0.1:"+ info.port + " ) (blocks :" + info.blocks +") (peers " + info.peers + ") (coins: " +info.coins +")";
			else if(info.job == "hoster")
				text = "(Host) " + info.name + " ( 127.0.0.1:"+ info.port + " ) (segments :" + info.segments +") (peers " + info.peers  + ") (coins: " +info.coins +")";
			else if(info.job == "uploader")
				text = "(Uploader) " + info.name + " ( 127.0.0.1:"+ info.port + " ) (peers " + info.peers + ") (coins: " +info.coins +")";
			
			element.textNode.nodeValue = text;		
		}		
	}
);

/*
// Create a "close" button and append it to each list item
var myNodelist = document.querySelectorAll("li");
var i;
for (i = 0; i < myNodelist.length; i++) 
{

  var span = document.createElement("SPAN");
  var txt = document.createTextNode("\u00D7");
  span.className = "close";
  span.appendChild(txt);
  myNodelist[i].appendChild(span);
 
}

// Click on a close button to hide the current list item
var close = document.getElementsByClassName("close");
var i;
for (i = 0; i < close.length; i++) {
  close[i].onclick = function() {
    var div = this.parentElement;
    div.style.display = "none";
  }
}
*/

// Add a "checked" symbol when clicking on a list item
var list = document.getElementById("agentList");
list.addEventListener('click', 
	function(ev) 
	{
	  if (ev.target.tagName === 'LI') 
	  {
		  var id = ev.target.getAttribute("id");
		  ipcRenderer.send('selectAgent', id);
		 
		//ev.target.classList.toggle('checked');
	  }
	}
, false);

function closeWindow() 
{
	ipcRenderer.send('closeWindow');
}

function onAddAgent()
{
	ipcRenderer.send('addAgent');
}

function onConnect()
{
	ipcRenderer.send('connectAgents');
}

// Create a new list item when clicking on the "Add" button
function newElement() 
{
	
  var li = document.createElement("li");
  var inputValue = document.getElementById("myInput").value;
  var t = document.createTextNode(inputValue);
  li.appendChild(t);
  if (inputValue === '') {
    alert("You must write something!");
  } else {
    document.getElementById("myUL").appendChild(li);
  }
  document.getElementById("myInput").value = "";

  var span = document.createElement("SPAN");
  var txt = document.createTextNode("\u00D7");
  span.className = "close";
  span.appendChild(txt);
  li.appendChild(span);

  for (i = 0; i < close.length; i++) {
    close[i].onclick = function() {
      var div = this.parentElement;
      div.style.display = "none";
    }
  }
}