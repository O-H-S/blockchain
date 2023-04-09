var scanf = require('scanf');
var keypress = require('keypress'), tty = require('tty');

var renderer = null;
class Renderer
{
	constructor()
	{
		renderer = this;
		this.nowUI = null;		
		
		keypress(process.stdin);
		this.setPressable(false);
		process.stdin.on('keypress', function (ch, key) 
		{
			if(key && key.ctrl && key.name == 'c') 
			{			
				process.exit(1);	
			}
			if(renderer.pressable)
			{
				if(renderer.nowUI )
				{
					renderer.nowUI.onPress(ch, key);				
				}
			}
			/*
			if(renderer.idle)
			{
				if(key && key.ctrl && key.name == 'q') 
				{
					renderer.setIdle(false);

				}
				else if(key && key.ctrl && key.name == 'c') 
				{
					process.exit(1);			
				}
			}
			*/
		});
		
		
		
	}
	
	clear()
	{
		var lines = process.stdout.getWindowSize()[1];
		for(var i = 0; i < lines; i++) {
			console.log('\r\n');
		}
		
	}
	
	setUI(_ui)
	{
		if(this.nowUI)
		{
			
			
		}
		
		this.nowUI = _ui;
		this.nowUI.display();
	}
	
	setPressable(_able)
	{
		this.pressable = _able;
		if(this.pressable)
		{
			if (typeof process.stdin.setRawMode == 'function') 
			{
				process.stdin.setRawMode(true);
			}	 
			else 
			{
				tty.setRawMode(true);
			}
			process.stdin.resume();
		}
		else
		{
			if (typeof process.stdin.setRawMode == 'function') 
			{
				process.stdin.setRawMode(false);
			}	 
			else 
			{
				tty.setRawMode(false);
			}
			process.stdin.pause();
		}
	}
	

}








class UI  
{
    constructor(_renderer)
	{
		this.renderer = _renderer;
		
	}
	
	
	display()
	{
		
		
	}
	
	onPress(ch, key)
	{

		
	}
}

class UI_Admin extends UI
{
	constructor(_renderer)
	{
		super(_renderer);
		
		this.agentList = [];
		
		this.onDisplayEvent = [];
		this.addAgentEvent = [];
		this.selectAgentEvent = [];
		this.connectAgentEvent = [];
		this.autoConnectEvent = [];
		this.refreshAgentInfoEvent = [];
		this.removeAgentEvent = [];
		this.connectRemoteEvent = [];
		this.setAutoTXEvent = [];
	}
	
	
	display()
	{
		super.display();
		this.renderer.setPressable(true);
		for(var func of this.onDisplayEvent)
		{						  
			func.call(this);
		}
		console.log("\n─────────────────[ Setting ]─────────────────");
		console.log("[F5] Refresh \t\t[Ctrl + c] Exit");
		console.log("[1] Select bot    \t[2] Add bot       \t[3] Show log");
		console.log("[5] Auto connect \t[6] Connect agent \t[7] Remove bot");
		console.log("[8] Connect remote \t[9] Auto tx      \t[0] Auto add");
		console.log("[Ctrl + t] Test setting");
		console.log("\n────────────────────────────────────────");
		
		var count = this.agentList.length;
		for(var i = 0; i < count; i++)
		{
			console.log(this.agentList[i]);			
		}	
		if(count > 0)
			console.log("\n────────────────────────────────────────");
	}
	

	getRandomInt(min, max) 
	{
		return Math.floor(Math.random() * (max - min)) + min;
	}
	
