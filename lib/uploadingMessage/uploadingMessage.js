const R = require('ramda');
const CryptoUtil = require('../security/cryptoUtil');
class UploadingRequest 
{
    constructor( _walletAddress, _size, _price, _period)
	{
		//this.source = _source;
		this.fileID = CryptoUtil.randomId(64);
		this.size = _size;
		this.price = _price;
		this.period = _period;
		this.redundancy = 3;
		this.walletAddress = _walletAddress;	
		
	}
}

class UploadingRequestResult
{
	constructor(_result, _reason, _targetMSG, _hosters)
	{
		this.result = _result;
		this.reason = _reason;
		this.targetMessage = _targetMSG;
		this.hosters = _hosters;		
	}	
}

class UploadingFileRequest
{
	constructor(_assignMessage)
	{
		this.assignMessage = _assignMessage;		
	}	
	
}


module.exports = 
{
	"UploadingRequest": UploadingRequest,
	"UploadingRequestResult" : UploadingRequestResult
};