const Transaction = require('./transaction');
const R = require('ramda');

class Transactions extends Array 
{
    static fromJson(data) 
	{
		//console.log("fomrjson");
        let transactions = new Transactions();
        R.forEach(
		(transaction) => 
		{ 
			var newTX = Transaction.fromJson(transaction);
			//console.log(newTX);
			transactions.push(newTX); 
		}
		, data);
		
		
		
        return transactions;
    }
}

module.exports = Transactions;