	onPress(ch, key)
	{
		super.onPress(ch, key);

		if(key && key.name == "t")
		{
			if(key && key.ctrl)
			{
				
				for(var i = 0; i < 1; i++)
				{
					var name = "bot_" + this.getRandomInt(0, 10000);
					var port =  this.getRandomInt(1024, 49151);

					for(var func of this.addAgentEvent)
					{						  
						func.call(this, name, port, "uploader");
					}
				}
				
				for(var i = 0 ; i < 10; i++)
				{
					var name = "bot_" + this.getRandomInt(0, 10000);
					var port =  this.getRandomInt(1024, 49151);

					for(var func of this.addAgentEvent)
					{						  
						func.call(this, name, port, "hoster");
					}	
				}
				
				
				for(var i = 0 ; i < 5; i++)
				{
					var name = "bot_" + this.getRandomInt(0, 10000);
					var port =  this.getRandomInt(1024, 49151);

					for(var func of this.addAgentEvent)
					{						  
						func.call(this, name, port, "operator");
					}
				}
			}

		}
		
		
		if(ch == "0")
		{

			var name = "bot_" + this.getRandomInt(0, 10000);
			var port =  this.getRandomInt(1024, 49151);
			for(var func of this.addAgentEvent)
			{						  
				func.call(this, name, port, "operator");
			}		

		}
		
		
		
		
		
		if(ch == "1")
		{
			this.renderer.setPressable(false);
			console.log('Select agent : ');
			var id = scanf('%d');
			
			for(var func of this.selectAgentEvent)
			{						  
				func.call(this, id);
			}	
		}
		
		if(ch == "2")
		{
			this.renderer.setPressable(false);
			console.log('Please input user name : ');
			var name = scanf('%s');
			 

			
			console.log('Please input server port : ');
			var port = scanf('%d');
			  
			for(var func of this.addAgentEvent)
			{						  
				func.call(this, name, port);
			}		

			this.renderer.setPressable(true);
		}
		
		if(key && key.name == "f5")
		{
			for(var func of this.refreshAgentInfoEvent)
			{						  
				func.call(this);
			}	
			this.renderer.clear();
			this.display();			
		}
		
		if(ch == "5")
		{		
			for(var func of this.autoConnectEvent)
			{						  
				func.call(this);
			}	
		}
		
		if(ch == "6")
		{
			this.renderer.setPressable(false);
			console.log('Select agent : ');
			var id = scanf('%d');
			
			console.log('Select target agent : ');
			var id2 = scanf('%d');
			
			for(var func of this.connectAgentEvent)
			{						  
				func.call(this, id, id2);
			}	
		}
		
		if(ch == "7")
		{
			this.renderer.setPressable(false);
			console.log('Select agent : ');
			var id = scanf('%d');
			
			for(var func of this.removeAgentEvent)
			{						  
				func.call(this, id);
			}	
		}
		
		if(ch == "8")
		{
			this.renderer.setPressable(false);
			console.log('Select agent : ');
			var id = scanf('%d');
			
			console.log('Please input IP : ');
			var ip = scanf('%S');
			 
			
			console.log('Please input port : ');
			var port = scanf('%d');

			for(var func of this.connectRemoteEvent)
			{						  
				func.call(this, id, ip, port);
			}		

			this.renderer.setPressable(true);
		}
		
		if(ch == "9")
		{
			this.renderer.setPressable(false);
			console.log('Select agent : ');
			var id = scanf('%d');
		
			for(var func of this.setAutoTXEvent)
			{						  
				func.call(this, id);
			}	
		
			this.renderer.setPressable(true);
		}
	
		
	}
}

class UI_Agent extends UI
{
	constructor(_renderer)
	{
		super(_renderer);
		
		this.nowMenu = "main";
		this.userName = "";
		this.coins = 0;
		this.walletAddress = "";
		this.agentExecutor = null;
		
		this.peersList = [];
		this.walletsList = [];
		this.blocksList = [];
		this.userFileList = [];
		
		this.onDisplayEvent = [];
		this.backEvent = [];
		this.showPeerEvent = [];
		this.showBlocksEvent = [];
		this.showWalletsEvent = [];
		this.showUploadEvent = [];
		this.onSelectBlockEvent = [];
		this.onSelectUserFileEvent = [];
		this.onSendTXEvent = [];
	}
	
