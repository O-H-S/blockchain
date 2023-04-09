const R = require('ramda');
//const fs = require('fs');
const fs = require('fs-extra');
var path = require('path');
const md5File = require('md5-file')
const CryptoUtil = require('../security/cryptoUtil');


var hoster;
class Hoster
{
	
	constructor(_node, _wallet, _user)
	{
		hoster = this;
		this.node = _node;
		this.wallet = _wallet;
		this.maxSpace = 10;
		this.priceRate = 5;
		
		this.segmentLoadEvent = [];
		
		this.segments = {}; //  key : seg file name,    value : info
		this.segmentsByFile = {}; // key : original file of seg hash,   value : [seg1 file name, seg2 file name,....] 
		this.segmentsByHash = {};
		this.segmentsByAddress = {};

		this.acceptMessages = {}; // 
		
		this.user = "Test";
		if(_user)
			this.user = _user;
		
		this.init();
	}
	
	init()
	{
		if (!fs.existsSync('data/' + this.user)) 
			fs.mkdirSync('data/' + this.user );
		
		if (!fs.existsSync('data/' + this.user +'/files')) 
			fs.mkdirSync('data/' + this.user +'/files');
		
		if (!fs.existsSync('data/' + this.user +'/files/tempSegments')) 
			fs.mkdirSync('data/' + this.user +'/files/tempSegments');
	
		//this.node.addEventHandler("requestDownload", this.checkDownloading);
		this.node.addEventHandler("onfileDownloadPrestartEvent", this.onPrestartDownload);
		this.node.addEventHandler("onfileDownloadStartEvent", this.onStartDownload);
		this.node.addEventHandler("onfileDownloadEndEvent", this.onEndDownload);
		
		this.loadSegments();
		
	}
	
	release()
	{
		
		
	}
	
	checkDownloading(address, _message)
	{
		//_message : operator's assigned message
		
		
	}
	
	onPrestartDownload(address, stream, data)
	{
		
		if(data.uploading)
		{

			hoster.node.setDownloadPath("tempSegments/");
			/*
			if(hoster.isDownloadAccepted(address, data.fileID)) // data.segments : [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1]
			{
				hoster.node.setDownloadPath("downloading/");
			}
			*/
			
		}
		

	}
	
	onEndDownload(address, stream, data)
	{
		if(data.uploading)
		{
			hoster.checkTempSegment(data.path, data);			
		}
	}
	
	checkTempSegment(segment, data)
	{
		var segInfo = this.getSegmentInfo(segment);
		if(!segInfo )
		{
			console.log("hoster : segment format error : " + segment);
		}
		else
		{
			if(this.segmentsByHash[segInfo.hash])
			{
				console.log("hoster : 이미 존재하는 segment : " + segInfo.hash);						
			}
			else
			{				
				var fileName = data.name;
				if(this.segments[data.name])
				{
					fileName = CryptoUtil.randomId(32);
					// 파일 이름 변경해서 이동 segments 폴더로 이동.
				}
				
				var resultPath =  'data/' + this.user + '/segments/' + fileName;
				
				fs.moveSync(segment , resultPath);		
				this.loadSegment(fileName);
			}
			
		}
	}
	
	_______checkTempSegments()
	{
		if(this.checkingTemp)
		{
			this.checkBuffed = true;
			return;
		}
		
		this.checkingTemp = true;
		
		var testFolder = 'data/' + this.user +'/files/tempSegments';

		var fileList = [];
		
		fs.readdirSync(testFolder).forEach(file => 
			{
				var filePath = path.join(testFolder, file);
				var stat = fs.statSync(filePath);
				if (stat.isFile()) 
				{
					var segInfo = this.getSegmentInfo(filePath);
					if(!segInfo )
					{
						console.log("hoster : segment format error : " + filePath);
					}
					else
					{
						if(this.segmentsByHash[segInfo.hash])
						{
							console.log("hoster : 이미 존재하는 segment");						
						}
						else
						{
							
							fileList.push(file);
							/*
							var fileName = file;
							if(this.segments[file])
							{
								fileName = CryptoUtil.randomId(32);
								// 파일 이름 변경해서 이동 segments 폴더로 이동.
							}
							
							var resultPath =  'data/' + this.user + '/segments/' + fileName;
							
							fs2.moveSync(testFolder + "/" + file , 'data/' + fileName);
							*/
							/*
							.then(() => {
							})
							.catch(err => {
							  console.error("hoster : file moving err - "+ err);
							})			*/				
						}
						
					}
					
					//this.loadSegment(filePath);
		
				}
			}
		)
		
		for(var i = 0; i < fileList.length; i++)
		{
			var fileName = fileList[i];
			if(this.segments[fileList[i]])
			{
				fileName = CryptoUtil.randomId(32);
				// 파일 이름 변경해서 이동 segments 폴더로 이동.
			}
			
			var resultPath =  'data/' + this.user + '/segments/' + fileName;
			
			fs.moveSync(testFolder + "/" + fileList[i] , 'data/' + fileName);		
		}
		this.checkingTemp = false;
		if(this.checkBuffed)
		{		
			this.checkBuffed = false;
			this.checkTempSegments();
		}
		
	}
	
	
	isDownloadAccepted(address, fileID)
	{
		
		return true;
	}
	
