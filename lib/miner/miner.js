const R = require('ramda');
const spawn = require('threads').spawn;
const Block = require('../block/block');
const prover = require('../prover/prover');
const CryptoUtil = require('../security/cryptoUtil');
const Transaction = require('../transaction/transaction');
const Config = require('../config');


var cp = require('child_process');

var miner;
class Miner 
{
    constructor(_blockchain, _wallet) 
	{
		miner = this;
        this.blockchain = _blockchain;
		this.wallet = _wallet;
		
		this.unsolvedTransactions = {};
		//this.miningBlock
		//this.cookingBlock
		
		
		
		this.init();
		
    }

	init()
	{		
		this.blockchain.blockAddEvent.push(this.blockEventHandler);
		//this.mine();
	}
	
	mine(_block)
	{
		if(this.worker)
			return;
		
		this.worker =  cp.fork('./lib/miner/work.js');	
		this.worker.on('message', 
			function(m) 
			{
				var message = m[0];
				var timestamp = m[1];
				var nonce = m[2];
				var testHash = m[3];
				if(message == "finish")
				{

					
					miner.mining = false;
					miner.cookingBlock.timestamp = timestamp;
					miner.cookingBlock.nonce = nonce;
					miner.cookingBlock.hash = miner.cookingBlock.toHash();
					if(testHash != miner.cookingBlock.hash)
					{
						console.log("miner : hash error : " + miner.cookingBlock.hash);
						
					}				
					else
					{
						if(miner.blockchain.getLastBlock().hash != miner.cookingBlock.previousHash)
						{
							console.log("fuck");
						}
						else
						{
							//console.log("good");
							miner.blockchain.addBlock(miner.cookingBlock);
						}
					}		
					//miner.cookingBlock = null;	
				}
				
			}
		);
		
		
		this.mining = true;
		//this.createNewBlock(null, this.wallet.getAddress(1));

		this.cookingBlock = _block;
		//console.log("minie " + _block.index);
		this.worker.send(["work", this.blockchain.getDifficulty(), this.cookingBlock.index, this.cookingBlock.previousHash, this.cookingBlock.timestamp, Block.getTransactionsHashKey(this.cookingBlock.transactions), this.cookingBlock.nonce]);
		
		
		/*
		var difficulty = m[1];
		var index = m[2];
		var previousHash = m[3];
		var timestamp = m[4];
		var merkleRoot = m[5];
		var nonce = m[6];
		*/
	}
	
	stop()
	{
		if(this.worker)
		{
			this.worker.send(["stop"]);
			this.worker.kill('SIGTERM');
			//this.worker.send(["stop"]);
			this.cookingBlock = null;
			this.worker = null;
		}
		
	}
	
	blockEventHandler(name, block)
	{
		if(name == "linked" || name == "forked")
		{
			//miner.mine();
		}
		
	}
	
	isMining()
	{
		return this.mining;
	}
	
	isCookingBlock(_block)
	{
		if(this.cookingBlock == _block)
		{
			return true;
		}
		return false;
	}
	
	addTransactionToCookingBlock(_block, _tx)
	{
		
		
	}
	
	createNewBlock(_prevBlock, rewardAddress)
	{
		var prevBlock = _prevBlock;
		
		var prevBlockHash = prevBlock.toHash();
		
		var newBlock = new Block();
		newBlock.index = prevBlock.index + 1;
		newBlock.timestamp = new Date().getTime() / 1000;
		newBlock.nonce = 0;
		newBlock.previousHash = prevBlockHash;
		
		var tx = this.createRewardTransaction(rewardAddress);
		
		newBlock.transactions = [];
		newBlock.transactions.push(tx);
		
		//var coins = {};
		//coins[rewardAddress] = [];
		//coins[rewardAddress].push({transaction : tx.hash, index : 0, amount : 100 });
		
		//var testTX = this.wallet.test_createTransactionFromWallet(rewardAddress, 1, coins);
		//newBlock.transactions.push(testTX);

		return newBlock;
	}
	
	createRewardTransaction(rewardAddress)
	{
		var data = {inputs: [], outputs: [] };		
		data.outputs.push({amount:  100, address: rewardAddress}); // 잔액

		return new Transaction(CryptoUtil.randomId(64), "regular", data);
	}
}

module.exports = Miner;

