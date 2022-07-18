import { Signer, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { TokenAccessControl, TokenAccessControlInterface } from "../TokenAccessControl";
export declare class TokenAccessControl__factory extends ContractFactory {
    constructor(signer?: Signer);
    deploy(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<TokenAccessControl>;
    getDeployTransaction(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): TransactionRequest;
    attach(address: string): TokenAccessControl;
    connect(signer: Signer): TokenAccessControl__factory;
    static readonly bytecode = "0x608060405234801561001057600080fd5b5061001a3361001f565b61006f565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b610cdc8061007e6000396000f3fe608060405234801561001057600080fd5b50600436106100db5760003560e01c806306ca0bad146100e0578063103ee2f5146100ea57806321afb5ee146101225780633424b8ce146101355780635c975abb146101485780635fc1964f14610155578063715018a61461016857806371e2a6571461017057806372be7ec3146101835780637a131ebe1461018b5780638da5cb5b1461019d5780639b198950146101bd578063c4722a4d146101d1578063cf8e629a146101e4578063f2fde38b146101ec578063f356c912146101ff578063f46eccc414610212575b600080fd5b6100e8610235565b005b61010d6100f8366004610a5b565b60026020526000908152604090205460ff1681565b60405190151581526020015b60405180910390f35b60035461010d9062010000900460ff1681565b6100e8610143366004610aea565b610304565b60035461010d9060ff1681565b6100e8610163366004610a7c565b6103a2565b6100e86104b8565b6100e861017e366004610a7c565b6104f3565b6100e86105fc565b60035461010d90610100900460ff1681565b6101a5610693565b6040516001600160a01b039091168152602001610119565b60035461010d906301000000900460ff1681565b6100e86101df366004610a7c565b6106a2565b6100e86107ad565b6100e86101fa366004610a5b565b610844565b6100e861020d366004610a7c565b6108e4565b61010d610220366004610a5b565b60016020526000908152604090205460ff1681565b3361023e610693565b6001600160a01b03161461026d5760405162461bcd60e51b815260040161026490610b56565b60405180910390fd5b60035462010000900460ff16156102c85760405162461bcd60e51b815260206004820152602b6024820152600080516020610c8783398151915260448201526a696e7420616e796d6f726560a81b6064820152608401610264565b6003805462ff00001916620100001790556040517fd498043d7ad0aae95bcd163cc21a9f809917f820b6eb2114164f7eb62af7627a90600090a1565b3361030d610693565b6001600160a01b0316146103335760405162461bcd60e51b815260040161026490610b56565b600354610100900460ff161561035b5760405162461bcd60e51b815260040161026490610b8b565b6003805460ff19168215159081179091556040519081527fef37df9624f797913e7585c7f7b5d004ba6704be3c64b0561c157728ccc869859060200160405180910390a150565b336103ab610693565b6001600160a01b0316146103d15760405162461bcd60e51b815260040161026490610b56565b60035462010000900460ff16156103fa5760405162461bcd60e51b815260040161026490610bd6565b60005b8181101561047a5760006001600085858581811061042b57634e487b7160e01b600052603260045260246000fd5b90506020020160208101906104409190610a5b565b6001600160a01b031681526020810191909152604001600020805460ff19169115159190911790558061047281610c5f565b9150506103fd565b507fa4bd966469c62332cc5041d465060dbc3e847c7b125422e59ddb3e61a2005ae782826040516104ac929190610b0a565b60405180910390a15050565b336104c1610693565b6001600160a01b0316146104e75760405162461bcd60e51b815260040161026490610b56565b6104f160006109ef565b565b336104fc610693565b6001600160a01b0316146105225760405162461bcd60e51b815260040161026490610b56565b60035462010000900460ff161561054b5760405162461bcd60e51b815260040161026490610bd6565b60005b818110156105ca57600180600085858581811061057b57634e487b7160e01b600052603260045260246000fd5b90506020020160208101906105909190610a5b565b6001600160a01b031681526020810191909152604001600020805460ff1916911515919091179055806105c281610c5f565b91505061054e565b507f6050e1d24499bf62f6297dc608356dc088c4e4b4fd753a8606207fdf078578e382826040516104ac929190610b0a565b33610605610693565b6001600160a01b03161461062b5760405162461bcd60e51b815260040161026490610b56565b600354610100900460ff16156106535760405162461bcd60e51b815260040161026490610b8b565b6003805460ff1961ff0019909116610100171690556040517f3f497821ce68d0936d5908ecb1360ef3c825e415f122cd465b3bab23d6a5bf7490600090a1565b6000546001600160a01b031690565b336106ab610693565b6001600160a01b0316146106d15760405162461bcd60e51b815260040161026490610b56565b6003546301000000900460ff16156106fb5760405162461bcd60e51b815260040161026490610c16565b60005b8181101561077b5760016002600085858581811061072c57634e487b7160e01b600052603260045260246000fd5b90506020020160208101906107419190610a5b565b6001600160a01b031681526020810191909152604001600020805460ff19169115159190911790558061077381610c5f565b9150506106fe565b507ff875362c4f1cfd50ea9685a61df0a1c19304428e6c289bf17208b0baa8b575d982826040516104ac929190610b0a565b336107b6610693565b6001600160a01b0316146107dc5760405162461bcd60e51b815260040161026490610b56565b6003546301000000900460ff16156108065760405162461bcd60e51b815260040161026490610c16565b6003805463ff000000191663010000001790556040517f2d35c8d348a345fd7b3b03b7cfcf7ad0b60c2d46742d5ca536342e4185becb0790600090a1565b3361084d610693565b6001600160a01b0316146108735760405162461bcd60e51b815260040161026490610b56565b6001600160a01b0381166108d85760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b6064820152608401610264565b6108e1816109ef565b50565b336108ed610693565b6001600160a01b0316146109135760405162461bcd60e51b815260040161026490610b56565b6003546301000000900460ff161561093d5760405162461bcd60e51b815260040161026490610c16565b60005b818110156109bd5760006002600085858581811061096e57634e487b7160e01b600052603260045260246000fd5b90506020020160208101906109839190610a5b565b6001600160a01b031681526020810191909152604001600020805460ff1916911515919091179055806109b581610c5f565b915050610940565b507f8e57ccca240b595c47024ae5107fe735c445b00720b01a618479f91709ee980382826040516104ac929190610b0a565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b80356001600160a01b0381168114610a5657600080fd5b919050565b600060208284031215610a6c578081fd5b610a7582610a3f565b9392505050565b60008060208385031215610a8e578081fd5b82356001600160401b0380821115610aa4578283fd5b818501915085601f830112610ab7578283fd5b813581811115610ac5578384fd5b8660208083028501011115610ad8578384fd5b60209290920196919550909350505050565b600060208284031215610afb578081fd5b81358015158114610a75578182fd5b60208082528181018390526000908460408401835b86811015610b4b576001600160a01b03610b3884610a3f565b1682529183019190830190600101610b1f565b509695505050505050565b6020808252818101527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604082015260600190565b6020808252602b908201527f416363657373436f6e74726f6c3a20436f6e747261637420697320756e70617560408201526a39b2b2103337b932bb32b960a91b606082015260800190565b6020808252603290820152600080516020610c87833981519152604082015271696e7420746f6b656e7320616e796d6f726560701b606082015260800190565b60208082526029908201527f416363657373436f6e74726f6c3a20416c6c6f776c69737420616c726561647960408201526808191a5cd8589b195960ba1b606082015260800190565b6000600019821415610c7f57634e487b7160e01b81526011600452602481fd5b506001019056fe416363657373436f6e74726f6c3a20436f6e74726163742063616e6e6f74206da2646970667358221220e18e4b5b86201e31786b247e7a97162af023207904c83f099930c6e6e7f464fc64736f6c63430008020033";
    static readonly abi: ({
        anonymous: boolean;
        inputs: {
            indexed: boolean;
            internalType: string;
            name: string;
            type: string;
        }[];
        name: string;
        type: string;
        outputs?: undefined;
        stateMutability?: undefined;
    } | {
        inputs: {
            internalType: string;
            name: string;
            type: string;
        }[];
        name: string;
        outputs: {
            internalType: string;
            name: string;
            type: string;
        }[];
        stateMutability: string;
        type: string;
        anonymous?: undefined;
    })[];
    static createInterface(): TokenAccessControlInterface;
    static connect(address: string, signerOrProvider: Signer | Provider): TokenAccessControl;
}
