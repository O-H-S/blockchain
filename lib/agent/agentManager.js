const AgentExecutor = require('./agentExecutor.js');
var cp = require('child_process');

const HashTable = require("jshashtable");



var agentManager;

class AgentManager
{
	constructor()
	{
		agentManager = this;
		this.agentExecutors = [];
		this.agentInfo = new HashTable();

		this.agentAddedEvent = [];
		this.agentRemovedEvent = [];
		this.agentAllEvent = [];
		this.getBlockDataEvent = [];

		this.agentInfoChangeEvent = [];
	}

	addAgent(name, port, job)
	{
		var agentExecutor = cp.fork('./lib/agent/agentExecutor.js');
		agentExecutor.on('message',
			function(m)
			{
				var message = m[0];
				if(message == "created")
				{
					var name = m[1];
					var port = m[2];
					for(var func of agentManager.agentAddedEvent)
					{
						func.call(this, agentExecutor, name, port);
					}

				}

				if(message == "info")
				{
					var infoname = m[1];
					var infovalue = m[2];
					var infos = agentManager.agentInfo.get(agentExecutor);
					infos[infoname] = infovalue;
					for(var func of agentManager.agentInfoChangeEvent)
					{
						func.call(this, agentExecutor, infoname, infovalue);
					}

				}

				else if(message == "allInfo")
				{
					var allInfo = m[1];
					var infos = agentManager.agentInfo.get(agentExecutor);
					for(var key of Object.keys(allInfo))
					{
						infos[key] = allInfo[key];
						for(var func of agentManager.agentInfoChangeEvent)
						{
							func.call(this, agentExecutor, infoname, infovalue);
						}
					}
					//infos = allInfo;

				}

				else if(message == "blockData")
				{
					var blockData = m[1];
					for(var func of agentManager.getBlockDataEvent)
					{
						func.call(this, agentExecutor, blockData);
					}
				}

				else if(message == "event")
				{
					var eventName = m[1];
					var extra = m[2];
					for(var func of agentManager.agentAllEvent)
					{
						func.call(this, agentExecutor, eventName, extra);
					}

				}



				else if(message == "removed")
				{
					//console.log(agentManager.agentExecutors);
					var id = agentManager.getAgentExecutorIndex(agentExecutor);
					agentManager.agentExecutors.splice(id, 1);
					for(var func of agentManager.agentRemovedEvent)
					{
						func.call(this, agentExecutor);
					}
					agentExecutor = null;
				}

			}
		);


		agentExecutor.send(["execute", name, port, job]);

		var dict = {};
		dict.executor = agentExecutor;
		dict.name = name;
		dict.port = port;
		this.agentExecutors.push(dict);

		var info = {};
		info["name"] = name;
		info["port"] = port;
		info["job"] = job;
		this.agentInfo.put(agentExecutor, info);

	}

	removeAgent(id)
	{
		var executor = this.agentExecutors[id].executor;
		executor.send(["remove"]);

	}

	connectAgent(source, target)
	{
		source.send(["connect", "127.0.0.1", this.getPort(target)]);

	}

	disconnectAgent(agent)
	{
		agent.send(["disconnect"]);
	}

	connectRemote(agent, ip, port)
	{
		agent.send(["connect", ip, port]);
	}

	sendAgentCoin(agent, targetWalletAddress, amount)
	{
		agent.send(["sendCoin",  targetWalletAddress, amount]);
	}

	setAgentAutoTX(agent)
	{
		agent.send(["autoTX"]);
	}

	requestUploading(agent, _id, _coin, _period)
	{
		agent.send(["requestUploading", _id, _coin, _period]);
	}
	requestUploadingByPath(agent, _path, _coin, _period)
	{
		agent.send(["requestUploadingByPath", _path, _coin, _period]);
	}

	requestBlockData(agent, id)
	{
		agent.send(["requestBlockData", id]);
	}

	setBlocksDataSync(executor, sync)
	{
		//agent.send(["blocksDataSync", sync]);
	}


	getAgentInfo(executor, key)
	{
		return this.agentInfo.get(executor)[key];
	}

	getPort(executor)
	{
		var count = this.agentExecutors.length;
		for(var i = 0; i < count; i++)
		{
			if(this.agentExecutors[i].executor == executor)
			{
				return this.agentExecutors[i].port;
			}
		}
	}

	getAgentExecutorIndex(executor)
	{
		var count = this.agentExecutors.length;
		for(var i = 0; i < count; i++)
		{
			if(this.agentExecutors[i].executor == executor)
			{
				return i;
			}
		}

	}

}

module.exports = AgentManager;
