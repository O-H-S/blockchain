const R = require('ramda');
const Db = require('../db/db');
const Blocks = require('../block/blocks');
const Block = require('../block/block');
const Transactions = require('../transaction/transactions');
const HashTable = require("jshashtable");
var extend = require('util')._extend;
// Database settings
const BLOCKCHAIN_FILE = 'blocks.json';
const TRANSACTIONS_FILE = 'transactions.json';

class Fork
{
	constructor(_parent)
	{
		this.parent = _parent;
		//this.startBlock =
		//this.endBlock =
		this.linkEvent = [];
		this.blockLinks = {};
		this.blocksByID = {};
		this.children = new HashTable();

	}

	linkBlock(block)
	{
		if(this.endBlock)
		{
			this.blockLinks[this.endBlock.toHash()] = block;
			this.endBlock = block;
			this.blocksByID[block.index] = block;
		}
		else
		{
			this.startBlock = block;
			this.endBlock = block;
			this.blocksByID[block.index] = block;
		}

		for(var func of this.linkEvent)
		{
			func.call(this, this, block.toHash());
		}
		//block.fork = this;
	}

	getBlocks()
	{
		var blocks = [];
		var curBlock = this.startBlock;
		while(curBlock)
		{
			blocks.push(curBlock);
			var nextBlockHash = curBlock.toHash();
			curBlock = this.blockLinks[nextBlockHash];
		}

		return blocks;
	}

	cutBlockLinks(block) // 이 block의 다음부터 컷 하는 함수
	{
		var curBlock = block;
		while(curBlock)
		{
			var temp = this.blockLinks[curBlock.toHash()];
			delete this.blockLinks[curBlock.toHash()];
			curBlock = temp;
		}
		this.endBlock = block;
	}

	branch(branchBlock, headBlock)
	{

		if(branchBlock == this.endBlock  )
		{

			var newFork = new Fork(this);
			this.children.put(newFork,true);
			newFork.linkEvent = this.linkEvent;
			newFork.linkBlock(headBlock);


			return [newFork];
		}
		else
		{


			var oldChild = extend({},this.children);
			var oldLinks =    extend({},this.blockLinks);
			//var oldLinks =   JSON.parse(JSON.stringify(this.blockLinks));
			//console.log(oldLinks);


			var originalFork = new Fork(this);
			originalFork.linkEvent = this.linkEvent;
			for(var child of this.children.keys())
			{

				child.parent = originalFork;
			}
			originalFork.children = oldChild;
			this.children = new HashTable();
			this.children.put(originalFork, true);
			this.cutBlockLinks(branchBlock);


			var originalBlocks = oldLinks[branchBlock.toHash()];
			while(originalBlocks)
			{

				originalFork.linkBlock(originalBlocks);
				originalBlocks = oldLinks[originalBlocks.toHash()];
			}



			var newFork = new Fork(this);
			this.children.put(newFork,true);
			newFork.linkEvent = this.linkEvent;
			newFork.linkBlock(headBlock);







			return [originalFork, newFork];

		}

	}
	isBlockLinkedTo(blockHash, targetBlockHash)
	{
		var nextBlock = this.getNext(blockHash);
		if(nextBlock)
		{
			if(nextBlock.toHash() == targetBlockHash)
			{
				return true;
			}
		}
		for(var child of this.children.keys())
		{
			//console.log(child);
			if(child.startBlock.toHash() == targetBlockHash)
				return true;
		}
		return false;
	}


	getNext(blockHash)
	{
		if(!this.blockLinks[blockHash])
			return false;
		return this.blockLinks[blockHash];
	}

	getBlockByID(id)
	{

		var startBlockID = this.startBlock.index;
		var endBlockID = this.endBlock.index;

		if(startBlockID > id)
		{
			return this.parent.getBlockByID(id);
		}

		if(endBlockID < id)
		{
			return this.endBlock;
		}

		return this.blocksByID[id];
	}

	getLength()
	{
		if(this.startBlock)
		{
			return Object.keys(this.blockLinks).length  + 1;
		}
		else
			return 0;
	}

