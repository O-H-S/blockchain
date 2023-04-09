const R = require('ramda');
const miner = require('../miner/miner');
const Block = require('../block/block');
const Transaction = require('../transaction/transaction');
const prover = require('../prover/prover');
const operator = require('../operator/operator');
const HashTable = require("jshashtable");
const StateContainer = require('../blockchain/index.js').StateContainer;

var contributor;
class Contributor
{
	
	constructor(_node, _blockchain, _wallet)
	{
		contributor = this;
		this.node = _node;
		this.blockchain = _blockchain;
		this.wallet = _wallet;
		this.miner = new miner(_blockchain, _wallet);
		this.prover = new prover(_blockchain);
		this.operator = new operator(_node, _blockchain, _wallet, this.prover);
		
		this.unsolvedTransactions = []; // (최적) key(TX_Hash) : 현재 가지고 있지 않은 utxo를 input으로 참조한 TxHash
		
		this.unsolvedBlocks = {}; // 
		this.unsolvedBlocksByPrevHash = {};
		
		this.tempBlocks = []; // 한개 이상일 가능성 존재. (채굴이 늦어지는 경우)
		// 여기에는 이미 증명된 tx들과 증명되로록 하는 블록을 생성하여 저장함. 따라서 다 채워지는 경우, 바로 채굴 작업에 들어가도 상관 없음.
		this.tempBlocksState = new HashTable(); // 위의 각 블록에 대한 statecontainer
		this.blockSolving = false;
		this.transactionSolving = false;
		this.newTXSolving = false;
		setInterval(this.checkContractSafety, 5000);
		
		
		this.init();
	}
	
	
	init()
	{
		
		var myAD = this.node.getAdvertisement();
		myAD.contributor = true;
		this.node.updateMyAdvert(myAD);
		
		
		this.prover.proveTransactionEvent.push(this.onTransactionProveResult);
		this.prover.proveBlockEvent.push(this.onBlockProveResult);
		
		
		this.blockchain.blockAddEvent.push(this.blockEventHandler);
		
		this.node.addEventHandler("broadcastTransaction", this.checkTransaction);

		
		
		this.node.addEventHandler("sendTransactionFromWallet", this.checkTransactionFromWallet);
		
		
		this.node.addEventHandler("sendBlocksInfo", this.checkReceivedBlocksInfo);
		this.node.addEventHandler("sendBlocks", this.checkReceivedBlocks);
		this.node.addEventHandler("notifyLastBlock", this.checkMyLastBlock);
		this.node.addEventHandler("getYourBlocksInfo", this.checkBlocksInfoToGive);
		this.node.addEventHandler("getYourBlocks", this.checkBlocksToGive);
		this.node.addEventHandler("onPeerConnect", this.giveMyBlockInfo);
		
		
		this.node.addEventHandler("requestContractCreation", this.checkContractCreation);
		
		
		contributor.getRecentTemporalBlock();
		contributor.checkTempBlocksToMine();
		
		setInterval(
		function()
		{
			contributor.findPeer();
		}
		, 1000 * 2);
		
	}
	getHosterWalletByAdvert(hosterAdvert)
	{
		var advertKey = JSON.stringify(hosterAdvert);
		if(this.operator.hosters[advertKey])
		{
			return this.operator.hosters[advertKey].address;
		}
		return null;
	}
	
	getHostersWalletByAdverts(hosters)
	{
		var hosterWallets = [];
		var hosterCount = hosters.length;
		for(var i = 0 ; i < hosterCount; i ++)
		{
			var walletAddr = this.getHosterWalletByAdvert(hosters[i]);
			if(walletAddr)
			{
				hosterWallets.push(walletAddr);
			}
			else
			{
				return null;
			}
			
		}
		return hosterWallets;
	}
	
