const R = require('ramda');
const StateContainer = require('../blockchain/index.js').StateContainer;
var extend = require('util')._extend;
var prover;
class Prover
{
	
	constructor(_blockchain)
	{
		prover = this;		
		this.blockchain = _blockchain;

		
		this.proveTransactionEvent = [];
		this.proveBlockEvent = [];

		
		this.init();
	}
	
	init()
	{

		this.proveTransactionEvent.push(this.onProveTransactionFromBlock);

	}
	
	notifyBlocksAdd(blocks)
	{

		
	}
	
	checkBlockForm(_block)
	{
		
		return true;
	}
	
	proveTransaction(_transaction, _stateContainer, _info)
	{
		if(_transaction.type == "regular")
		{
			var inputSum = 0;
			var outputSum = 0;
			
			// UTXO가 존재 여부 검사.
			for(var input of _transaction.data.inputs)
			{
				var utxo = _stateContainer.getUTXO(input);
				if(!utxo)
				{
					console.log("proving tx failed : " + _info.reason);
					for(var func of this.proveTransactionEvent)
					{
						func.call(this, _transaction, _stateContainer, "noUTXO", _info);			
					}	
					return;
				}
				inputSum += utxo.amount;
			}
			
			
			// INPUT 합 < OUTPUT 합 검사
			for(var output of _transaction.data.outputs)
			{
				outputSum += output.amount;
			}
			
			if(outputSum < inputSum)
			{
				for(var func of this.proveTransactionEvent)
				{
					func.call(this, _transaction, _stateContainer, "bigInput", _info);			
				}		
				return;
			}
			
			for(var func of this.proveTransactionEvent)
			{
				func.call(this, _transaction, _stateContainer, "proved", _info);			
			}	
		}
		else if(_transaction.type == "contract")
		{
			var inputSum = 0;
			
			// UTXO가 존재 여부 검사.
			if(_transaction.data.inputs)
			{
				for(var input of _transaction.data.inputs)
				{
					var utxo = _stateContainer.getUTXO(input);
					if(!utxo)
					{
						console.log("proving tx failed : " + _info.reason);
						for(var func of this.proveTransactionEvent)
						{
							func.call(this, _transaction, _stateContainer, "noUTXO", _info);			
						}	
						return;
					}
					inputSum += utxo.amount;
				}
			}
			else
			{
				// 무료 case
				
			}
			
			
			// Input state 존재 여부 검사 (일단 생략)
			
			
			// UTXO >= price 검사
			if(inputSum < _transaction.data.price)
			{
				for(var func of this.proveTransactionEvent)
				{
					func.call(this, _transaction, _stateContainer, "wrongPrice", _info);			
				}	
				return;
			}
			
			// 업로더 서명 검사 (일단 생략)
			
			
			for(var func of this.proveTransactionEvent)
			{
				func.call(this, _transaction, _stateContainer, "proved", _info);			
			}
			
		}
		
	}
	
	proveBlock(_stateContainer, _block)
	{
		var txs = _block.transactions;
		var txsCount = txs.length;
		
		var testContainer = new StateContainer(_block, _stateContainer);
		
		var proveInfo = {}
		proveInfo.reason = "inBlock";
		proveInfo.block = _block;
		
		for(var i = 0; i < txsCount; i++)
		{
			var tx = txs[i];
			this.proveTransaction(tx, testContainer, proveInfo);
		}
		
		
	}
	
	onProveTransactionFromBlock(_tx, _stateContainer, _result, _info)
	{
		if(_info.reason != "inBlock")
		{
			return;
		}
		if(_info.finished)
			return;
		//console.log("tx prove result :" + _result);
		var block = _info.block;
		if(_result != "proved")
		{
			
			_info.finished = true;
			for(var func of this.proveBlockEvent)
			{
				func.call(this, block, false, "tx");			
			}
		}
		else
		{
			_stateContainer.readToTX(_tx);

			var lastTX = block.transactions[ block.transactions.length - 1];
			if(_tx == lastTX)
			{
				for(var func of this.proveBlockEvent)
				{
					func.call(this, block, true, "valid");			
				}
			}
		}	
	}
	
	proveReceivedBlocks(blocks)
	{
		var openList = [];
		var failedList = [];
		
		var length = blocks.length;
		for(var i = 0; i < length; i++)
		{
			var formResult = this.checkBlockForm(blocks[i]);
			if(formResult)
			{
				openList.push(blocks[i]);
			}
			else
			{				
				//failedList.push({blocks[i], 'form'});	
				for(var j = i+1; j < length; j++)
				{
					//failedList.push({blocks[j], 'form_sub'});	
				}
				break;
			}
		}
		
		for(var i = 0; i < openList.length; i++)
		{
			var blockHash = openList[i].toHash();
			var availableFork = this.blockchain.getForkForBlock(blockHash);
			
			if(availableFork)
			{				
				
			}
			else
			{
				//failedList.push({blocks[i], 'fork'});	
				for(var j = i+1; j < openList.length; j++)
				{
					//failedList.push({blocks[j], 'fork_sub'});	
				}
			}
			
		}
			
		
		/*
		var blockHeight = blocks[0].getHeight();
		var blocksLength = blocks.length;
		var blockChainHeight = this.blockchain.getHeight();
		
		var availableFork = this.blockchain.getForkForBlock(block[0]);
		
		if(blockChainHeight + 1 == blockHeight) // 블록체인에 추가할 수 있는지 확인.
		{			
			//this.blockchain.addBlocks(blocks);
			
			if(availableFork)
			{
				
				
			}
			else
			{
				
				
			}
		}
		else if(blockChainHeight + 1 < blockHeight)
		{

		}
		else if(blockChainHeight + 1 > blockHeight) // 내것과 높이가 같다면.
		{
			if(availableFork)
			{
				
				
			}
			else
			{
				
				
			}
			
		}
		*/

	}
	
	

}

module.exports = Prover;