	getTotalLength() // 자신이 소속된 줄기의 총 길이를 구함.
	{

		if(this.parent)
		{

			return this.getLength() + this.parent.getTotalLength();
		}

		return this.getLength();
	}
}

class StateContainer
{
	constructor(_block, _baseContainer)
	{
		this.block = _block;
		this.base = _baseContainer;
		this.position = 0; // next read pos
		this.finish = false;

		// UTXO 관련
		//this.unspentTransactionOutputs = new HashTable();
		this.unspentTransactionOutputs = {};
		this.addressUTXO = {};


		// Contract 관련
		// contract : uploader - hosters 의 계약.
		// subcontract : hosters - hosters의 계약.
		this.addressState = {}; // 특정 walleAddress가 가지는 state array(inactive states, one active state) OR 최신 state
		this.stateContracts = {};	// 특정 state가 책임지는 contract
		this.constractStates = {}; // 특정 contract와 연관되는 states
		this.contracts = {};
		this.subcontracts = {};

		//this.checkBase();

	}

	checkBase() // 부모 container가 모두 read된 상태에서, 읽기를 준비하는 코드.
	{
		if(this.base)
		{
			if(this.base.block.hash != this.block.previousHash)  // 디버그 코드
			{

				console.log("state container : block hash error");
				console.log(this.base.block.hash);
				console.log(this.block.previousHash);
			}

			if(this.base.position > this.base.block.transactions.length)  // 디버그 코드
			{
				console.log("err");
			}

			if(this.base.position != this.base.block.transactions.length)
			{
				this.position = 0;
				this.unspentTransactionOutputs = {};
				this.addressUTXO = {};
				this.addressState = {};
				this.stateContracts = {};

				if(this.base.readAll())
				{
					this.unspentTransactionOutputs = JSON.parse(JSON.stringify(this.base.unspentTransactionOutputs));
					this.addressUTXO = JSON.parse(JSON.stringify(this.base.addressUTXO));
					this.addressState = JSON.parse(JSON.stringify(this.base.addressState));
					this.stateContracts = JSON.parse(JSON.stringify(this.base.stateContracts));
					return true;
				}
				else
				{

					console.log("base read failed");
					return false;
				}
			}
			else
			{
				/*
				this.position = 0;
				this.unspentTransactionOutputs =  extend({},this.base.unspentTransactionOutputs);
				this.addressUTXO = extend({},this.base.addressUTXO);
				this.addressState = extend({},this.base.addressState);
				this.stateContracts = extend({},this.base.stateContracts);
				*/

				if(this.position == 0)
				{
					//console.log("base read2");
					this.unspentTransactionOutputs = JSON.parse(JSON.stringify(this.base.unspentTransactionOutputs));
					this.addressUTXO = JSON.parse(JSON.stringify(this.base.addressUTXO));
					this.addressState = JSON.parse(JSON.stringify(this.base.addressState));
					this.stateContracts = JSON.parse(JSON.stringify(this.base.stateContracts));
				}

				return true;
			}
		}
		else
		{
			console.log("no parent");
			if(this.position == 0)
			{
				this.unspentTransactionOutputs = {};
				this.addressUTXO = {};
				this.addressState = {};
				this.stateContracts = {};
			}

			return true;
		}
	}
	readToTX(_tx)
	{
		if(!this.checkBase())
		{
			console.log("readtx err");
			return false;
		}
		if(this.position == this.block.transactions.length)
		{
			this.finish = true;
			return true;
		}
		this.finish = false;
		var nowTX = this.block.transactions[this.position];
		while(nowTX != _tx)
		{
			this.readNext();
			nowTX = this.block.transactions[this.position]
			if(this.finish)
				return false;
		}
		return true;
	}

	readAll()
	{
		if(this.position > this.block.transactions.length)
		{
			console.log("err");
		}
		if(!this.checkBase())
		{
			console.log("checkBase failed");
			return false;
		}

		if(this.position == this.block.transactions.length)
		{
			this.finish = true;
			return true;
		}

		this.finish = false;
		while(this.readNext())
		{
			if(this.finish)
			{
				break;
			}
		}
		return this.finish;
	}