	checkContractCreation(address, reqMsg, hosters, distributions, segmentHashes)
	{
		
		if(hosters.length != distributions.length)
		{
			console.log("contributor : contract creation form err");
			return;
		}
		
		var lastContainer = contributor.blockchain.getRecentStateContainer();  // 
		
		var inputs = lastContainer.getUsableInputsByAmount(reqMsg.walletAddress, reqMsg.price); // 
		
		if(!inputs)
		{
			
			// 무료 
			//console.log("contributor : contract creation form err2");
			//return;
		}
		
		var hosterWallets = contributor.getHostersWalletByAdverts(hosters); // 
		if(!hosterWallets)
		{
			console.log("contributor : error33");
			return;
		}
		
		var inputStates = lastContainer.getRecentStatesByWalletAdresses(hosterWallets); 
		
		var contractTX = contributor.operator.createContractTX(inputs, inputStates, distributions, segmentHashes, reqMsg.period);
			
		var count = contributor.unsolvedTransactions.length;
		for(var i = 0; i < count; i++)
		{
			if(contributor.unsolvedTransactions[i].hash == tx.hash)
			{
				console.log("이미 요청된 것");
				return;
			}
		}
		contributor.unsolvedTransactions.push(contractTX);		
		contributor.trySolveUnsolvedTransactions();
		
	}
	
	findPeer()
	{
		var adverts = contributor.node.peerAdvertisements;
		var adCount = adverts.length;
		for(var i = 0; i < adCount; i++)
		{
			
			var ad = adverts[i];
			//console.log(ad);
			if(ad.contributor)
			{
				contributor.node.connectFromAdvert(ad);
				
				//break;
			}
		}
	}
	
	release()
	{
		
		
	}
	
	
	checkTransactionFromWallet(address, _tx)
	{
		var tx = new Transaction(_tx.id, _tx.type, _tx.data);
		var count = contributor.unsolvedTransactions.length;
		for(var i = 0; i < count; i++)
		{
			if(contributor.unsolvedTransactions[i].hash == tx.hash)
			{
				console.log("이미 요청된 것");
				return;
			}
		}
		//console.log("wallet push : ");
		//console.log(tx.data.outputs);
		contributor.unsolvedTransactions.push(tx);
		
		contributor.trySolveUnsolvedTransactions();
		
		//contributor.prover.proveTransaction(tx, tempBlockState, proveInfo);
		//contributor.unsolvedTransactions.push(tx);
	}
	
	onTransactionProveResult(_tx, _stateContainer, _result, _info)
	{

		if(_info.reason == "solving")
		{
			if(_result == "proved")
			{
				
				
				
				if(_info.temp)
				{
					_stateContainer.block.transactions.push(_tx);
					_stateContainer.readAll();
				}
				
				if(_info.broadcasting)
				{
					//console.log("전파함");
					contributor.node.triggerEvent(null, "broadcastTransaction", _tx);
				}
				
				/*
				var targetBlock = _stateContainer.block;
				if(contributor.miner.isCookingBlock(targetBlock))
				{
					contributor.miner.addTransactionToCookingBlock(targetBlock, _tx);
				}	
				else if(contributor.blockchain.isLastBlock(targetBlock))
				{
					contributor.blockchain.addTransaction(targetBlock, _tx);
				}
				else
				{
					console.log("contributor : invalid block");
				}
				*/
				

			}
			else 
			{
				console.log("실패함 : " + _result);
			}
			
			if(_info.respondTarget)
			{
				contributor.node.triggerEvent(_info.respondTarget, "transactionRequestResult", _tx, _result);
			}
		}
		
	}
	
	checkContractSafety()
	{
		/*
		//
		var recentBlock = this.getRecentTemporalBlock();
		var recentStateContainer = this.getTemporalBlockState(recentBlock);
		var allContracts = recentStateContainer.getContracts();// from recent state container
		var contractKey = Object(allContracts).keys()
		//for(var contract in 
		//	var 
		*/
	}
	
	blockEventHandler(name, block, fork)
	{
		if(name == "linked" || name == "forked")
		{
			
			if(contributor.blockchain.isMainFork(fork))
			{
				//console.log(block.transactions.length);
				var lastBlockHash = block.toHash();
				var height = block.index;
				contributor.node.triggerEvent(null, "notifyLastBlock", lastBlockHash, height);
			}
			
			var lastBlock = contributor.blockchain.getLastBlock();
			var lastBlockHash = lastBlock.hash;
			var tempFirstBlock = contributor.tempBlocks[0];
			if(tempFirstBlock)	
			{				
				if(lastBlockHash != tempFirstBlock.previousHash )
				{
					// 모든 거래들을 다시 검증하기 위해 빼냄.
					var nowCount = contributor.tempBlocks.length;
					for(var i = 0; i < nowCount; i++)
					{
						var tempBlock = contributor.tempBlocks[i];
						contributor.unsolvedTransactions.concat(tempBlock.transactions.slice(1));
					}
					//console.log("reset");
					contributor.resetTemporalBlocks();
					contributor.getRecentTemporalBlock();
				}
			}
			else
			{
				contributor.getRecentTemporalBlock();
			}
			
			
			contributor.trySolveUnsolvedBlocks();
			contributor.trySolveUnsolvedTransactions();
			
			contributor.checkTempBlocksToMine();
			
			
		}
		else if(name == "already")
		{
			console.log("before throwing : " + block.hash);
			contributor.throwBlock(block.hash);
		}
		else if(name == "nofork")
		{
			console.log("No!!!!!!!!");
		}
		
	}
	
