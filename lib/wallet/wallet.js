const R = require('ramda');
const CryptoUtil = require('../security/cryptoUtil');
const Transaction = require('../transaction/transaction');
const Db = require('../db/db');

class WalletData
{
	constructor()
	{
		this.id = null;

        this.passwordHash = null; // 비밀번호를 해쉬
        this.secret = null;

        this.keyPairs = [];

	}

	generateAddress()
	{
        // If secret is null means it is a brand new wallet
        if (this.secret == null)
				{
            this.generateSecret();
        }

        let lastKeyPair = R.last(this.keyPairs);

        // Generate next seed based on the first secret or a new secret from the last key pair.
        let seed = (lastKeyPair == null ?  this.secret : CryptoUtil.generateSecret(R.propOr(null, 'secretKey', lastKeyPair)));
        let keyPairRaw = CryptoUtil.generateKeyPairFromSecret(seed);
        let newKeyPair = {
            index: this.keyPairs.length + 1,
            secretKey: CryptoUtil.toHex(keyPairRaw.getSecret()),
            publicKey: CryptoUtil.toHex(keyPairRaw.getPublic())
        };
        this.keyPairs.push(newKeyPair);
        return newKeyPair.publicKey;
    }

    generateSecret()
	{
        this.secret = CryptoUtil.generateSecret(this.passwordHash);
        return this.secret;
    }

    getAddressByIndex(index)
	{
        return R.propOr(null, 'publicKey', R.find(R.propEq('index', index), this.keyPairs));
    }

    getAddressByPublicKey(publicKey)
	{
        return R.propOr(null, 'publicKey', R.find(R.propEq('publicKey', publicKey), this.keyPairs));
    }

    getSecretKeyByAddress(address)
	{
        return R.propOr(null, 'secretKey', R.find(R.propEq('publicKey', address), this.keyPairs));
    }

    getAddresses()
	{
        return R.map(R.prop('publicKey'), this.keyPairs);
    }

	static fromPassword(password)
	{
        let wallet = new WalletData();
        wallet.id = CryptoUtil.randomId();
        wallet.passwordHash = CryptoUtil.hash(password);
        return wallet;
    }

	static fromHash(passwordHash)
	{
        let wallet = new WalletData();
        wallet.id = CryptoUtil.randomId();
        wallet.passwordHash = passwordHash;
        return wallet;
    }

    static fromJson(data)
	{
        let wallet = new WalletData();
        R.forEachObjIndexed((value, key) => { wallet[key] = value; }, data);
        return wallet;
    }

}

var wallet;
class Wallet
{
    constructor(_node, _user)
	{
		wallet = this;
		this.password = _user;
		this.node = _node;
		this.coins = {};
		this.needUpdate = false;

		this.user = "Test";
		if(_user)
			this.user = _user;
		// this.coins[adresses] = [{tx : utxo가 포함된 tx, id: 몇번째인지, amount : 코인의 양}, ....]

		this.coinUpdateEvent = [];

		this.lastUsedCoinID = 0;

		this.init();

    }

	init()
	{
		this.loadData();

		if(!this.walletData.id)
		{
			//console.log("wallet : invalid wallet");
			this.walletData = WalletData.fromPassword(this.password);
			this.walletData.generateAddress();
			this.saveData();
		}

		this.node.addEventHandler("getWalletCoins", this.onReceiveWalletCoins);
		//this.node.addEventHandler("
		setInterval(this.updateWalletCoins , 1000 * 4);


	}

	updateWalletCoins()
	{
		var pubKeys = [];
		var pairLen = wallet.walletData.keyPairs.length;
		for(var i = 0 ; i < pairLen; i ++)
		{
			 pubKeys.push(wallet.walletData.keyPairs[i].publicKey);
		}
		wallet.node.triggerEvent(null, "onRequestWalletCoin", pubKeys);
	}

	onReceiveWalletCoins(address, _coins)
	{
		wallet.needUpdate = false;
		wallet.circulateCoins(_coins);

	}

	circulateCoins(_coins)
	{
		wallet.coins = _coins;
		for(var func of wallet.coinUpdateEvent)
		{
			func.call(wallet);
		}
	}


	loadData()
	{
		var dbName = this.user;
		this.walletDb = new Db('data/' + dbName + '/' + 'walletData.json', new WalletData());
		this.walletData = this.walletDb.read(WalletData);

	}


	saveData()
	{
		this.walletDb.write(this.walletData);

	}