	readNext()
	{

		var targetTX = this.block.transactions[this.position];

		var applyResult = false;
		if(targetTX.type == "regular")
		{
			applyResult = this.applyTransaction(targetTX);

		}
		else if(targetTX.type == "contract")
		{
			applyResult = this.applyContract(targetTX);
		}
		else
		{
			console.log("Statecontainer : error");
		}

		if(!applyResult)
		{
			console.log("TX READ ERR");
			return false;
		}

		this.position++;
		if(this.position == this.block.transactions.length)
		{
			this.finish = true;
		}

		return true;
	}

	getContracts()
	{
		return this.contracts;
	}

	applyTransaction(_tx)
	{
		//var targetTX = this.block.transactions[this.position];
		var targetTX = _tx;



		// == 여기까지 수정함

		var inputsLen = targetTX.data.inputs.length;
		for(var i = 0; i < inputsLen; i++)
		{
			var input = targetTX.data.inputs[i];
			var outputInfo = this.getOutputUnspent(input.transaction, input.address, input.index);

			if(!outputInfo)
			{
				console.log("read error : " + this.block.index);
				return false;
			}
			this.removeUTXO(input.transaction, input.address , input.index);
		}


		if(this.position == 0) // 채굴 보상 거래 처리
		{
			var count = targetTX.data.outputs.length;
			for(var i = 0; i < count; i ++)
			{
				var output = targetTX.data.outputs[i];
				this.addUTXO(targetTX.hash, output.address, output.amount, i);
				//console.log("added for " + output.address);
			}

		}
		else
		{

			var outputs = targetTX.data.outputs;
			var outputsLen = outputs.length;
			for(var i = 0; i < outputsLen; i++)
			{
				var output = outputs[i];
				this.addUTXO(targetTX.hash, output.address, output.amount, i);
				//console.log("added for " + output.address);
				//console.log("tx numb " + this.block.transactions.length);

			}
		}
		return true;

	}

	applyContract(_tx)
	{
		var inputs = _tx.data.inputs;
		var inputStates = _tx.data.inputStates;
		var period = _tx.data.period;
		var price = _tx.data.price;
		var distributions = _tx.data.distributions;
		var segmentHashes = _tx.data.segments;


		var inputStatesLen = inputStates.length;
		/*
		// Input State Lock (생략)

		for(var i = 0; i < inputStatesLen; i++)
		{
			var inputState = inputStates[i];
			var outputState = null;
			var walletAddress = this.getWalletAddressFromState(inputState);

			if(!walletAddress) // 이 경우는 inputState이 호스트의 wallet address 이다.
			{

				outputState = this.updateState(inputState, _tx);
				// create init state

			}
			else // 이 경우는 inputState가 호스트의 last state 이다.
			{
				if(this.isLastState(inputState))
				{
					outputState = this.updateState(inputState, _tx);
				}
				else
				{
					console.log("read error : input state is not last state - " + this.block.index);
					return false;
				}

			}

		}
		*/


		// UTXO Lock
		if(inputs)
		{
			var inputsLen = inputs.length;
			for(var i = 0; i < inputsLen; i++)
			{
				var input = inputs[i];
				var outputInfo = this.getOutputUnspent(input.transaction, input.address, input.index);

				if(!outputInfo)
				{
					console.log("read error : " + this.block.index);
					return false;
				}
				this.removeUTXO(input.transaction, input.address , input.index);
			}
		}


		// 특정 state가 책임지는 contract 목록 update

		for(var i = 0; i < inputStatesLen; i++)
		{
			var inputState = inputStates[i];
			if(!this.stateContracts[inputState])
			{
				this.stateContracts[inputState] = [];
			}
			this.stateContracts[inputState].push({transaction :_tx.hash, distribution : distributions[i]});
		}

		return true;


	}

	isLastState(_state)
	{

		return true;
	}

	getWalletAddressFromState(_state)
	{

		return null;
	}

	getActiveStates()
	{

	}

	updateState(_state, _contractTX)
	{

		return null;
	}

	getOutputUnspent(_txHash, _address,_id) // 수정완료
	{
		if(!this.unspentTransactionOutputs[_txHash])
			return null;

		var utxos = this.unspentTransactionOutputs[_txHash];
		var count = utxos.length;
		for(var i = 0; i < count; i++)
		{
			if(utxos[i].index == _id && utxos[i].address == _address)
				return utxos[i];
		}
		return null;
	}

