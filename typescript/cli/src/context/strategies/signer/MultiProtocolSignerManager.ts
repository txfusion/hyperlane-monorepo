import { Signer } from 'ethers';
import { Account } from 'starknet';

import {
  ChainName,
  ChainSubmissionStrategy,
  MultiProtocolProvider,
  MultiProvider,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, assert } from '@hyperlane-xyz/utils';

import { ENV } from '../../../utils/env.js';

import {
  IMultiProtocolSigner,
  SignerConfig,
  TypedSigner,
} from './BaseMultiProtocolSigner.js';
import { MultiProtocolSignerFactory } from './MultiProtocolSignerFactory.js';

/**
 * @title MultiProtocolSignerManager
 * @dev Context manager for signers across multiple protocols
 */
export class MultiProtocolSignerManager {
  private signerStrategies: Map<ChainName, IMultiProtocolSigner> = new Map();
  private signers: Record<ChainName, TypedSigner> = {};

  constructor(
    submissionStrategy: ChainSubmissionStrategy,
    private chains: ChainName[],
    private multiProvider: MultiProvider,
    private multiProtocolProvider: MultiProtocolProvider,
    private key?: string,
  ) {
    // Initialize chain-specific strategies
    for (const chain of chains) {
      const strategy = MultiProtocolSignerFactory.getSignerStrategy(
        chain,
        submissionStrategy,
        multiProvider,
      );
      this.signerStrategies.set(chain, strategy);
    }
  }

  /**
   * @dev Gets signers config for specified chains
   */
  private async getSignersConfig(): Promise<
    Array<{ chain: ChainName } & SignerConfig>
  > {
    return Promise.all(
      this.chains.map((chain) => this.getSignerConfigForChain(chain)),
    );
  }

  /**
   * @dev Gets private key from strategy or environment fallback
   */
  private async getSignerConfigForChain(
    chain: ChainName,
  ): Promise<{ chain: ChainName } & SignerConfig> {
    const signerStrategy = this.signerStrategies.get(chain);
    if (!signerStrategy) {
      throw new Error(`No signer strategy found for chain ${chain}`);
    }

    const config: any = {};
    let stprovider: any;
    // Determine private key with clear precedence
    if (this.key) {
      config.privateKey = this.key;
    } else if (ENV.HYP_KEY) {
      config.privateKey = ENV.HYP_KEY;
    } else {
      const strategyConfig = await signerStrategy.getSignerConfig(chain);
      if (!strategyConfig?.privateKey) {
        throw new Error(`No private key found for chain ${chain}`);
      }
      config.privateKey = strategyConfig.privateKey;
      config.userAddress = strategyConfig.userAddress;
    }

    const { protocol } = this.multiProvider.getChainMetadata(chain);
    if (protocol === ProtocolType.Starknet) {
      const provider = this.multiProtocolProvider.getStarknetProvider(chain);
      assert(provider, 'No Starknet Provider found');
      stprovider = provider;
    }

    return {
      chain,
      ...(config as SignerConfig),
      extraParams: {
        provider: stprovider,
      },
    };
  }

  /**
   * @dev Gets protocol-specific signer for a chain
   */
  async getSigner(chain: ChainName): Promise<TypedSigner> {
    const { privateKey } = await this.getSignerConfigForChain(chain);

    const signerStrategy = this.signerStrategies.get(chain);
    if (!signerStrategy) {
      throw new Error(`No signer strategy found for chain ${chain}`);
    }
    return signerStrategy.getSigner({ privateKey });
  }

  protected async getSpecificSigner<T>(chain: ChainName): Promise<T> {
    const signerConfig = await this.getSignerConfigForChain(chain);

    const signerStrategy = this.signerStrategies.get(chain);
    if (!signerStrategy) {
      throw new Error(`No signer strategy found for chain ${chain}`);
    }
    return signerStrategy.getSigner(signerConfig) as T;
  }

  async getStarknetSigner(chain: ChainName): Promise<Account> {
    return this.getSpecificSigner<Account>(chain);
  }

  /**
   * @dev Gets signers for all specified chains
   */
  async getSigners(): Promise<Record<ChainName, TypedSigner>> {
    const signerConfigs = await this.getSignersConfig();

    for (const { chain, privateKey, userAddress } of signerConfigs) {
      const signerStrategy = this.signerStrategies.get(chain);
      if (signerStrategy) {
        const { protocol } = this.multiProvider.getChainMetadata(chain);
        if (protocol === ProtocolType.Starknet) {
          const provider =
            this.multiProtocolProvider?.getStarknetProvider(chain);
          this.signers[chain] = signerStrategy.getSigner({
            privateKey,
            userAddress,
            extraParams: { provider },
          });
        } else {
          this.signers[chain] = signerStrategy.getSigner({ privateKey });
        }
      }
    }

    return this.signers;
  }

  /**
   * @dev Configures signers for chains in MultiProvider
   */
  async attachSignersToMp(): Promise<MultiProvider> {
    for (const chain of this.chains) {
      // multiProvider is only compatible with evm chains
      if (
        this.multiProvider.getChainMetadata(chain).protocol ===
        ProtocolType.Ethereum
      ) {
        const signer = await this.getSigner(chain);
        if (signer instanceof Signer)
          // TODO: lets refactor this
          this.multiProvider.setSigner(chain, signer);
      }
    }

    return this.multiProvider;
  }
}
