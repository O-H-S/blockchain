const R = require('ramda');
const UploadingRequest = require('../uploadingMessage/uploadingMessage.js').UploadingRequest;
const UploadingRequestResult = require('../uploadingMessage/uploadingMessage.js').UploadingRequestResult;
const ping = require('ping');
const CryptoUtil = require('../security/cryptoUtil');
const Transaction = require('../transaction/transaction');

var operator;
class Operator
{
	
	constructor(_node, _blockchain, _wallet, _prover)
	{
		operator = this;
		
		this.node = _node;
		this.wallet = _wallet;
		this.prover = _prover;
		this.blockchain = _blockchain;
		//this.walletAddress = _walletAddress;
		
		
		this.statesStatus = {}; // blockchain에서 hoster list를 가지고 온 뒤, 상태를 기록함. (접속하지 않은 호스트의 state도 존재 가능.)
		this.hosters = {};	 // 현재 online인 hoster들을 관리함. (계약에 관여되지 않은 호스트도 존재 가능.)
		
		this.init();
	}
	
	init()
	{
		
		// 호스트 관리 이벤트
		this.blockchain.blockAddEvent.push(this.blockEventHandler);		
		this.node.addEventHandler("noticeHoster", this.registerHoster);
		this.node.addEventHandler("broadcastHoster", this.checkHoster);
		this.node.addEventHandler("onPeerDisconnect", this.eraseInstantly);
		this.node.addEventHandler("noticeOperator", this.giveHosters);
		this.node.addEventHandler("proofSegments", this.checkProof);
		
		
		this.node.addEventHandler("onPeerConnect", this.noticeMyRole);
		
		this.node.addEventHandler("onRequestWalletCoin", this.checkWalletCoin);
		this.node.addEventHandler("getUploadPossible", this.checkUploadPossible);			
		
		this.node.addEventHandler("requestContractCreation", this.checkContractCreation);
		
		
		//this.noticeMe();
		
		setInterval
		(
			this.updateHosterList
		, 1000 * 30);
		
		setInterval(
		function()
		{
			operator.noticeMe(null);
		}
		, 1000 * 5);
						
	}
	
	blockEventHandler(name, block, fork)
	{
		if(name == "linked" || name == "forked")
		{			
			if(operator.blockchain.isMainFork(fork))
			{
				operator.updateStatesList(operator.blockchain.getRecentStateContainer());
			}					
		}
	}
	
	checkProof(address, advert)
	{
		var advertKey = JSON.stringify(advert);
		
		if(operator.hosters[advertKey])
		{
			var curtime = new Date().getTime() / 1000;
			operator.hosters[advertKey].timestamp = curtime;
			operator.updateStatesListFromHoster(advert);
		}
		
	}
	
	updateStatesListFromHoster(_hosterAD)
	{
		
		var advertKey = JSON.stringify(_hosterAD);
		var walletAddr = this.hosters[advertKey].address;
		var recentCont = this.blockchain.getRecentStateContainer();
		
		var state = recentCont.getRecentStateFromAddress(walletAddr);
		if(state)
		{
			var curtime = new Date().getTime() / 1000;
			var status = this.getStateStatus(state);
			if(status)
			{
				status.lastProofTime = curtime;
			}
		}
		
	}
	
	updateStatesList(_stateContainer)
	{
		var hosterStates = _stateContainer.getActiveStates(); // 계약에 관여된 state들을 모두 불러옴.
		if(!hosterStates)
		{
			return; // 없으면 무시.
		}
		
		
		var registeredStates = Object.keys(this.statesStatus);
		var stateCount = registeredStates.length;
		for(var i = 0 ; i < stateCount; i++)
		{
			var state = registeredStates[i];
			var status = this.statesStatus[state];
			var lastState = _stateContainer.getRecentStateFromAddress(state);
			if(lastState)
			{
				if(_stateContainer.isActiveState(lastState))
				{
					if(lastState != state) // update된 state에 대한 재배치.
					{
						this.statesStatus[lastState] = status;
						delete this.statesStatus[state];					
					}
				}
				else // 삭제된 state는 제거.
				{
					delete this.statesStatus[state];
				}
	
			}		
			
		}
		
		
		
		// 추가된 state에 대한 배치
		var count = hosterStates.length;
		for(var i =0 ; i < count; i++)
		{
			var targetState = hosterStates[i];
			var stateStatus = this.getStateStatus(targetState);
			if(!stateStatus)
			{
				var newStatus = this.addStateStatus(targetState);
			}
		}
		
	}
	