	sendCoin(_targetAddress, _amount)
	{
		//if(this.needUpdate)
		//	return false;



		var tx = this.createTransactionFromWallet(_targetAddress, _amount);
		//console.log(tx.data);
		//console.log(tx.data.inputs);
		if(tx)
		{
			this.node.triggerEvent(null, "sendTransactionFromWallet", tx);
			this.updateWalletCoins();
			this.needUpdate = true;
		}
		return true;
	}

	test_createTransactionFromWallet(_targetAddress, _amount, coins)
	{
		var data = {inputs: [], outputs: [] };

		var selectedUTXO = [];
		var coinSum = 0;
		var loopStop = false;
		var firstAddress ; // 지갑주소
		for(var address in coins)
		{
			if(!firstAddress)
				firstAddress = address;

			var len = coins[address].length;
			//console.log("leng conut " + len);
			var nowIndex = this.lastUsedCoinID;
			for(var iterCount = 0; iterCount < len; iterCount++)
			{
				nowIndex ++;
				if(nowIndex >= len)
				{
					nowIndex = 0;
				}
				coinSum += coins[address][nowIndex].amount;
				selectedUTXO.push({ transaction : coins[address][nowIndex].transaction, index : coins[address][nowIndex].index  });
				this.lastUsedCoinID = nowIndex;

				if(coinSum > _amount)
				{
					loopStop = true;
					break;
				}

			}
			if(loopStop)
				break;
		}

		if(coinSum <= _amount)
		{
			// 돈 부족.
			//console.log("waller  : nomnoey");
			return null;
		}

		var inputLen = selectedUTXO.length;

		for(var i = 0; i < inputLen; i ++)
		{
			var input = {address : firstAddress, transaction:selectedUTXO[i].transaction , index:selectedUTXO[i].index};
			//var inputHash = CryptoUtil.hash({transaction: input.transaction,index: input.index, address: input.address});
			//intput.txiHash = inputHash;
			data.inputs.push(input);
		}

		data.outputs.push({amount:  _amount, address: _targetAddress}); // 대상한테 보낼 금액
		data.outputs.push({amount: coinSum - _amount, address: firstAddress}); // 잔액

		return new Transaction(CryptoUtil.randomId(64), "regular", data);
	}

	createTransactionFromWallet(_targetAddress, _amount)
	{
		var data = {inputs: [], outputs: [] };

		var selectedUTXO = [];
		var coinSum = 0;
		var loopStop = false;
		var firstAddress ; // 지갑주소
		for(var address in this.coins)
		{
			if(!firstAddress)
				firstAddress = address;

			var len = this.coins[address].length;
			//console.log("leng conut " + len);
			var nowIndex = this.lastUsedCoinID;
			for(var iterCount = 0; iterCount < len; iterCount++)
			{
				nowIndex ++;
				if(nowIndex >= len)
				{
					nowIndex = 0;
				}
				coinSum += this.coins[address][nowIndex].amount;
				selectedUTXO.push({ transaction : this.coins[address][nowIndex].transaction, index : this.coins[address][nowIndex].index  });
				this.lastUsedCoinID = nowIndex;

				if(coinSum > _amount)
				{
					loopStop = true;
					break;
				}

			}
			if(loopStop)
				break;
		}

		if(coinSum <= _amount)
		{
			// 돈 부족.
			//console.log("waller  : nomnoey");
			return null;
		}

		var inputLen = selectedUTXO.length;

		for(var i = 0; i < inputLen; i ++)
		{
			var input = {address : firstAddress, transaction:selectedUTXO[i].transaction , index:selectedUTXO[i].index};
			//var inputHash = CryptoUtil.hash({transaction: input.transaction,index: input.index, address: input.address});
			//intput.txiHash = inputHash;
			data.inputs.push(input);
		}

		data.outputs.push({amount:  _amount, address: _targetAddress}); // 대상한테 보낼 금액
		data.outputs.push({amount: coinSum - _amount, address: firstAddress}); // 잔액

		return new Transaction(CryptoUtil.randomId(64), "regular", data);
	}

	sendTransaction(_tx)
	{
		this.node.triggerEvent(null, "sendTransaction", _tx);
	}

	getAddress(_id)
	{
		return this.walletData.getAddressByIndex(_id);
	}

	getCoins()
	{
		var coinSum = 0;
		var address = this.getAddress(1);
		if(this.coins[address])
		{
			var len = this.coins[address].length;
			for(var i = 0; i < len; i++)
			{
				coinSum += this.coins[address][i].amount;
			}
		}
		return coinSum;
	}





}

module.exports = Wallet;
