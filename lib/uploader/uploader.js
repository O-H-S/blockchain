const R = require('ramda');
const UploadingRequest = require('../uploadingMessage/uploadingMessage.js').UploadingRequest;
const UploadingRequestResult = require('../uploadingMessage/uploadingMessage.js').UploadingRequestResult;
const fs = require('fs');
const FileReader = require('filereader');
const splitFile = require('split-file'); // 수정본
const HashTable = require("jshashtable");
const sizeof = require('object-sizeof');
const md5File = require('md5-file')
const path = require('path');
const CryptoUtil = require('../security/cryptoUtil');


class FileSpliter
{
	constructor(uploader)
	{
		this.uploader = uploader;
		this.splitFileFinishEvent = [];
		this.splitFileWorks = [];
		this.splitFileFinishedWorks = {};
		
	}
	
	splitFile(_filePath, _count, _data, _user)
	{		
		var worksCount = this.splitFileWorks.length;
		var id;
		
		if(worksCount == 0)
		{
			this.splitFileWorks.push(null);
			worksCount = 1;
		}
		
		for(var i = 0; i < worksCount; i++)
		{
			if(!this.splitFileWorks[i])
			{
				this.splitFileWorks[i] = [_filePath , _data];
				id = i;
				break;
			}
		}
		
		var spliter = this;
		var segments;
		var intid = setInterval(
			function()
			{
				var currentPath = process.cwd();

				var resultPath =  currentPath + '/data/'+ _user  +'/temp/split/' + id;
				if (!fs.existsSync(currentPath + '/data/'+ _user  +'/temp')) 
				{
					fs.mkdirSync(currentPath + '/data/'+ _user  +'/temp');
				}
				
				if (!fs.existsSync(currentPath + '/data/'+ _user  +'/temp/split')) 
				{
					fs.mkdirSync(currentPath + '/data/'+ _user  +'/temp/split');
				}
				if (!fs.existsSync(resultPath)) 
				{
					fs.mkdirSync(resultPath);
				}
				
				
				splitFile.splitFile(_filePath, _count, resultPath + "/" )
				  .then
				  (
					(names) => 
					{
						
						spliter.splitFileWorks[id] = null;
						spliter.splitFileFinishedWorks[_filePath] = names;
						for(var func of spliter.splitFileFinishEvent)
						{						  
							(func[0]).call(func[1], id, _filePath, _count, names, _data);
						}
						
						/*
						splitFile.mergeFiles(names, _filePath).
							then(
								() => 
								{
									console.log('Done!');
								}
							)
							.catch(
								(err) => 
								{
									console.log('Error: ', err);
								}
							);
						*/
					}
				  )
				.catch
				(
					
					(err) => 
					{
						//console.log(_filePath);
						console.log('uploader : file split error: ', err);
					}
				)
				clearInterval(intid);
			}
		, 100); // thread 동작을 위해 일부로 해놓음.
		
		return id;
		
	}
	
	isFileSpliting(_filepath, _data)
	{
		var worksCount = this.splitFileWorks.length;
		for(var i = 0; i < worksCount; i++)
		{
			if(this.splitFileWorks[i])
			{
				if(this.splitFileWorks[i][0] == _filepath && JSON.stringify( this.splitFileWorks[i][1]) == JSON.stringify( _data))
				{
					return true;
				}				
			}
		}
		return false;
	}
}

class SegmentSender
{
	constructor( _uploading, _startSeg, _targetSegments)
	{
		
		
		this.uploading = _uploading;
		this.node = _uploading.uploader.node;
		
		this.startSegID = _startSeg;
		this.segments = _targetSegments;
		this.segmentsUploaded = {};
		
		this.startCheckTimer = null;
		
		this.sendingEvent = [];
		this.id = CryptoUtil.randomId(32);
		
		this.finished = false;
		
		var sender = this;
		
		this.node.addEventHandler("onPeerConnect", 
			function(address)
			{
				if( sender.uploading.node.getAddressFromAdvert(sender.targetHoster) == address)
				{
					sender.onHosterConnected();
				}
			}
		);
		
		this.node.addEventHandler("onPeerDisconnect", 
			function(address)
			{
				if(sender.uploading.node.getAddressFromAdvert(sender.targetHoster) == address)
				{
					sender.onHosterDisconnected();
				}
			}
		);
		
		this.node.addEventHandler("onfileUploadEndEvent", 
			function(address, stream, data)
			{
				sender.onUploadFinish(stream, data);
			}
		);
		
	}
	