	getStateStatus(_state)
	{
		return this.statesStatus[_state];
	}
	
	addStateStatus(_state)
	{
		var curtime = new Date().getTime() / 1000;
		var newStatus = {};
		
		newStatus.birthTime = curtime;
		newStatus.advert = null;
		newStatus.lastProofTime = -1;
		
		this.statesStatus[_state] = newStatus;
		
		return newStatus;
	}
	
	
	noticeMe(address)
	{
		
		if(address)
			operator.node.triggerEvent([address], "noticeOperator");
		else
		{
			operator.node.triggerEvent(null, "noticeOperator");
		}
	}
	
	noticeMyRole(address)
	{				
		operator.noticeMe(address);

		
	}
	
	giveHosters(address)
	{		
		var hosters = Object.keys(operator.hosters);
		var hosterCount = hosters.length;
		for(var i = 0; i < hosterCount; i++)
		{
			var hosterAdvertKey = hosters[i];
			
			operator.node.triggerEvent(address, "broadcastHoster",  operator.hosters[hosterAdvertKey].advert, operator.hosters[hosterAdvertKey].space, operator.hosters[hosterAdvertKey].priceRate, operator.hosters[hosterAdvertKey].address, true);
		}
	}			
	
	checkUploadPossible(address, request)
	{
		if(request.price > operator.getWalletCoin(request.walletAddress))
		{
			var result = new UploadingRequestResult(false, "form_price" , request);
			operator.node.triggerEvent([address],  "uploadRequestResult", result);
			return false;		
		}
		
		if(request.period < 3600 * 24) // 하루 미만은 안됨.
		{
			var result = new UploadingRequestResult(false, "form_period" , request);
			operator.node.triggerEvent([address],  "uploadRequestResult", result);
			return false;
		}
		
		if(request.size <= 0)
		{
			var result = new UploadingRequestResult(false, "form_size" , request);
			operator.node.triggerEvent([address], "uploadRequestResult", result);
			return false;
		}
		
		var segCount = 30;
		var redundancy = request.redundancy;
		
		var hosters =  JSON.parse(JSON.stringify(operator.getHosters()));
		
		operator.excludeHosterByWalletAddress(hosters, request.walletAddress);
		
		var hostersCount = Object.keys(hosters).length;
		if (hostersCount < redundancy)
		{
			var result = new UploadingRequestResult(false, "nohosters" , request);
			operator.node.triggerEvent([address], "uploadRequestResult", result);
			return false;
		}
				
		var optimalHosters = operator.getOptimalHosters(hosters, redundancy);
		
		var possibleMessage = new UploadingRequestResult(true, "possible" , request, optimalHosters);
		operator.node.triggerEvent([address], "uploadRequestResult", possibleMessage);
		// 성공 메세지. 
		
	}
	
	excludeHosterByWalletAddress(hosters, walletAddress)
	{
		for(var advertKey of Object.keys(hosters)) // x
		{
			var hosterInfo = hosters[advertKey];
			if(hosterInfo.address == walletAddress)
			{
				delete hosters[advertKey];				
				break;
			}
		}
	}
	
	getOptimalHosters(hosters, minCount)
	{
		var targets = [];
		var hostersAdvertKeys = Object.keys(hosters);
		var hostersAdvertKeyCount = Object.keys(hosters).length;
		
		for(var i = 0; i < hostersAdvertKeyCount; i++)
		{
			var hosterInfo = hosters[hostersAdvertKeys[i]];
			var fileCount = this.blockchain.getFileCountFromAddress(hosterInfo.address);
			targets.push({advert: hosterInfo.advert, walletAddress: hosterInfo.address, count: fileCount});
		}
		
		targets.sort(
			function(a, b) 
			{
				return a.count - b.count;
			}
		);
		var result = [];
		for(var i = 0 ; i < hostersAdvertKeyCount; i++)
		{
			result.push( targets[i].advert);		
		}
		return result;
	}
	