	giveMyBlockInfo(address)
	{
		var block = contributor.blockchain.getLastBlock();
		var lastBlockHash = block.toHash();
		var height = block.index;
		contributor.node.triggerEvent(null, "notifyLastBlock", lastBlockHash, height);
		
	}
	
	checkMyLastBlock(address, _blockHash, _height)
	{

		var lastBlock = contributor.blockchain.getLastBlock();
		var myHeight = lastBlock.index;
		
		if(myHeight < _height)
		{			
			contributor.node.triggerEvent([address], "getYourBlocksInfo", _blockHash);

		}
		
		
	}
	
	checkBlocksInfoToGive(address, _blockHash)
	{

		
		var targetBlocks = contributor.blockchain.getBlocksTo(_blockHash);
		var targetBlockHeaders = [];
		var count = targetBlocks.length;
		
		for(var i = 0; i < count; i++)
		{
			var block = targetBlocks[i];
			targetBlockHeaders.push({index:block.index, previousHash:block.previousHash, timestamp:block.timestamp, nonce:block.nonce, hash: block.hash});
			
		}

		contributor.node.triggerEvent([address], "sendBlocksInfo", targetBlockHeaders);
		

	}
	
	checkBlocksToGive(address, _blockHashes)
	{
		var blocksToGive = [];
		var count = _blockHashes.length;
		for(var i = 0; i < count; i++)
		{
			var requestedBlockHash = _blockHashes[i];
			var thatBlock = contributor.blockchain.getBlockByHash(requestedBlockHash);
			if(thatBlock)
			{
				blocksToGive.push(thatBlock);
			}
			else
			{
				console.log("i don't have that block");
			}
		}
		contributor.node.triggerEvent([address], "sendBlocks", blocksToGive);
	}
	
	checkReceivedBlocks(address, _blocks)
	{
		var count = _blocks.length;
		for(var i = 0; i < count; i++)
		{
			var thatBlock = _blocks[i];
			if(contributor.hasBlock(thatBlock.hash) || contributor.blockchain.getBlockByHash(thatBlock.hash))
			{
				continue;
			}
			
			var block = new Block();
			block.index = thatBlock.index;
			block.previousHash = thatBlock.previousHash;
			block.timestamp = thatBlock.timestamp;
			
			var txCount = thatBlock.transactions.length;
			var thatBlockTXs = [];
			for(var j = 0; j < txCount; j++)
			{
				var thatTX = thatBlock.transactions[j];


				var tx = new Transaction(thatTX.id, thatTX.type, thatTX.data);
				thatBlockTXs.push(tx);
			}
			block.transactions = thatBlockTXs;
			block.nonce = thatBlock.nonce;
			block.hash = block.toHash();
			
			if(block.hash != thatBlock.hash)
			{
				console.log("wrong");
				console.log(thatBlockTXs);
				console.log(thatBlock.transactions);
			}
			//console.log(block);
			contributor.keepBlock(block);
			//contributor.prover.proveBlock(block);
		}
		contributor.trySolveUnsolvedBlocks();
		
	}
	
	checkReceivedBlocksInfo(address, _blockHeaders)
	{
		var neededBlocks = [];
		
		var count = _blockHeaders.length;
		for(var i = 0; i < count; i++)
		{
			var blockHeader = _blockHeaders[i];
			var blockHash = blockHeader.hash;
			
			if(contributor.hasBlock(blockHash) || contributor.blockchain.getBlockByHash(blockHash))
			{
				
				
			}
			else
			{
				neededBlocks.push(blockHash);			
			}			
		}
		contributor.node.triggerEvent([address], "getYourBlocks", neededBlocks);
		
		
	}
	
	
	
	
	