	setTargetHoster(_hosterAdvert)
	{
		
		if(this.targetHoster)
		{
			
		}
		
		this.targetHoster = _hosterAdvert;
		
		
	}
	
	start()
	{
		var sender = this;
		//console.log("-----------------------------");

		var avalAddress = this.uploading.node.getAddressFromAdvert(this.targetHoster);
		//console.log(avalAddress);
		//console.log("-----------------------------");
		if(!this.node.getPeerByOutputAddress(avalAddress))
		{
			if(!this.startCheckTimer)
			{
				this.node.connectToPeerByAddress(avalAddress); 
				
				this.startCheckTimer = setInterval(
					function()
					{
						if(!sender.node.getPeerByOutputAddress(avalAddress))
						{
							for(var func of sender.sendingEvent)
							{						  
								func.call(this.uploading, sender, "connecting", false);
							}
						}

						clearInterval(sender.startCheckTimer);
						sender.startCheckTimer = null;
					}, 30000);
			}
		}
		/*
		if(this.node.getPeerByOutputAddress(this.targetHoster))
		{
			
		}
		*/
	}
	
	send()
	{
		//console.log("sendS");
		var segCount = this.segments.length;
		for(var i = 0 ; i < segCount; i++)
		{
			var data = {};
			
			data.id = this.id;
			data.segID = i;
			data.uploading = true;
			
			var segment = this.segments[i];
			var avalAddress = this.uploading.node.getAddressFromAdvert(this.targetHoster);
			this.node.uploadFile(avalAddress, segment, data);
		}
	}
	
	isAllSegmentsUploaded()
	{
		var segCount = this.segments.length;
		for(var i = 0 ; i < segCount; i++)
		{
			var segment = this.segments[i];
			if(!this.segmentsUploaded[segment])
				return false;
		}
		return true;
	}
	
	onUploadFinish(steam, data)
	{
		if(!data.uploading)
		{
			return;
		}
		
		if(data.id != this.id)
		{
			return;
		}
		

	
		this.segmentsUploaded[this.segments[data.segID]] = true;
		
		if(this.isAllSegmentsUploaded())
		{
			this.finished = true;
			for(var func of this.sendingEvent)
			{						  
				func.call(this.uploading, this, "uploading", true);
			}
		}
	}
	
	onHosterDisconnected()
	{
		var segCount = this.segments.length;
		for(var i = 0 ; i < segCount; i++)
		{
			var segment = this.segments[i];
			this.segmentsUploaded[segment] = false;			
		}
		
		for(var func of this.sendingEvent)
		{						  
			func.call(this.uploading, this, "uploading", false);
		}
		
	}
	
	onHosterConnected()
	{
		this.send();
		//console.log("connected");
		for(var func of this.sendingEvent)
		{						  
			func.call(this.uploading, this, "connecting", true);
		}
	}
	

	
}

class Uploading
{
	constructor(_uploader, _file, _price, _period, _spliter)
	{
		this.uploader = _uploader;
		this.node = _uploader.node;
		this.requestMessage = null;
		this.file = _file;
		this.price = _price;
		this.period = _period;
		this.spliter = _spliter;
		this.replyMessages = [];
		this.firstReplyTime = 0;
		this.uploadingTimer = null;
		this.segments = [];
		this.segmentHashes = [];
		
		this.senders = [];
		this.spliter.splitFileFinishEvent.push([this.onSplitFileFinish, this]);
		
		
		this.hosters_openList = [];
		this.hosters_closeList = [];
	}
	
	getRequestMessage(walletAddress)
	{
		var stats = fs.statSync(this.file);
		var fileSizeInBytes = stats.size
		
		if(!this.requestMessage)
			this.requestMessage = new UploadingRequest( walletAddress, fileSizeInBytes, this.price, this.period);		
		return this.requestMessage;
	}
	
	applyReplyMessage(reply)
	{
		//var nowTime = new Date().getTime() / 1000;
		/*
		if(this.replyMessages.length == 0)
		{
			console.log("waiting for uploading");
			var uploading = this;
			this.uploadingTimer = setInterval(
				function()
				{
					if(uploading.replyMessages.length >= 1)
					{
						uploading.startUploading();
					}
					else
					{
						
						
					}
					clearInterval(uploading.uploadingTimer);
				}
			, 2000);
			//this.firstReplyTime =  nowTime;
		}
		*/
		this.replyMessages.push(reply);
		
		if(reply.result)
		{
			var replyHosters = reply.hosters;
			var count = replyHosters.length;
			for(var i = 0; i < count; i++)
			{
				var replyAdvert = replyHosters[i];
				if(this.hosters_closeList.indexOf(replyAdvert) == -1 && this.hosters_openList.indexOf(replyAdvert) == -1)
				{
					//console.log(replyAddress);
					this.hosters_openList.push(replyAdvert);
				}				
			}						
		}
		
		
	}
	