	getUTXOs(_address) // 수정완료
	{
		return this.addressUTXO[_address];
	}

	getUTXOsAmount(_address) // 수정완료
	{
		var utxos = this.getUTXOs(_address);

		var sum = 0;
		if(utxos)
		{
			for(var utxo of utxos)
			{
				sum += utxo.amount;
			}
		}
		return sum;
	}

	getUsableInputsByAmount(_address, amount)
	{
		var inputs = [];
		var utxos = this.getUTXOs(_address);
		if(!utxos)
			return null;
		// utxos[i] == {transaction: _txHash, index: _id, amount : _amount}
		// input == {address : firstAddress, transaction:selectedUTXO[i].transaction , index:selectedUTXO[i].index}
		var sum = 0;
		var utxoCount = utxos.length;

		for(var i = 0; i < utxoCount; i++)
		{
			var utxo = utxos[i];
			sum += utxo.amount;
			inputs.push({address : _address, transaction : utxo.transaction, index : utxo.index});
			if(sum >= amount)
			{
				break;
			}

		}
		if(sum < amount)
		{
			return null;
		}
		return inputs;
	}


	getRecentStatesByWalletAdresses(walletAddresses) // state 적용시 수정 필요.
	{
		return walletAddresses;
	}

	getFileCountFromAddress(_address)
	{
		var state = this.getRecentStateFromAddress(_address);

		if(state)
		{
			var contracts = this.getContractsFromState(state);
			if(!contracts)
				return 0;
			var count = contracts.length;
			return count;
		}
		else
			return 0;
	}

	getRecentStateFromAddress(_address)
	{
		return this.addressState[_address];
	}

	getContractsFromState(_state)
	{
		return this.stateContracts[_state];
	}

	removeUTXO(_txHash, _address, _id) // 수정완료
	{

		var txUTXOs = this.unspentTransactionOutputs[_txHash];
		var txcount = txUTXOs.length;
		for(var i = 0; i < txcount; i++)
		{
			if(txUTXOs[i].index == _id && txUTXOs[i].address == _address)
			{
				this.unspentTransactionOutputs[_txHash].splice(i, 1);
				break;
			}
		}


		var count = this.addressUTXO[_address].length;
		for(var i = 0; i < count; i ++)//
		{
			var output = this.addressUTXO[_address][i];
			if(output.index == _id && output.transaction == _txHash)
			{
				this.addressUTXO[_address].splice(i, 1);
				//console.log("removed");
				break;
			}
		}

	}


	isInputUTXO(_input)
	{

		console.log("미완성함수호출");
		return false;
	}

	getUTXO(_input) // 수정완료
	{


		var tx = _input.transaction;
		var id = _input.index;
		var address = _input.address;
		var txUTXOs = this.unspentTransactionOutputs[tx];

		if(!txUTXOs)
			return null;
		var count = txUTXOs.length;
		for(var i = 0; i < count; i ++)
		{
			if(txUTXOs[i].index == id && txUTXOs[i].address == address)
			{
				return txUTXOs[i];
			}
		}
		return null;
	}

	addUTXO(_txHash, _address, _amount, _id) // 수정완료
	{

		if(!this.unspentTransactionOutputs[_txHash])
			this.unspentTransactionOutputs[_txHash] = [];

		var outputInfo = {address: _address, amount : _amount, index : _id}; // outputInfo와 output은 다름 차이 주의.
		this.unspentTransactionOutputs[_txHash].push(outputInfo);


		if(!this.addressUTXO[_address])
			this.addressUTXO[_address] = [];

		var outputInfo2 = {transaction: _txHash, index: _id, amount : _amount};
		this.addressUTXO[_address].push(outputInfo2);
		//console.log("his coin count : " + this.addressUTXO[_address].length);
		return true;
	}

}
class BlockFrame // contain additional data related to block
{
	constructor(_block)
	{
		this.block = _block;
	}
}

