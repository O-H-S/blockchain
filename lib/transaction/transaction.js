const R = require('ramda');
const CryptoUtil = require('../security/cryptoUtil');

/*
Transaction structure:
{ // Transaction
    "id": "84286bba8d...7477efdae1", // random id (64 bytes)
    "hash": "f697d4ae63...c1e85f0ac3", // hash taken from the contents of the transaction: sha256 (id + data) (64 bytes)
    "type": "regular", // transaction type (regular, fee, reward)
    "data": {
        "inputs": [ // Transaction inputs
            {
                "transaction": "9e765ad30c...e908b32f0c", // transaction hash taken from a previous unspent transaction output (64 bytes)
                "index": "0", // index of the transaction taken from a previous unspent transaction output
                "amount": 5000000000, // amount of satoshis
                "address": "dda3ce5aa5...b409bf3fdc", // from address (64 bytes)
                "signature": "27d911cac0...6486adbf05" // transaction input hash: sha256 (transaction + index + amount + address) signed with owner address's secret key (128 bytes)
            }
        ],
        "outputs": [ // Transaction outputs
            {
                "amount": 10000, // amount of satoshis
                "address": "4f8293356d...b53e8c5b25" // to address (64 bytes)
            },
            {
                "amount": 4999989999, // amount of satoshis
                "address": "dda3ce5aa5...b409bf3fdc" // change address (64 bytes)
            }
        ]
    }
}
*/

class Transaction
{

    constructor(_id, _type, _data)
	{

		if(!_type || !_data)
		{
			console.log("TX : ERR");
		}
		//console.log("TX CREATED");
        this.id = _id;

        this.type = _type;

        this.data = _data;

		this.updateHash();
    }

    toHash()
	{
        return CryptoUtil.hash(this.id + this.type + this.getDataHashKey());
    }

	updateHash() // 정보 수정후 마지막에 호출 해줘야함.
	{

		this.hash = this.toHash();
	}

	getDataHashKey()
	{
		//parseInt(hash.substring(0, 14), 16);

		var inputValue = "";
		if(this.data.inputs)
		{
			var intputCount = this.data.inputs.length;
			for(var i = 0; i < intputCount; i++)
			{
				var input = this.data.inputs[i];
				var nowDataValue = input.address + input.transaction + input.index;
				var nowInputValue_sub = inputValue.substring(0, 10);
				inputValue = JSON.stringify(nowInputValue_sub + nowDataValue);
			}
		}

		var outputValue = "";
		if(this.data.outputs)
		{
			var outputCount = this.data.outputs.length;
			for(var i = 0; i < outputCount; i++)
			{
				var output = this.data.outputs[i];
				var nowDataValue = output.amount + output.address;
				var nowOutputValue_sub = outputValue.substring(0, 10);
				outputValue = JSON.stringify(nowOutputValue_sub + nowDataValue);
			}
		}

		var inputStateValue = "";
		if(this.data.inputStates)
		{
			var intputCount = this.data.inputStates.length;
			for(var i = 0; i < intputCount; i++)
			{
				var inputState = this.data.inputStates[i];
				var nowDataValue = inputState;
				var nowInputValue_sub = inputStateValue.substring(0, 10);
				inputStateValue = JSON.stringify(nowInputValue_sub + nowDataValue);
			}
		}


		/*
			아래 데이터들에 대한 hashSeed들도 필요함. (보류)

			data.period = _period;
			data.distributions = _distributions;
			data.segments = _segmentHashes;

		*/

		//this.dataKey = inputValue + outputValue + inputStateValue;
		return inputValue + outputValue + inputStateValue;
	}

    static fromJson(data)
	{
        let transaction = {};
        R.forEachObjIndexed((value, key) => { transaction[key] = value; }, data);

		let newTx = new Transaction(transaction.id, transaction.type, transaction.data);

        return newTx;
    }
}

module.exports = Transaction;