	getPossibleReplyMessage()
	{
		var possibleMessages = [];
		var count = this.replyMessages.length;
		for(var i = 0; i < count; i++)
		{
			if(this.replyMessages[i].result)
			{
				possibleMessages.push(this.replyMessages[i]);
			}
		}
		return possibleMessages;
	}
	
	start()
	{
		var uploading = this;
		/*
		if(!this.upladingStartTimer)
		{
			this.upladingStartTimer = setInterval(
				function()
				{					
					clearInterval(uploading.upladingStartTimer);
					uploading.upladingStartTimer = null;
				},
			5000);
				
		}
		*/
		
		var requestMessage = this.getRequestMessage(this.uploader.walletAddress.getAddress(1));
		this.uploader.rev_uploadingRequests.put(JSON.stringify(requestMessage), this);
		
		var splitInfo = {};
		splitInfo.targetUploading = this;		
		this.spliter.splitFile(this.file, 30, splitInfo, this.uploader.user); // 완료되면 요청 메세지를 보냄.
		
		
		for(var func of this.uploader.uploadingEvent)
		{						  
			func.call(this, this.file, true, "spliting");
		}
		
	}
	
	getPossibleHosterCount()
	{
		return this.hosters_openList.length;
	}
	
	onSplitFileFinish(_id, _originalFile, _count, _fileNames, _data)
	{
		if(_count != _fileNames.length)
		{		
			console.log("uploader : count err");
		}
		var targetUploading = _data.targetUploading;		
		
		if(targetUploading != this)
			return;
		
		this.segments = _fileNames;
				
		
		var segCount = _fileNames.length;
		for(var i = 0 ; i < segCount; i++)
		{
			var segInfo = {};
			segInfo.segID = i;
			segInfo.fileID = targetUploading.requestMessage.fileID;
			segInfo.owner = this.uploader.walletAddress.getAddress(1);
			segInfo.hash = md5File.sync(_fileNames[i]);
			this.segmentHashes.push(segInfo.hash);
			this.uploader.appendSegmentInfo(_fileNames[i], segInfo);			
		}
		
		for(var func of this.uploader.uploadingEvent)
		{						  
			func.call(this, _originalFile, true, "splited");
		}
		
		
		if(this.getRequestMessage(this.uploader.walletAddress.getAddress(1)))
		{
			for(var func of this.uploader.uploadingEvent)
			{						  
				func.call(this, _originalFile, true, "requested");
			}
		
			var uploading = this;
			this.uploadingTimer = setInterval(
				function()
				{
					var possibleMessages = uploading.getPossibleReplyMessage();
					if(possibleMessages.length >= 1)
					{
						if(uploading.getPossibleHosterCount() >= 9)
						{
							for(var func of uploading.uploader.uploadingEvent)
							{						  
								func.call(uploading, _originalFile, true, "uploading");
							}
							uploading.startUploading();
						}
						else
						{
							for(var func of uploading.uploader.uploadingEvent)
							{						  
								func.call(uploading, _originalFile, false, "notEnoughHoster");
							}
						}
					}
					else
					{						
						for(var func of uploading.uploader.uploadingEvent)
						{						  
							func.call(uploading, _originalFile, false, "noReply");
						}								
					}
					
					
					
					clearInterval(uploading.uploadingTimer);
					uploading.uploadingTimer = null;
				}
			, 3000);
		

			this.uploader.node.triggerEvent(null, "getUploadPossible", this.getRequestMessage(this.uploader.walletAddress.getAddress(1)));// 해당 계약이 성사될 수 있는지의 가능성을 물어봄.
			
		
		}
	}
	
