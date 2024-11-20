import { password } from '@inquirer/prompts';
import { Signer, Wallet } from 'ethers';
import { Account } from 'starknet';

import {
  ChainName,
  ChainSubmissionStrategy,
  ChainTechnicalStack,
  MultiProvider,
  TxSubmitterType,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, assert } from '@hyperlane-xyz/utils';

import {
  BaseMultiProtocolSigner,
  IMultiProtocolSigner,
  SignerConfig,
} from './BaseMultiProtocolSigner.js';

export class MultiProtocolSignerFactory {
  static getSignerStrategy(
    chain: ChainName,
    strategyConfig: ChainSubmissionStrategy,
    multiProvider: MultiProvider,
  ): IMultiProtocolSigner {
    const { protocol, technicalStack } = multiProvider.getChainMetadata(chain);

    switch (protocol) {
      case ProtocolType.Ethereum:
        if (technicalStack === ChainTechnicalStack.ZkSync)
          return new ZKSyncSignerStrategy(strategyConfig);
        return new EthereumSignerStrategy(strategyConfig);
      case ProtocolType.Starknet:
        return new StarknetSignerStrategy(strategyConfig);
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }
}

class EthereumSignerStrategy extends BaseMultiProtocolSigner {
  async getSignerConfig(chain: ChainName): Promise<SignerConfig> {
    const submitter = this.config[chain]?.submitter as {
      type: TxSubmitterType.JSON_RPC;
      privateKey?: string;
    };

    const privateKey =
      submitter?.privateKey ??
      (await password({
        message: `Please enter the private key for chain ${chain}`,
      }));

    return { privateKey };
  }

  getSigner(config: SignerConfig): Signer {
    return new Wallet(config.privateKey);
  }
}

// 99% overlap with EthereumSignerStrategy for the sake of keeping MultiProtocolSignerFactory clean
// TODO: import ZKSync signer
class ZKSyncSignerStrategy extends BaseMultiProtocolSigner {
  async getSignerConfig(chain: ChainName): Promise<SignerConfig> {
    const submitter = this.config[chain]?.submitter as {
      privateKey?: string;
    };

    const privateKey =
      submitter?.privateKey ??
      (await password({
        message: `Please enter the private key for chain ${chain}`,
      }));

    return { privateKey };
  }

  getSigner(config: SignerConfig): Signer {
    return new Wallet(config.privateKey);
  }
}

class StarknetSignerStrategy extends BaseMultiProtocolSigner {
  async getSignerConfig(chain: ChainName): Promise<SignerConfig> {
    const submitter = this.config[chain]?.submitter as {
      privateKey?: string;
      userAddress?: string;
    };

    const privateKey =
      submitter?.privateKey ??
      (await password({
        message: `Please enter the private key for chain ${chain}`,
      }));

    const userAddress =
      submitter?.userAddress ??
      (await password({
        message: `Please enter the signer address for chain ${chain}`,
      }));

    return { privateKey, userAddress };
  }

  getSigner({ privateKey, userAddress, extraParams }: SignerConfig): Account {
    assert(userAddress && extraParams, 'Missing arguments');
    return new Account(extraParams.provider, userAddress, privateKey);
  }
}