	onStartDownload(address, stream, data)
	{
		
		
	}
	
	
	startHosting()
	{
		this.noticeMe();	
		if(!this.proofTimer)
		{
			this.proofSegments();
			this.proofTimer = setInterval(this.proofSegments, 1000 * 60);
		}
		
	}
	
	proofSegments()
	{
		hoster.node.triggerEvent(null, "proofSegments", hoster.node.getAdvertisement());		
	}
	
	noticeMe()
	{		
		hoster.node.triggerEvent(null, "noticeHoster", hoster.node.getAdvertisement() , hoster.maxSpace, hoster.priceRate, hoster.wallet.getAddress(1));
		if(!hoster.noticeTimer)
		{
			hoster.noticeTimer = setInterval
			(
				function()
				{
					hoster.node.triggerEvent(null, "noticeHoster", hoster.node.getAdvertisement(), hoster.maxSpace, hoster.priceRate, hoster.wallet.getAddress(1));
				}
			, 1000 * 10);
		}
	}
	
	loadSegments()
	{
		//console.log("we2323fwfwe");
		var currentPath = process.cwd();
		var resultPath =  currentPath + '/data/' + this.user + '/segments/';
		if (!fs.existsSync(resultPath)) 
		{
			fs.mkdirSync(resultPath);
		}
	
		//var fn = path.basename(resultPath);
		fs.readdir(resultPath, 
			(err, files) => 
			{
			  files.forEach(
				  file => 
				  {
					this.loadSegment(file);
				  }
			  );
			  
			  hoster.onLoadFinished();
			}
		)			
	}
	
	loadSegment(segFile)
	{
		var currentPath = process.cwd();
		var resultPath =  currentPath + '/data/' + this.user + '/segments/';
				
		var segInfo = this.getSegmentInfo(resultPath + segFile);
		if(!segInfo )
		{
			console.log("hoster : segment format error");
			return false;
		}
		
		//const fileHash = md5File.sync(resultPath + segFile);
		
		this.segments[segFile] = {};
		this.segments[segFile].info = segInfo;
		//this.segments[segFile].hash = fileHash;
		
		this.segmentsByHash[segInfo.hash] = segFile;
		
		for(var func of this.segmentLoadEvent)
		{						  
			func.call(this, segFile);
		}
		
		
	}
	
	onLoadFinished()
	{
		this.startHosting();		
	}
	
	getSegmentInfo(_segmentPath)
	{
		var stats = fs.statSync(_segmentPath);
		var fileSizeInBytes = stats.size
		if(fileSizeInBytes <= 8)
		{
			console.log("size err : " + fileSizeInBytes);
			return false;
		}
		
		var fd = fs.openSync(_segmentPath, 'r');

		var buffer = Buffer.alloc(8);
		var bytesRead = fs.readSync(fd, buffer, 0, 8, fileSizeInBytes - 8);
		
		var infoSize = (buffer.readUInt32BE(0) << 8) + buffer.readUInt32BE(4);
		//console.log(infoSize);
		
		if(infoSize <= 0 || infoSize >= fileSizeInBytes - 8)
		{
			console.log("size err2 :" + infoSize);
			fs.closeSync(fd);
			return false;
		}
		
		var infoBuffer = Buffer.alloc(infoSize);
		fs.readSync(fd, infoBuffer, 0, infoSize, fileSizeInBytes - 8-infoSize);
		//console.log(infoBuffer.toString());
		
		var parsed = JSON.parse(infoBuffer.toString());
		//console.log(parsed);
		
		fs.closeSync(fd);
		
		if(!parsed)
		{
			console.log("parse err2");
		}
		
		return parsed;
	}

	
}

module.exports = Hoster;