	popHoster()
	{
		if(this.hosters_openList.length > 0)
		{
			return this.hosters_openList.pop();
		}
		
		return null;
	}
	
	
	startUploading()
	{
		var segments = this.segments;
		for(var i = 0; i < 3; i ++)
		{
			for(var j = 0; j < 3; j++)
			{
				var targetSegments = [];
				var startSeg = j*10 + 0;
				for(var k = 0; k < 10; k++)
				{
					var idx = j*10 + k;
					targetSegments.push(segments[idx]);
				}
				var targetHosterAdvert = this.popHoster();

				var newSender = new SegmentSender( this, startSeg, targetSegments);
				this.senders.push(newSender);
				newSender.sendingEvent.push(this.onSenderEventOccured);			
				newSender.setTargetHoster(targetHosterAdvert);			
				newSender.start();
			}
		}
	}
	isAllSenderFinished()
	{
		var count = this.senders.length;
		for(var i = 0; i < count; i++)
		{
			if(!this.senders[i].finished)
				return false;
		}
		return true;
	}
	
	getFinishedHosters()
	{
		var hosters = [];
		var count = this.senders.length;
		for(var i = 0; i < count; i++)
		{
			if(this.senders[i].finished)
			{
				hosters.push(this.senders[i].targetHoster);
			}
		}
		return hosters;
	}
	
	getFinishedSegments()
	{
		var disributions = [];
		var count = this.senders.length;
		for(var i = 0; i < count; i++)
		{
			if(this.senders[i].finished)
			{
				var endID = this.senders[i].startSegID +  (this.senders[i].segments.length - 1);
				disributions.push([this.senders[i].startSegID, endID]);
			}
			else
			{
				console.log("uploader : unfinished hoster");
				return null;
			}
		}
		return disributions;
	}
	
	getFinishedSegmentHashes()
	{
		return this.segmentHashes;
	}
	
	onSenderEventOccured(sender, eventName, result)
	{
		if(eventName == "connecting")
		{
			
			
		}
		else if(eventName == "uploading")
		{
			if(result)
			{
				//console.log(this);
				if(this.isAllSenderFinished())
				{
					var hosters = this.getFinishedHosters();
					var distributions = this.getFinishedSegments();
					var segmentHashes = this.getFinishedSegmentHashes();
					
					this.node.triggerEvent(null, "requestContractCreation", this.requestMessage, hosters, distributions, segmentHashes);
					
					for(var func of this.uploader.uploadingEvent)
					{						  
						func.call(this, this.file, true, "uploaded");
					}	
					
					
				}
			}
			
		}
		
	}

}


var uploader;

class Uploader
{
	
	constructor(_node, _walletAddress, _user)
	{
		uploader = this;
		this.node = _node;
		this.walletAddress = _walletAddress;
				
		this.operators = {};	

		this.uploadings = [];
		this.rev_uploadingRequests = new HashTable();
		this.uploadingEvent = [];
		
		this.downloadingRequests = new HashTable();
		
		this.fileSpliter = new FileSpliter(this);
		
		
		this.userFilesUpdateEvent = [];
		this.fileSelectedEvent = [];
				
				
		this.selectedFile = null;
		
		
		
		
		this.resultMessages = [];
		
		this.user = "Test";
		if(_user)
			this.user = _user;
		
		
		this.init();
	}
	
	init()
	{
		var myAD = this.node.getAdvertisement();
		myAD.uploader = true;
		this.node.updateMyAdvert(myAD);
		
		this.node.addEventHandler("noticeOperator", this.registerOperator);
		this.node.addEventHandler("onPeerDiconnect", this.removeOperator);
		this.node.addEventHandler("uploadRequestResult", this.checkResultMessage);
		//this.node.addEventHandler("onPeerDiconnect", this.checkRemoveAssignedWork);
		
		
		this.fileSelectedEvent.push(this.onFileSelected);
		
		
		setInterval(
		function()
		{
			uploader.findPeer();
		}
		, 1000 * 2);
		

		//this.updateUserFileList();
		//this.requestFileUploading('test.bmp', 40, 36000) 
		//this.fileTest();
	}
	
	
	
	release()
	{
		
		
	}
	
	
	findPeer()
	{
		var adverts = uploader.node.peerAdvertisements;
		var adCount = adverts.length;
		for(var i = 0; i < adCount; i++)
		{
			
			var ad = adverts[i];
			//console.log(ad);
			if(ad.contributor)
			{
				uploader.node.connectFromAdvert(ad);
			}
		}
	}
	