var blockchain;
class Blockchain
{
	constructor(_user)
	{
		blockchain = this;

		this.rootFork = new Fork(null);

		this.mainForks =  new HashTable();


		this.stateContainers = new HashTable();

		this.blocksFork = {}; // key hash
		this.blocksFork["0"] = this.rootFork;

		this.blocksByHash = {};

		this.blockAddEvent = [];

		this.user = "Test";
		if(_user)
			this.user = _user;

        this.init();

	}

	init()
	{
		this.loadData(this.user);

		this.rootFork.linkEvent.push(this.OnBlockLink);


        if (this.blocks.length == 0)
		{
            console.info('Blockchain empty, adding genesis block');
            this.blocks.push(Block.genesis);
        }
		this.setMainFork( this.rootFork);
		this.addBlocks(this.blocks, "load");


		this.saveData();
    }

	setMainFork(_fork)
	{
		this.mainForkEnd = _fork;
		var mainForks = new HashTable();
		var curFork = _fork;
		while(curFork)
		{
			mainForks.put(curFork, true);
			curFork = curFork.parent;
		}
		this.mainForks = mainForks;
	}

	OnBlockLink(_fork, _blockHash)
	{

		blockchain.blocksFork[_blockHash] = _fork;
		if(_fork.getTotalLength() > blockchain.mainForkEnd.getTotalLength())
		{

			blockchain.setMainFork(_fork);
			//blockchain.printMainForks();

		}



		// mainfork 블록들을 저장함.
		blockchain.blocks = new Blocks();

		var currentBlock = blockchain.mainForkEnd.startBlock;
		while(currentBlock)
		{
			blockchain.blocks.push(currentBlock);
			currentBlock = blockchain.mainForkEnd.getNext(currentBlock.toHash());
		}

		blockchain.saveData();
	}

	loadData(name)
	{
		var dbName = name;
		this.blocksDb = new Db('data/' + dbName + '/' + BLOCKCHAIN_FILE, new Blocks());
        this.transactionsDb = new Db('data/' + dbName + '/' + TRANSACTIONS_FILE, new Transactions());

		this.blocks = this.blocksDb.read(Blocks);
        this.transactions = this.transactionsDb.read(Transactions);
	}


	saveData()
	{
		this.blocksDb.write(this.blocks);
		this.transactionsDb.write(this.transactions);
	}

	createStateContainer(block)
	{
		var container = this.stateContainers.get(block);
		if(container)
		{
			return container;
		}
		var prevBlock = this.getPrevBlock(block);
		var prevBlockCont = null;
		if(prevBlock)
		{
			prevBlockCont = this.getStateContainer(prevBlock);
		}
		else
		{
			//console.log("no prev state : " + block.index);
		}
		var newCont = new StateContainer(block, prevBlockCont);
		this.stateContainers.put(block, newCont);
		return newCont;
	}

	getStateContainer(block)
	{
		return this.stateContainers.get(block);
	}

	triggerBlockAddEvent(name, block, ...args)
	{
		for(var func of this.blockAddEvent)
		{
			func.call(this, name, block, ...args);
		}
	}

	addBlock(block)
	{
		var blockHash = block.toHash();
		var prevBlockHash = block.previousHash;
		var foundFork = this.findForkByHash(prevBlockHash);
		if(foundFork)
		{
			if(foundFork.isBlockLinkedTo(prevBlockHash, blockHash))
			{
				console.log("blockchain : already linked");
				this.triggerBlockAddEvent("already", block, foundFork);
				// 이미 연결되어 있음.
				return false;
			}
			else
			{
				if(foundFork.getNext(prevBlockHash) ||  (!foundFork.getNext(prevBlockHash) && foundFork.children.keys().length > 0))
				{
					console.log("blockchain : fork occured at (" + block.index +")");
					this.blocksByHash[blockHash] = block;
					var prevBlock = this.getBlockByHash(prevBlockHash);
					foundFork.branch(prevBlock, block);
					var container = this.createStateContainer(block);
					container.readAll();

					this.triggerBlockAddEvent("forked", block, foundFork);

				}
				else
				{
					//console.log("blockchain : new block linked (" + block.index +")(" + block.hash +")");
					this.blocksByHash[blockHash] = block;

					foundFork.linkBlock(block);
					var container = this.createStateContainer(block);
					container.readAll();
					//container.readAll();
					this.triggerBlockAddEvent("linked", block, foundFork);

				}
				return true;
			}
		}
		else
		{
			//console.log(prevBlockHash);
			this.triggerBlockAddEvent("nofork", block, null);
			console.log("blockchain : failed to link");
			return false;
		}

	}