	display()
	{
		super.display();
		this.renderer.setPressable(true);
		for(var func of this.onDisplayEvent)
		{						  
			func.call(this);
		}
		
		if(this.nowMenu == "main")
		{
			console.log("\n────────────────[ User Window ]────────────────");
			console.log(" [ESC] Back   [F5] Refresh ");
			console.log(" (1.Show peers)   (2.Show wallets)  (3.Show blocks)");
			console.log(" (4.Upload File) ")
			console.log("\n────────────────────────────────────────");
			console.log("[User : "+ this.userName + "] \t ");
			console.log("[Wallet : "+ this.walletAddress + "]  ");
			console.log("[Coins : "+ this.coins + "] \t ");
			console.log("\n────────────────────────────────────────");
		}
		else if(this.nowMenu == "peers")
		{
			console.log("\n──────────────────[ Peers ]─────────────────");
			console.log(" [ESC] Back   [F5] Refresh ");
			console.log("\n────────────────────────────────────────");
			var count = this.peersList.length;
			for(var i = 0; i < count; i++)
			{ 
				console.log(this.peersList[i]);			
			}	
			if(count > 0)
				console.log("\n────────────────────────────────────────");
			
			
		}
		else if(this.nowMenu == "wallets")
		{
			console.log("\n──────────────────[ Wallets ]─────────────────");
			console.log(" [ESC] Back   [F5] Refresh ");
			console.log(" (1.Send coin)   (2. Show coins) ");
			console.log("\n────────────────────────────────────────");
			var count = this.walletsList.length;
			for(var i = 0; i < count; i++)
			{
				console.log(this.walletsList[i]);			
			}	
			if(count > 0)
				console.log("\n────────────────────────────────────────");
			
		}
		
		else if(this.nowMenu == "blocks")
		{
			console.log("\n──────────────────[Blocks]─────────────────");
			console.log(" [ESC] Back   [F5] Refresh ");
			console.log(" [1] Select block ");
			console.log("\n────────────────────────────────────────");
			var count = this.blocksList.length;
			for(var i = 0; i < count; i++)
			{
				console.log(this.blocksList[i]);			
			}	
			console.log("\n────────────────────────────────────────");
		}
		
		else if(this.nowMenu == "upload")
		{
			console.log("\n──────────────────[Files]─────────────────");
			console.log(" [ESC] Back   [F5] Refresh ");
			console.log(" [1] Upload file");
			console.log("\n────────────────────────────────────────");
			
			var count = this.userFileList.length;
			for(var i = 0; i < count; i++)
			{
				console.log(this.userFileList[i]);			
			}
			
			if(count > 0)
				console.log("\n────────────────────────────────────────");
			
		}
		
	}
	
	onPress(ch, key)
	{
		super.onPress(ch, key);

		if(key && key.name == "f5")
		{

			this.renderer.clear();
			this.display();			
		}
		
		if(this.nowMenu == "main")
		{
			if(key && key.name == "escape")
			{
				for(var func of this.backEvent)
				{						  
					func.call(this, "admin");
				}
				
			}
			
			if(ch == "1")
			{
				for(var func of this.showPeerEvent)
				{						  
					func.call(this);
				}
				
			}
			if(ch == "2")
			{
				for(var func of this.showWalletsEvent)
				{						  
					func.call(this);
				}
				
			}
			
			if(ch == "3")
			{
				for(var func of this.showBlocksEvent)
				{						  
					func.call(this);
				}
				
			}
			
			if(ch == "4")
			{
				for(var func of this.showUploadEvent)
				{						  
					func.call(this);
				}
				
			}
			
		}
		else if(this.nowMenu == "peers")
		{
			if(key && key.name == "escape")
			{
				for(var func of this.backEvent)
				{						  
					func.call(this, "main");
				}
				
			}
			
		}
		else if(this.nowMenu == "wallets")
		{
			
			if(ch == "1")
			{
				this.renderer.setPressable(false);
				console.log('Select wallet : ');
				var id = scanf('%d');
				
				console.log('Input amount : ');
				var amount = scanf('%d');
			
				for(var func of this.onSendTXEvent)
				{						  
					func.call(this, id, amount);
				}
				
			}
			
			if(key && key.name == "escape")
			{
				for(var func of this.backEvent)
				{						  
					func.call(this, "main");
				}
				
			}
		}
		else if(this.nowMenu == "blocks")
		{
			if(key && key.name == "escape")
			{
				for(var func of this.backEvent)
				{						  
					func.call(this, "main");
				}
				
			}
			
			if(ch == "1")
			{
				this.renderer.setPressable(false);
				console.log('Select block : ');
				var id = scanf('%d');
			
				for(var func of this.onSelectBlockEvent)
				{						  
					func.call(this, id);
				}
				
			}
			
		}
		
		else if(this.nowMenu == "upload")
		{
			if(key && key.name == "escape")
			{
				for(var func of this.backEvent)
				{						  
					func.call(this, "main");
				}
				
			}
			if(ch == "1")
			{
				this.renderer.setPressable(false);
				console.log('Select file : ');
				var id = scanf('%d');
				
				console.log('Input amount of coin : ');
				var coin = scanf('%d');
				
				console.log('Input period : ');
				var period = scanf('%d');
				
				this.renderer.setPressable(true);
				for(var func of this.onSelectUserFileEvent)
				{						  
					func.call(this, id, coin, period);
				}
				
				
			}
			
			
		}
		
	}
	
	setMenu(_menu)
	{
		this.nowMenu = _menu;
	}
	
}


module.exports = 
{
	"Renderer": Renderer,
	"Admin": UI_Admin,
	"Agent" : UI_Agent
};