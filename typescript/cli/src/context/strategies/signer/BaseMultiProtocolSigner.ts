import { Signer } from 'ethers';
import { Account } from 'starknet';

import { ChainSubmissionStrategy } from '@hyperlane-xyz/sdk';
import { ChainName } from '@hyperlane-xyz/sdk';

export type TypedSigner = Signer | Account;

export interface SignerConfig {
  privateKey: string;
  userAddress?: string; // For chains like StarkNet that require address
  extraParams?: Record<string, any>; // For any additional chain-specific params
}

export interface IMultiProtocolSigner {
  getSignerConfig(chain: ChainName): Promise<SignerConfig> | SignerConfig;
  getSigner(config: SignerConfig): TypedSigner;
}

export abstract class BaseMultiProtocolSigner implements IMultiProtocolSigner {
  constructor(protected config: ChainSubmissionStrategy) {}

  abstract getSignerConfig(chain: ChainName): Promise<SignerConfig>;
  abstract getSigner(config: SignerConfig): TypedSigner;
}