	addBlocks(blocks, reason)
	{
		for(var block of blocks)
		{
			this.addBlock(block);
		}
		return true;
	}

	findForkByHash(_hash)
	{
		return this.blocksFork[_hash];
	}

	getPrevBlock(_block)
	{
		var prevHash = _block.previousHash;
		return this.blocksByHash[prevHash];
	}

	getBlockByHash(_blockHash)
	{

		return this.blocksByHash[_blockHash];
	}

	getLastBlock()
	{
		return this.mainForkEnd.endBlock;
	}
	/*
	getBlocks()
	{
		var mainForksArray = [];
		var curFork = this.mainForkEnd;
		while(curFork)
		{
			mainForksArray.push(curFork);
			curFork = this.mainForkEnd.parent;
		}
		var blocks = [];
		var forksCount = mainForksArray.length;
		for(var i = forksCount - 1; i >= 0; i--)
		{
			blocks.concat(mainForksArray[i].getBlocks());
		}
		//return this.mainForkEnd.getBlocks();
	}
	*/
	printMainForks()
	{
		var mainForksArray = [];
		var curFork = this.mainForkEnd;
		while(curFork)
		{
			//console.log(curFork.startBlock.index);
			mainForksArray.push(curFork);
			curFork = curFork.parent;
		}
		var printString = " ";
		var forksCount = mainForksArray.length;
		for(var i = forksCount - 1; i >= 0; i--)
		{
			var curBlock = mainForksArray[i].startBlock;

			while(curBlock)
			{
				printString = printString + " " + curBlock.index;
				curBlock = mainForksArray[i].getNext(curBlock.hash);
			}
			printString = printString + " - ";
		}
		console.log(printString);
	}

	getBlocksTo(_blockHash)
	{
		var blocks = [];
		var curBlock = this.getBlockByHash(_blockHash);
		while(curBlock)
		{
			blocks.unshift(curBlock);
			var prevBlockHash = curBlock.previousHash;
			curBlock = this.getBlockByHash(prevBlockHash);
		}
		//console.log(blocks);
		return blocks;
	}

	getBlockByID(id)
	{
		return this.mainForkEnd.getBlockByID(id);
	}

	getHeight()
	{
		return this.mainForkEnd.getTotalLength();
	}

	getDifficulty(index)
	{

		// Proof-of-work difficulty settings
		const BASE_DIFFICULTY = Number.MAX_SAFE_INTEGER;
		const EVERY_X_BLOCKS = 2;
		const POW_CURVE = 5;

		// INFO: The difficulty is the formula that naivecoin choose to check the proof a work, this number is later converted to base 16 to represent the minimal initial hash expected value.
		// INFO: This could be a formula based on time. Eg.: Check how long it took to mine X blocks over a period of time and then decrease/increase the difficulty based on that. See https://en.bitcoin.it/wiki/Difficulty
		return Math.max(
			Math.floor
			(
				//BASE_DIFFICULTY / Math.pow(Math.floor(((index || this.getHeight()) + 1) / EVERY_X_BLOCKS) + 1, POW_CURVE)
				BASE_DIFFICULTY / Math.pow(Math.floor((( 25) + 1) / EVERY_X_BLOCKS) + 1, POW_CURVE)
			)
		, 0);

    }

	getTotalTime()
	{


	}

	getTotalDifficulty()
	{

	}


	getRecentStateContainer()
	{
		var lastBlock = this.mainForkEnd.endBlock;
		return this.getStateContainer(lastBlock);
	}

	getFileCountFromAddress(_address)
	{
		var recentCont = this.getRecentStateContainer();
		return recentCont.getFileCountFromAddress(_address);
	}


	isMainFork(_fork)
	{
		return this.mainForks.get(_fork);
	}

}




module.exports =
{
	"Blockchain": Blockchain,
	"StateContainer": StateContainer,
	"Fork" : Fork
};