	updateUserFileList()
	{
		var testFolder = './userFiles';
		if (!fs.existsSync(testFolder)) 
		{
			fs.mkdirSync(testFolder);
		}
		
		uploader.userFileList = [];
		fs.readdirSync(testFolder).forEach(file => 
			{
				var filePath = path.join(testFolder, file);
				var stat = fs.statSync(filePath);
				if (stat.isFile()) 
				{
					
					uploader.userFileList.push({name: file, path: filePath});				
				}
			}
		)
		
		for(var func of uploader.userFilesUpdateEvent)
		{						  
			func.call(uploader);
		}
		
	}
	
	checkRemoveAssignedWork(address)
	{
		if(!uploader.assignedResultMessage) 
			return;
		
		
	}
	
	getDownloadingRequest(_peer, _msg)
	{
		
		return false;
	}
	
	onFileSelected(_file)
	{
		this.selectedFile = _file;		
	}
	
	
	
	checkResultMessage(_address, _resultMessage)
	{
		
		//console.log(_resultMessage);
		var targetUploading = uploader.rev_uploadingRequests.get( JSON.stringify( _resultMessage.targetMessage));
		
		if(!targetUploading)
		{
			
			return;
		}
		
		var targetFile = targetUploading.file;
		
		if(!targetFile)
			return;
		
		/*
		if(!_resultMessage.result )
		{
			for(var func of uploader.uploadingEvent)
			{						  
				func.call(uploader, targetFile, false , _resultMessage.reason);
			}
		}
		*/
		targetUploading.applyReplyMessage(_resultMessage);

		//uploader.resultMessages.push(_resultMessage);
		
		//uploader.assignResultMessage();
	}
	
	assignResultMessage()
	{
		if(!uploader.assignedResultMessage) 
		{
			//uploader.assignedWaitingTime = 1000 * 10;
			uploader.assignedKillTimer = setInterval(removeAssignedMessage, 1000 * 10); // 10초가 지날동안 연결과 호스터들의 동의를 받지 못하면 해당 메세지에 대한 작업을 중지.
			uploader.assignedResultMessage = uploader.resultMessages[0];
			delete uploader.resultMessages[0];
			
			uploader.checkConnectionState(uploader.assignedResultMessage);
			uploader.assignedCheckTimer = setInterval
			(
				this.checkUploadingStatus
			, 500);
			
		}
		
	}
	
	checkUploadingStatus()
	{
		if(uploader.assignedResultMessage) 
		{
			var allReady = true;
			var ready = uploader.checkConnectionState(uploader.assignedResultMessage);
			if(ready)
			{			
				var ready2 = uploader.checkAcceptedState(uploader.assignedResultMessage);
				if(ready2)
				{
						
					
				}
				else
				{
					allReady = false;			
				}
			}
			else
			{
				allReady = false;				
			}
			
			if(allReady)
			{
				if(!uploader.assignedTransferStarted) // 파일 전송이 시작 되었음.
				{
					uploader.assignedTransferStarted = true;
					clearInterval(uploader.assignedKillTimer);
										
					var uploadData = {};
					uploadData.reason = "upload"
					uploadData.fileID = uploader.assignedResultMessage.targetMessage.fileID;

					var hosters = uploader.assignedResultMessage._hosters;
					var hosterCount = hosters.length;
					var allConnected = true;
					for(var i = 0; i < hosterCount; i++)
					{
						var address = hosters[i];
						//uploader.node.upload(, 'segment_.bmp', {name: 'test.bmp'});
					}
					//uploader.node.upload(, 'test.bmp', {name: 'test.bmp'});
					// 파일 전송 시작.
					// 파일 					
				}			
				
			}
			else
			{
				if(uploader.assignedTransferStarted)
				{
					uploader.removeAssignedMessage();
				}				
			}

		}		
		else
		{
			clearInterval(uploader.assignedCheckTimer);
			clearInterval(uploader.assignedKillTimer);
		}
	}
	
	removeAssignedMessage()
	{
		if(uploader.assignedResultMessage) 
		{		
			clearInterval(uploader.assignedCheckTimer);
			clearInterval(uploader.assignedKillTimer);
			uploader.assignedResultMessage = null;
			uploader.assignResultMessage();
		}
	}
	
	checkConnectionState(_msg)
	{
		var hosters = _msg._hosters;
		var hosterCount = hosters.length;
		var allConnected = true;
		for(var i = 0; i < hosterCount; i++)
		{
			var address = hosters[i];
			if(uploader.node.isPeerConnected(address))
			{
				
			}
			else
			{
				allConnected = false;
				uploader.node.connectToPeer(address);			
			}
			
		}
		
		return allConnected;
		
	}
	
