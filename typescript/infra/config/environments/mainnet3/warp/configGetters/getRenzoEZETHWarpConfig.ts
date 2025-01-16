import { parseEther } from 'ethers/lib/utils.js';

import { Mailbox__factory } from '@hyperlane-xyz/core';
import {
  ChainMap,
  ChainName,
  HookConfig,
  HookType,
  HypTokenRouterConfig,
  IsmType,
  MultisigConfig,
  TokenType,
  buildAggregationIsmConfigs,
} from '@hyperlane-xyz/sdk';
import { Address, assert, symmetricDifference } from '@hyperlane-xyz/utils';

import { getEnvironmentConfig } from '../../../../../scripts/core-utils.js';
import { getRegistry as getMainnet3Registry } from '../../chains.js';
import rawTokenPrices from '../../tokenPrices.json';

const tokenPrices: ChainMap<string> = rawTokenPrices;
const chainsToDeploy = [
  'arbitrum',
  'optimism',
  'base',
  'blast',
  'bsc',
  'mode',
  'linea',
  'ethereum',
  'fraxtal',
  'zircuit',
  'taiko',
  'sei',
  'swell',
];
export const MAX_PROTOCOL_FEE = parseEther('100').toString(); // Changing this will redeploy the PROTOCOL_FEE hook

export function getProtocolFee(chain: ChainName) {
  return (0.5 / Number(tokenPrices[chain])).toFixed(10).toString(); // ~$0.50 USD
}

export function getRenzoHook(
  defaultHook: Address,
  chain: ChainName,
): HookConfig {
  return {
    type: HookType.AGGREGATION,
    hooks: [
      defaultHook,
      {
        type: HookType.PROTOCOL_FEE,
        owner: ezEthSafes[chain],
        beneficiary: ezEthSafes[chain],
        protocolFee: parseEther(getProtocolFee(chain)).toString(),
        maxProtocolFee: MAX_PROTOCOL_FEE,
      },
    ],
  };
}

const lockboxChain = 'ethereum';
// over the default 100k to account for xerc20 gas + ISM overhead over the default ISM https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/49f41d9759fd515bfd89e6e22e799c41b27b4119/typescript/sdk/src/router/GasRouterDeployer.ts#L14
const warpRouteOverheadGas = 200_000;
const lockbox = '0xC8140dA31E6bCa19b287cC35531c2212763C2059';
const xERC20: Record<(typeof chainsToDeploy)[number], string> = {
  arbitrum: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  optimism: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  base: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  blast: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  bsc: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  mode: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  linea: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  ethereum: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  fraxtal: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  zircuit: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  taiko: '0x2416092f143378750bb29b79eD961ab195CcEea5',
  sei: '0x6DCfbF4729890043DFd34A93A2694E5303BA2703', // redEth
  swell: '0x2416092f143378750bb29b79eD961ab195CcEea5',
};