	onBlockProveResult(_block, _result, _reason)
	{
		// reason can be dictionary
		if(_result == true)
		{

			contributor.throwBlock(_block.hash);
			contributor.blockchain.addBlock(_block);			

			
		}
		else
		{
			console.log("block failed : "  + _reason);
			if(_reason == "noPrev")
			{
				
			}
			else
			{
				contributor.throwBlock(_block.hash);
			}

		}
			
	}
	
	checkTempBlocksToMine()
	{
		var tempBlock = contributor.tempBlocks[0];
		//if(tempBlock && contributor.isBlockFull(tempBlock))
		if(tempBlock)
		{
			if(contributor.miner.cookingBlock != tempBlock)
			{
				contributor.miner.stop();
				contributor.miner.mine(tempBlock);
			}				
		}
	}
	
	trySolveUnsolvedTransactions() // 
	{
		if(this.transactionSolving)
		{
			this.newTXSolving = true;
			return;
		}
		
		var proveTargetBlock = this.blockchain.getLastBlock();
		var targetBlockState = this.blockchain.getStateContainer(proveTargetBlock);
		
		var tempBlock = contributor.getRecentTemporalBlock();
		if(!tempBlock)
		{
			return;
		}
		else
		{
			proveTargetBlock = tempBlock;
			targetBlockState = contributor.getTemporalBlockState(tempBlock);
		}
		
		this.transactionSolving = true;
		
		var count = contributor.unsolvedTransactions.length;
		var proveInfo = {};
		proveInfo.reason = "solving";
		if(tempBlock)
			proveInfo.temp = true;
		else
			proveInfo.temp = false;
		
		proveInfo.broadcasting = true;
		for(var i = count-1; i >= 0; i--)
		{
			var tx = contributor.unsolvedTransactions[i];
			contributor.unsolvedTransactions.splice(i, 1);
			
			contributor.prover.proveTransaction(tx, targetBlockState, proveInfo);
			//contributor.checkTransaction(null, contributor.unsolvedTransactions[i]);
		}
		this.transactionSolving = false;
		if(this.newTXSolving)
		{
			this.newTXSolving = false;
			this.trySolveUnsolvedTransactions();
		}
	}
	
	trySolveUnsolvedBlocks()
	{
		if(this.blockSolving)
			return;
		this.blockSolving = true;
		//var count = contributor.unsolvedBlocks.length;
		for(var key in contributor.unsolvedBlocks)
		{

			var block = contributor.unsolvedBlocks[key];
			var prevBlockHash = block.previousHash;
			var prevBlockInChain = contributor.blockchain.getBlockByHash(prevBlockHash);
			if(!prevBlockInChain)
			{
				//console.log("noPrev : " +  prevBlockHash);
				continue;
			}
			//console.log(block);
			var prevBlockState = contributor.blockchain.getStateContainer(prevBlockInChain);
			if(!prevBlockState)
			{
				console.log("contributor : no container to prove");
				continue;
			}
			
			//console.log(prevBlockState);
			
			contributor.prover.proveBlock(prevBlockState, block);			
		}
		this.blockSolving = false;
	}
	
	sendBlocks(address, blocksInfo)
	{
		var blocks = [];
		var len = blocksInfo.length;
		for(var i = 0 ; i < len; i ++)
		{
			var blockInfo = blocksInfo[i];
			var blockHash = blockInfo.hash;
			var block = contributor.blockchain.getBlockByHash(blockHash);
			if(block)
				blocks.add(block);
		}
		if(blocks.length > 0)
		{
			//contributor.node.triggerEvent(address, "sendBlocks", blocks);	
		}
	}
	