	getHosters()
	{	
		return this.hosters;
	}
	
	checkWalletCoin(address, walletAddresses)
	{
		
		var UTXOs = [];
		var coins = {};
		coins[walletAddresses[0]] = [];
	
		
		var lastContainer = operator.blockchain.getRecentStateContainer();

		var utxosFromAddress = lastContainer.getUTXOs(walletAddresses[0]);
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
				var coin = {};
				//console.log(utxo);
				coins[walletAddresses[0]].push(utxo);
			}
			
		}
		
		operator.node.triggerEvent([address], "getWalletCoins", coins);
		
	}
	
	getWalletCoin(address)
	{
		var recentCont = this.blockchain.getRecentStateContainer();
		return recentCont.getUTXOsAmount(address);
	}
	
	

	
	registerHoster( address, _advert, _maxSpace, _priceRate, _walletAddress)
	{
		
		var curtime = new Date().getTime() / 1000;
		var advertKey = JSON.stringify(_advert);
		
		if(operator.hosters[advertKey]) 
		{			
			return;
		}	
		operator.hosters[advertKey] = {advert : _advert, space : _maxSpace, priceRate : _priceRate, address : _walletAddress, timestamp : curtime};
		operator.updateStatesListFromHoster(_advert);
		operator.node.triggerEvent(null, "broadcastHoster", _advert, _maxSpace, _priceRate, _walletAddress);		
	}
	
	checkHoster(address, _advert, _maxSpace, _priceRate, _walletAddress)
	{
		var advertKey = JSON.stringify(_advert);
		if(operator.hosters[advertKey])
			return;
		
		var curtime = new Date().getTime() / 1000;
		operator.hosters[advertKey] = {advert : _advert, space : _maxSpace, priceRate : _priceRate, address : _walletAddress, timestamp : -1};
		operator.node.triggerEvent(null, "broadcastHoster",  _advert, _maxSpace, _priceRate, _walletAddress);	
		operator.updateHoster(_advert);
	}
	
	updateHosterList() // 30초마다 실행 됨.
	{
		var hosters = Object.keys(operator.hosters);
		var hosterCount = hosters.length;

		for(var i = 0; i < hosterCount; i++)
		{
			var adKey = hosters[i];
			var ad = operator.hosters[adKey].advert;
			operator.updateHoster(ad);
		}

	}
	
	updateHoster(hosterAdvert)
	{
		var advertKey = JSON.stringify(hosterAdvert);
		var curtime = new Date().getTime() / 1000;
		var address = operator.node.getAddressFromAdvert(hosterAdvert);
		if(!operator.hosters[advertKey])
			return;
		
		ping.sys.probe(address, 
			function(isAlive)
			{
				if(isAlive)
				{					
						
				}
				else
				{
					if(!operator.hosters[advertKey])
						return;
					var lastTime = operator.hosters[advertKey].timestamp;	
					if(lastTime != -1)
					{
						if(lastTime - curtime > 1000 * 60)
						{
							operator.eraseHoster(hosterAdvert);
						}
					}
				}						
			}
		);	
		
	}
	
	eraseInstantly(address)
	{
		var hosters = Object.keys(operator.hosters);
		var hosterCount = hosters.length;
		
		for(var i = 0; i < hosterCount; i++)
		{
			var adKey = hosters[i];			
			var ad = operator.hosters[adKey].advert;
			var avalAddress = operator.node.getAddressFromAdvert(ad);
			if(address == avalAddress)
			{
				delete operator.hosters[adKey];
				break;
			}
		}
	}
	
	eraseHoster(hosterAdvert)
	{		
		var advertKey = JSON.stringify(hosterAdvert);
		if(operator.hosters[advertKey])
		{
			delete operator.hosters[advertKey];
		}
	}
	

	
	createContractTX(_inputs, _inputStates, _distributions, _segmentHashes, _period)
	{
		// inputs : UTXO set
		// address : state = 1: 1
		
		var curtime = new Date().getTime() / 1000;

		var id = CryptoUtil.randomId(64);
		
		var type = "contract";
		var data = {inputs: [], inputStates: [], distributions : [], segments: [], period : _period };
		
		data.inputs = _inputs;	
		data.inputStates = _inputStates;
		data.period = _period;
		data.distributions = _distributions;	
		data.segments = _segmentHashes;
		
		/*
		for(var i = 0; i < _inputs.length; i++)
		{
			
			var prevOutput = lastOutputStates[i];
			var input = {txiHash : null, transaction: prevOutput.transaction ,  address: transaction.walletAddress , signature: "test"};
			var inputHash = CryptoUtil.hash({transaction: input.transaction, address: input.address});
			intput.txiHash = inputHash;
			newTransaction.data.inputStates.push(input);
			
			var output = {timestamp: curtime, address: input.address};
			newTransaction.data.outputStates.push(output);
			
		}
		*/
		
		var newTransaction = new Transaction(id, type, data);
		return newTransaction;
		
	}
	
	createStorageProofTX(lastOutputState) // input: a state, output : a state
	{
		var curtime = new Date().getTime() / 1000;
		var newTransaction = new Transaction();
		newTransaction.id = CryptoUtil.randomId(64);
		
		newTransaction.type = "proof";
		newTransaction.data = {inputState: {}, outputState: {}};
				
		var input = {txiHash : null, transaction: lastOutputState.transaction ,  address: lastOutputState.walletAddress , signature: "test"};
		var inputHash = CryptoUtil.hash({transaction: input.transaction, address: input.address});
		intput.txiHash = inputHash;
		
		newTransaction.data.inputState = input;
		
		
		var output = {timestamp: curtime, address: input.address};
		newTransaction.data.outputState = output;
		
		newTransaction.hash = newTransaction.toHash();
		return newTransaction;
		
	}
	
	createContractImplementationTX(lastOutputStates, distributionsInfo) // input : states, output : states
	{
		// 하나의 state에는 여러 contract가 존재함.
		// state A's contracts = [contract, contract2, contract3];
		// state A's segments index = [contract's segments, 
		// distributionsInfo = [ ..distributionInfo..]
		// ((EX)) distributionInfo : hosterState, segments[state] = {start : 0, end : 100}
		var recentStateContainer = this.blockchain.getRecentStateContainer();
		for(var i = 0; i < lastOutputStates.length; i++)
		{
			//var contracts = recentStateContainer.getStateContracts(lastOutputStates[i]);
			
		}
		
		
		// TX 생성
		
		var curtime = new Date().getTime() / 1000;
		var newTransaction = new Transaction();
		newTransaction.id = CryptoUtil.randomId(64);
		
		newTransaction.type = "implementation";
		
		
		newTransaction.data = {inputStates: [], distributions : [], outputStates: []};
		// distributions : [ [s1,e1,s2,e2,s3,s4], [s1,e1,s2,e2], ... ]
		for(var i = 0; i < lastOutputStates.length; i++)
		{
			var prevOutput = lastOutputStates[i];
			var input = {txiHash : null, transaction: prevOutput.transaction ,  address: transaction.walletAddress , signature: "test"};
			var inputHash = CryptoUtil.hash({transaction: input.transaction, address: input.address});
			intput.txiHash = inputHash;
			newTransaction.data.inputStates.push(input);
			
			var output = {timestamp: curtime, address: input.address};
			newTransaction.data.outputStates.push(output);
			
			var dist = this.getDistributionArray();
			newTransaction.data.distributions.push();
		}

		
		
		
		
		
		newTransaction.hash = newTransaction.toHash();
		return newTransaction;
		
	}
	
	getDistributionArray()
	{
		return [];
	}
	
	
	

}

module.exports = Operator;