export const ezEthValidators: ChainMap<MultisigConfig> = {
  arbitrum: {
    threshold: 1,
    validators: [
      {
        address: '0x9bccfad3bd12ef0ee8ae839dd9ed7835bccadc9d',
        alias: 'Everclear',
      },
      { address: '0xc27032c6bbd48c20005f552af3aaa0dbf14260f3', alias: 'Renzo' },
    ],
  },
  optimism: {
    threshold: 1,
    validators: [
      {
        address: '0x6f4cb8e96db5d44422a4495faa73fffb9d30e9e2',
        alias: 'Everclear',
      },
      { address: '0xe2593d205f5e7f74a50fa900824501084e092ebd', alias: 'Renzo' },
    ],
  },
  base: {
    threshold: 1,
    validators: [
      { address: '0x25ba4ee5268cbfb8d69bac531aa10368778702bd', alias: 'Renzo' },
      {
        address: '0x9ec803b503e9c7d2611e231521ef3fde73f7a21c',
        alias: 'Everclear',
      },
    ],
  },
  blast: {
    threshold: 1,
    validators: [
      {
        address: '0x1652d8ba766821cf01aeea34306dfc1cab964a32',
        alias: 'Everclear',
      },
      { address: '0x54bb0036f777202371429e062fe6aee0d59442f9', alias: 'Renzo' },
    ],
  },
  bsc: {
    threshold: 1,
    validators: [
      { address: '0x3156db97a3b3e2dcc3d69fddfd3e12dc7c937b6d', alias: 'Renzo' },
      {
        address: '0x9a0326c43e4713ae2477f09e0f28ffedc24d8266',
        alias: 'Everclear',
      },
    ],
  },
  mode: {
    threshold: 1,
    validators: [
      {
        address: '0x456fbbe05484fc9f2f38ea09648424f54d6872be',
        alias: 'Everclear',
      },
      { address: '0x7e29608c6e5792bbf9128599ca309be0728af7b4', alias: 'Renzo' },
    ],
  },
  linea: {
    threshold: 1,
    validators: [
      {
        address: '0x06a5a2a429560034d38bf62ca6d470942535947e',
        alias: 'Everclear',
      },
      { address: '0xcb3e44edd2229860bdbaa58ba2c3817d111bee9a', alias: 'Renzo' },
    ],
  },
  ethereum: {
    threshold: 1,
    validators: [
      {
        address: '0x1fd889337f60986aa57166bc5ac121efd13e4fdd',
        alias: 'Everclear',
      },
      { address: '0xc7f7b94a6baf2fffa54dfe1dde6e5fcbb749e04f', alias: 'Renzo' },
    ],
  },
  fraxtal: {
    threshold: 1,
    validators: [
      {
        address: '0x25b3a88f7cfd3c9f7d7e32b295673a16a6ddbd91',
        alias: 'Luganodes',
      },
      { address: '0xe986f457965227a05dcf984c8d0c29e01253c44d', alias: 'Renzo' },
    ],
  },
  zircuit: {
    threshold: 1,
    validators: [
      { address: '0x1da9176c2ce5cc7115340496fa7d1800a98911ce', alias: 'Renzo' },
      {
        address: '0x7ac6584c068eb2a72d4db82a7b7cd5ab34044061',
        alias: 'Luganodes',
      },
    ],
  },
  taiko: {
    threshold: 1,
    validators: [
      {
        address: '0x2f007c82672f2bb97227d4e3f80ac481bfb40a2a',
        alias: 'Luganodes',
      },
      { address: '0xd4F6000d8e1108bd4998215d51d5dF559BdB43a1', alias: 'Renzo' },
    ],
  },
  sei: {
    threshold: 1,
    validators: [
      {
        address: '0x7a0f4a8672f603e0c12468551db03f3956d10910',
        alias: 'Luganodes',
      },
      { address: '0x952df7f0cb8611573a53dd7cbf29768871d9f8b0', alias: 'Renzo' },
    ],
  },
  swell: {
    threshold: 1,
    validators: [
      {
        address: '0x9eadf9217be22d9878e0e464727a2176d5c69ff8',
        alias: 'Luganodes',
      },
      { address: '0xb6b9b4bd4eb6eb3aef5e9826e7f8b8455947f67c', alias: 'Renzo' },
    ],
  },
};

export const ezEthSafes: Record<string, string> = {
  arbitrum: '0x0e60fd361fF5b90088e1782e6b21A7D177d462C5',
  optimism: '0x8410927C286A38883BC23721e640F31D3E3E79F8',
  base: '0x8410927C286A38883BC23721e640F31D3E3E79F8',
  blast: '0xda7dBF0DB81882372B598a715F86eD5254A01b0a',
  bsc: '0x0e60fd361fF5b90088e1782e6b21A7D177d462C5',
  mode: '0x7791eeA3484Ba4E5860B7a2293840767619c2B58',
  linea: '0xb7092685571B49786F1248c6205B5ac3A691c65E',
  ethereum: '0xD1e6626310fD54Eceb5b9a51dA2eC329D6D4B68A',
  fraxtal: '0x8410927C286A38883BC23721e640F31D3E3E79F8',
  zircuit: '0x8410927C286A38883BC23721e640F31D3E3E79F8',
  taiko: '0x8410927C286A38883BC23721e640F31D3E3E79F8',
  sei: '0x0e60fd361fF5b90088e1782e6b21A7D177d462C5',
  swell: '0x435E8c9652Da151292F3981bbf663EBEB6668501',
};