	getRecentTemporalBlock()
	{
		var nowCount = this.tempBlocks.length;
		if(nowCount == 0)
		{
			var prevBlock = this.blockchain.getLastBlock();
			var newTempBlock = this.miner.createNewBlock(prevBlock, this.wallet.getAddress(1));
			this.tempBlocks.push(newTempBlock);			
			var targetStates = contributor.blockchain.getStateContainer(prevBlock);	
			var newCont = new StateContainer(newTempBlock, targetStates);
			newCont.readAll();
			this.tempBlocksState.put(newTempBlock, newCont);			
			
			return newTempBlock;
		}
		else
		{
			if(this.miner.cookingBlock != this.tempBlocks[0])
				return this.tempBlocks[0];
			return null;
		}
		
		/*
		for(var i = 0; i < nowCount; i++)
		{
			console.log("test");
			var tempBlock = this.tempBlocks[i];
			if(!this.isBlockFull(tempBlock) && this.miner.cookingBlock != tempBlock)
			{
				return tempBlock;
			}					
		}
		var lastTempBlock = this.tempBlocks[nowCount - 1];
		var nextTempBlock = this.miner.createNewBlock(lastTempBlock, this.wallet.getAddress(1));
		this.tempBlocks.push(nextTempBlock);
		
		var lastTempBlockState = this.getTemporalBlockState(lastTempBlock);
		var newTempCont = new StateContainer(nextTempBlock, lastTempBlockState);
		newTempCont.readAll();
		this.tempBlocksState.put(nextTempBlock, newTempCont);
		return nextTempBlock;
		*/
		
	}	
	
	isBlockFull(_block)
	{
		if(_block.transactions.length >= 3)
		{
			return true;
		}
		return false;
	}
	
	getTemporalBlockState(_block)
	{		
		return this.tempBlocksState.get(_block);
	}
	
	resetTemporalBlocks()
	{
		if(this.miner.cookingBlock)
		{
			this.miner.stop();
		}
	
		this.tempBlocks = [];
		this.tempBlocksState = new HashTable();
		
	}
	
	
	checkTransaction(address, _tx)
	{
		var tx = new Transaction(_tx.id, _tx.type, _tx.data);
		var count = contributor.unsolvedTransactions.length;
		for(var i = 0; i < count; i++)
		{
			if(contributor.unsolvedTransactions[i].hash == tx.hash)
			{
				console.log("tx already");
				return;
			}
		}
		contributor.unsolvedTransactions.push(tx);
		contributor.trySolveUnsolvedTransactions();
		/*
		var tempBlock = contributor.getRecentTemporalBlock();
		if(tempBlock)
		{
			var tempBlockState = contributor.getTemporalBlockState(tempBlock);
			var proveInfo = {};
			proveInfo.reason = "solving";
			proveInfo.broadcasting = true;			
			
		}
		*/
		//contributor.prover.proveTransaction(tx, tempBlockState, proveInfo);		
	}

	

	hasBlock(_blockHash)
	{
		return this.unsolvedBlocks[_blockHash];
	}
	
	keepBlock(_block)
	{
		var hash = _block.toHash();
		this.unsolvedBlocks[hash] = _block;
		if(!this.unsolvedBlocksByPrevHash[_block.previousHash])
		{
			this.unsolvedBlocksByPrevHash[_block.previousHash] = [];
		}
		if(this.unsolvedBlocksByPrevHash[_block.previousHash].indexOf(_block) == -1)
			this.unsolvedBlocksByPrevHash[_block.previousHash].push(_block);
	}
	
	throwBlock(_blockHash)
	{
		var block = this.unsolvedBlocks[_blockHash];
		if(block)
		{

			var count = this.unsolvedBlocksByPrevHash[block.previousHash].length;
			for(var i = 0; i < count; i++)
			{
				if(this.unsolvedBlocksByPrevHash[block.previousHash][i] == block)
					this.unsolvedBlocksByPrevHash[block.previousHash].splice(i, 1);
			}
			delete this.unsolvedBlocks[_blockHash];
		}

		
	}
	
    getCoinsFromAddress(_address)
	{
		var lastContainer = this.blockchain.getRecentStateContainer();
		var utxosFromAddress = lastContainer.getUTXOs(_address);
		var coins = [];
		if(utxosFromAddress)
		{
			
			var count = utxosFromAddress.length;
			if(count > 0)
			{
				//console.log("=========coins count =========== " + count);
			}
			for(var i = 0 ; i < count; i++)
			{
				var utxo = utxosFromAddress[i];
				coins.push(utxo);
			}
			
		}
		return coins;
	}
	
	getCoinsAmountFromAddress(_address)
	{
		var coinSum = 0;
		var coins = this.getCoinsFromAddress(_address);
		if(coins)
		{
			var len = coins.length;
			for(var i = 0; i < len; i++)
			{
				coinSum += coins[i].amount;
			}
		}
		return coinSum;
	}
	
}

module.exports = Contributor;