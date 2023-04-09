
const Agent = require('./agent.js');
var agent;
var blocksDataSync = false;

process.on('message',
	function(m)
	{

		var message = m[0];
		if(message == "execute")
		{
			var name = m[1];
			var port = m[2];
			var job = m[3];

			agent = new Agent(name, port);
			if(job == "operator")
				agent.setContributor();
			else if(job == "uploader")
				agent.setUploader();
			else if(job == "hoster")
				agent.setHoster();



			sendAllInfo(agent);
			agent.infoChangeEvent.push(sendInfoChangeEvent);
			agent.allEvent.push(sendAgentEvent);

			process.send(["created", name, port]);

		}
		else if(message == "connect")
		{
			var ip = m[1];
			var port = m[2];

			agent.connectTo(ip, port);
		}

		else if(message == "disconnect")
		{
			agent.disconnect();

		}

		else if(message == "sendCoin")
		{
			var walletAddress = m[1];
			var amount = m[2];

			agent.wallet.sendCoin(walletAddress, amount);
		}

		else if(message == "autoTX")
		{
			agent.setAutoTX(true);
		}

		else if(message == "requestUploading")
		{
			var id = m[1];
			var coin = m[2];
			var period = m[3];

			var file = agent.uploader.userFileList[id].path;
			agent.uploader.requestFileUploading(file, coin, period);

		}

		else if(message == "requestUploadingByPath")
		{
			var path = m[1];
			var coin = m[2];
			var period = m[3];

			//var file = agent.uploader.userFileList[id].path;
			agent.uploader.requestFileUploading(path, coin, period);

		}

    else if(message == "requestBlockData")
    {
      var id = m[1];
      process.send(["blockData", agent.blockchain.getBlockByID(id)]);
    }

    else if(message == "blocksDataSync")
    {
      /*
        var sync = m[1];
        blocksDataSync = sync;
        if(sync)
        {
          if(not (onAgentBlockAdded in agent.blockchain.blockAddEvent)
          {
            agent.blockchain.blockAddEvent.push(onAgentBlockAdded);
          }
        }
        else
        {
          const idx = agent.blockchain.blockAddEvent.indexOf(onAgentBlockAdded)
          if(idx > -1)
          {
            agent.blockchain.blockAddEvent.splice(idx, 1);
          }
        }
        */
    }

		else if(message == "remove")
		{
			if(agent)
				agent.release();

			process.send(["removed"]);
			process.exit(1);
		}


	}
);

function onAgentBlockAdded(name, block, fork)
{
  //process.send(["blockData", eventName, extra]);
}

function sendAgentEvent(eventName, extra)
{
	process.send(["event", eventName, extra]);
}

function sendAllInfo(agent)
{
	process.send(["allInfo", agent.infos]);
}

function sendInfoChangeEvent(_key, _value)
{
	process.send(["info", _key, _value]);
}
