import { ApiNetworkProvider } from "@multiversx/sdk-network-providers";
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";
import { AbiRegistry } from "@multiversx/sdk-core";
import { promises } from "fs";
import { Transaction, Address } from "@multiversx/sdk-core";
import { UserSigner } from "@multiversx/sdk-wallet";
import { TransactionComputer, SmartContractTransactionsFactory, TransactionsFactoryConfig } from "@multiversx/sdk-core";
import { Account } from "@multiversx/sdk-core";
import { U32Value } from "@multiversx/sdk-core";
import { QueryRunnerAdapter, SmartContractQueriesController } from "@multiversx/sdk-core";

const apiNetworkProvider = new ApiNetworkProvider("https://devnet-api.multiversx.com");

const proxyNetworkProvider = new ProxyNetworkProvider("https://devnet-gateway.multiversx.com");

async function loadAbiFile() {
    let abiJson = await promises.readFile("../adder/output/adder.abi.json", { encoding: "utf8" });
    let abiObj = JSON.parse(abiJson);
    let abi = AbiRegistry.create(abiObj);
    return abi;
}



async function loadWallet(): Promise<UserSigner> {
    const pemText = await promises.readFile("../../wallet/wallet.pem", { encoding: "utf8" });
    let signer = UserSigner.fromPem(pemText);
    return signer;
}

async function createTransaction(signer : UserSigner, abi: AbiRegistry): Promise<Transaction> {
    const factoryConfig = new TransactionsFactoryConfig({ chainID: "D" });

    let factory = new SmartContractTransactionsFactory({
        config: factoryConfig,
        abi: abi
    });
    let args = [42];
    const tx = factory.createTransactionForExecute({
        sender: signer.getAddress(),
        contract: Address.fromBech32("erd1qqqqqqqqqqqqqpgq63dm76elxtcpa3vwz3etlaevlgpzj4n5u3yqr0jzfd"),
        function: "add",
        gasLimit: 5000000n,
        arguments: args
    });

    const myAccount = new Account(signer.getAddress());
    const myAccountOnNetwork = await apiNetworkProvider.getAccount(signer.getAddress());
    myAccount.update(myAccountOnNetwork);
    
    tx.nonce = BigInt(myAccount.getNonceThenIncrement().valueOf())
    
    console.log(myAccount.nonce);
    return tx;
}

async function main() {
    let abi = await loadAbiFile();
    //console.log(abi.getEndpoints());
    let signer: UserSigner = await loadWallet();
    //console.log(signer.getAddress().bech32()
    let tx = await createTransaction(signer, abi);
    

    const computer = new TransactionComputer();
    const serializedTx = computer.computeBytesForSigning(tx);

    tx.signature = await signer.sign(serializedTx);

    const txHash = await apiNetworkProvider.sendTransaction(tx);
    console.log("TX hash:", txHash);

    const queryRunner = new QueryRunnerAdapter({
        networkProvider: apiNetworkProvider
    });
    
    let controller = new SmartContractQueriesController({
        queryRunner: queryRunner,
        abi: abi
    });

    const query = controller.createQuery({
        contract: "erd1qqqqqqqqqqqqqpgq63dm76elxtcpa3vwz3etlaevlgpzj4n5u3yqr0jzfd",
        function: "getSum",
        arguments: [],
    });

    const response = await controller.runQuery(query);
    console.log("getSum query response:" + controller.parseQueryResponse(response));
}

main()