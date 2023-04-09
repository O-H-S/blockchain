
const Block = require('../block/block');

process.on('message', 
	function(m) 
	{
		
		var message = m[0];
		var difficulty = m[1];
		var index = m[2];
		var previousHash = m[3];
		var timestamp = m[4];
		var merkleRoot = m[5];
		var nonce = m[6];
		
		
		var blockDifficulty = null;
		var newTimestamp = timestamp;
		var newNonce = nonce;
		var newHash;
		if(message == "stop")
		{			
			//console.log("stop mining");
			process.exit(1);
		}
		
		else if(message == "work")
		{				
			do 
			{
				//console.log(newNonce);
				newTimestamp = new Date().getTime() / 1000;
				newNonce++;
				newHash = Block.toHash(index, previousHash, newTimestamp, merkleRoot, newNonce);
				blockDifficulty = Block.getDifficulty(newHash);
				//console.log("blockDifficulty : " + blockDifficulty + " difficulty : " + difficulty);
			} 
			while (blockDifficulty >= difficulty);
			
			process.send(["finish", newTimestamp, newNonce, newHash]);		
		}
	}
);