const existingProxyAdmins: ChainMap<{ address: string; owner: string }> = {
  arbitrum: {
    address: '0xdcB558d5C0F9A35C53Fa343c77eD0d346576e2Cf',
    owner: ezEthSafes.arbitrum,
  },
  optimism: {
    address: '0xa50910ae66Df6A5F8e85dac032FD45BC2b7be6fF',
    owner: ezEthSafes.optimism,
  },
  base: {
    address: '0xec1DdF05ff85D2B22B7d27E5b5E0B82961B7D889',
    owner: ezEthSafes.base,
  },
  blast: {
    address: '0xA26F8cE2E21A503bf9e18c213965d7BC14997F48',
    owner: ezEthSafes.blast,
  },
  bsc: {
    address: '0x486b39378f99f073A3043C6Aabe8666876A8F3C5',
    owner: ezEthSafes.bsc,
  },
  mode: {
    address: '0x2F78F22a1D7491500C9ED9352b8239fbAbcDd84E',
    owner: ezEthSafes.mode,
  },
  fraxtal: {
    address: '0x8bB69721B4E9b9df08bEdaeaA193008C7317Db59',
    owner: ezEthSafes.fraxtal,
  },
  linea: {
    address: '0x2F78F22a1D7491500C9ED9352b8239fbAbcDd84E',
    owner: ezEthSafes.linea,
  },
  ethereum: {
    address: '0x2F78F22a1D7491500C9ED9352b8239fbAbcDd84E',
    owner: ezEthSafes.ethereum,
  },
  zircuit: {
    address: '0xec1DdF05ff85D2B22B7d27E5b5E0B82961B7D889',
    owner: ezEthSafes.zircuit,
  },
  sei: {
    address: '0x33219fEF24C198d979F05d692a17507E41a0A73e',
    owner: ezEthSafes.sei,
  },
  taiko: {
    address: '0xA3666f8a327AADB666F1906A38B17937e5F11f92',
    owner: ezEthSafes.taiko,
  },
};

export const getRenzoEZETHWarpConfig = async (): Promise<
  ChainMap<HypTokenRouterConfig>
> => {
  const config = getEnvironmentConfig('mainnet3');
  const multiProvider = await config.getMultiProvider();
  const registry = await getMainnet3Registry();

  const validatorDiff = symmetricDifference(
    new Set(chainsToDeploy),
    new Set(Object.keys(ezEthValidators)),
  );
  const safeDiff = symmetricDifference(
    new Set(chainsToDeploy),
    new Set(Object.keys(ezEthSafes)),
  );
  const xERC20Diff = symmetricDifference(
    new Set(chainsToDeploy),
    new Set(Object.keys(xERC20)),
  );
  if (validatorDiff.size > 0) {
    throw new Error(
      `chainsToDeploy !== validatorConfig, diff is ${Array.from(
        validatorDiff,
      ).join(', ')}`,
    );
  }
  if (safeDiff.size > 0) {
    throw new Error(
      `chainsToDeploy !== safeDiff, diff is ${Array.from(safeDiff).join(', ')}`,
    );
  }
  if (xERC20Diff.size > 0) {
    throw new Error(
      `chainsToDeploy !== xERC20Diff, diff is ${Array.from(xERC20Diff).join(
        ', ',
      )}`,
    );
  }

  const tokenConfig = Object.fromEntries<HypTokenRouterConfig>(
    await Promise.all(
      chainsToDeploy.map(
        async (chain): Promise<[string, HypTokenRouterConfig]> => {
          const addresses = await registry.getChainAddresses(chain);
          assert(addresses, 'No addresses in Registry');
          const { mailbox } = addresses;

          const mailboxContract = Mailbox__factory.connect(
            mailbox,
            multiProvider.getProvider(chain),
          );
          const defaultHook = await mailboxContract.defaultHook();
          const ret: [string, HypTokenRouterConfig] = [
            chain,
            {
              isNft: false,
              type:
                chain === lockboxChain
                  ? TokenType.XERC20Lockbox
                  : TokenType.XERC20,
              token: chain === lockboxChain ? lockbox : xERC20[chain],
              owner: ezEthSafes[chain],
              gas: warpRouteOverheadGas,
              mailbox,
              interchainSecurityModule: {
                type: IsmType.AGGREGATION,
                threshold: 2,
                modules: [
                  {
                    type: IsmType.ROUTING,
                    owner: ezEthSafes[chain],
                    domains: buildAggregationIsmConfigs(
                      chain,
                      chainsToDeploy,
                      ezEthValidators,
                    ),
                  },
                  {
                    type: IsmType.FALLBACK_ROUTING,
                    domains: {},
                    owner: ezEthSafes[chain],
                  },
                ],
              },
              hook: getRenzoHook(defaultHook, chain),
              proxyAdmin: existingProxyAdmins[chain],
            },
          ];

          return ret;
        },
      ),
    ),
  );

  return tokenConfig;
};