	checkAcceptedState(_msg)
	{
		var allAccepted = true;
		var hosters = _msg._hosters;
		var hosterCount = hosters.length;
		for(var i = 0; i < hosterCount; i++)
		{
			var address = hosters[i];
			
			if(uploader.isAcceptedByHoster(address))
			{
				
				
			}
			else if(!uploader.getDownloadingRequest(address, _msg))
			{
				uploader.node.triggerEvent(address, "requestDownload", _msg);
			}
			
		}
		return allAccepted;
		
	}
	
	registerOperator( address)
	{

		var peer = address;
		
		if(uploader.operators[peer]) 
			return;
		
		uploader.operators[peer] = true;
		//console.log("operators : " + uploader.operators.length);
				
	}
	
	removeOperator(address)
	{
		if(uploader.operators[address]) 
		{
			uploader.operators[peer] = false;
		}
	}

	
	isNodeConnectedToOperator()
	{
		if (Object.keys(uploader.operators).length > 0)
			return true;
		return false;
	}
	
	
	
    requestFileUploading(_file, _price, _period) 
	{
		var uploading = this.getFileUploading(_file, _price, _period);
		if(uploading) // 이미 업로딩 진행중.
		{
			//this.
			for(var func of this.uploadingEvent)
			{						  
				func.call(this, _file, false ,"already");
			}
			return false;
		}
		
		if(!this.isNodeConnectedToOperator()) // 어떤 operator node도 연결되어 있지 않음.
		{
			for(var func of this.uploadingEvent)
			{						  
				func.call(this, _file, false , "nooperator");
			}
			return false;
		}
		
		uploading = new Uploading(this, _file, _price, _period, this.fileSpliter);
		this.uploadings.push(uploading);

		
		uploading.start();
		
		
		return true; // request가 성공한 것임. (not yet uploaded)
	}
	
	
	
	getFileUploading(_file, _price, _period)
	{
		var uploadingCount = this.uploadings.length;
		for(var i = 0 ; i < uploadingCount; i++)
		{
			var uploading = this.uploadings[i];
			if(uploading.file == _file && uploading.price == _price && uploading.period == _period)
				return uploading;
		}		
		return null;
	}
	
	getRequestFromFile(_req)
	{
		return this.rev_uploadingRequests.get(_req);
	}
	
	removeFileRequest(_req)
	{
		var file = this.rev_uploadingRequests.get(_req);
		if(file && this.uploadingRequests.get(file))
		{
			this.uploadingRequests.remove(file);
		}
		this.rev_uploadingRequests.remove(_req);
	}
	
	
	
	
	
	
	
	
	
	appendSegmentInfo(_segmentPath, _infoData)
	{				
		//console.log(_infoData);
		var strings = JSON.stringify(_infoData);
		var infoBuffer = Buffer.from(strings, 'utf8');
		var dataSize = sizeof(infoBuffer); // sizeof(dataSize) = 8
		var buffer = Buffer.alloc(8);
		
		
		buffer.fill(0);
		buffer.writeUInt32BE(dataSize >> 8, 0); //write the high order bits (shifted over)
		buffer.writeUInt32BE(dataSize & 0x00ff, 4); //write the low order bits

		
		fs.appendFileSync(_segmentPath, infoBuffer);
		fs.appendFileSync(_segmentPath, buffer);
	}
	
	getSegmentInfo(_segmentPath)
	{
		var stats = fs.statSync(_segmentPath);
		var fileSizeInBytes = stats.size
		if(fileSizeInBytes <= 8)
			return false;
		
		var fd = fs.openSync(_segmentPath, 'r');

		var buffer = Buffer.alloc(8);
		var bytesRead = fs.readSync(fd, buffer, 0, 8, fileSizeInBytes - 8);
		
		var infoSize = (buffer.readUInt32BE(0) << 8) + buffer.readUInt32BE(4);
		//console.log(infoSize);
		
		if(infoSize <= 0 || infoSize >= fileSizeInBytes - 8)
			return false;
		
		var infoBuffer = Buffer.alloc(infoSize);
		fs.readSync(fd, infoBuffer, 0, infoSize, fileSizeInBytes - 8-infoSize);
		//console.log(infoBuffer.toString());
		
		var parsed = JSON.parse(infoBuffer.toString());
		//console.log(parsed);
		
		fs.closeSync(fd);
		
		
		return parsed;
	}	

}

module.exports = Uploader;