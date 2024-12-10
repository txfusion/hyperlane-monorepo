import {
  ChainMap,
  ChainName,
  DeployedCoreAddresses,
  DeployedCoreAddressesSchema,
  EvmCoreModule,
} from '@hyperlane-xyz/sdk';
import { assert } from '@hyperlane-xyz/utils';

import { DEFAULT_WARP_ROUTE_DEPLOYMENT_CONFIG_PATH } from '../../../commands/options.js';
import { readCoreDeployConfigs } from '../../../config/core.js';
import { readChainSubmissionStrategyConfig } from '../../../config/strategy.js';
import { log } from '../../../logger.js';
import {
  extractChainsFromObj,
  runMultiChainSelectionStep,
  runSingleChainSelectionStep,
} from '../../../utils/chains.js';
import {
  isFile,
  readYamlOrJson,
  runFileSelectionStep,
} from '../../../utils/files.js';
import { getWarpCoreConfigOrExit } from '../../../utils/warp.js';

import { ChainResolver } from './types.js';

enum ChainSelectionMode {
  ORIGIN_DESTINATION,
  AGENT_KURTOSIS,
  WARP_CONFIG,
  WARP_READ,
  STRATEGY,
  RELAYER,
  CORE_APPLY,
}

// This class could be broken down into multiple strategies

/**
 * @title MultiChainResolver
 * @notice Resolves chains based on the specified selection mode.
 */
export class MultiChainResolver implements ChainResolver {
  constructor(private mode: ChainSelectionMode) {}

  async resolveChains(argv: ChainMap<any>): Promise<ChainName[]> {
    switch (this.mode) {
      case ChainSelectionMode.WARP_CONFIG:
        return this.resolveWarpRouteConfigChains(argv);
      case ChainSelectionMode.WARP_READ:
        return this.resolveWarpCoreConfigChains(argv);
      case ChainSelectionMode.AGENT_KURTOSIS:
        return this.resolveAgentChains(argv);
      case ChainSelectionMode.STRATEGY:
        return this.resolveStrategyChains(argv);
      case ChainSelectionMode.RELAYER:
        return this.resolveRelayerChains(argv);
      case ChainSelectionMode.CORE_APPLY:
        return this.resolveCoreApplyChains(argv);
      case ChainSelectionMode.ORIGIN_DESTINATION:
      default:
        return this.resolveOriginDestinationChains(argv);
    }
  }

  private async resolveWarpRouteConfigChains(
    argv: Record<string, any>,
  ): Promise<ChainName[]> {
    argv.config ||= DEFAULT_WARP_ROUTE_DEPLOYMENT_CONFIG_PATH;
    argv.context.chains = await this.getWarpRouteConfigChains(
      argv.config.trim(),
      argv.skipConfirmation,
    );
    return argv.context.chains;
  }

  private async resolveWarpCoreConfigChains(
    argv: Record<string, any>,
  ): Promise<ChainName[]> {
    if (argv.symbol || argv.warp) {
      const warpCoreConfig = await getWarpCoreConfigOrExit({
        context: argv.context,
        warp: argv.warp,
        symbol: argv.symbol,
      });
      argv.context.warpCoreConfig = warpCoreConfig;
      const chains = extractChainsFromObj(warpCoreConfig);
      return chains;
    } else if (argv.chain) {
      return [argv.chain];
    } else {
      throw new Error(
        `Please specify either a symbol, chain and address or warp file`,
      );
    }
  }

  private async resolveAgentChains(
    argv: Record<string, any>,
  ): Promise<ChainName[]> {
    const { chainMetadata } = argv.context;
    argv.origin =
      argv.origin ??
      (await runSingleChainSelectionStep(
        chainMetadata,
        'Select the origin chain',
      ));

    if (!argv.targets) {
      const selectedRelayChains = await runMultiChainSelectionStep({
        chainMetadata: chainMetadata,
        message: 'Select chains to relay between',
        requireNumber: 2,
      });
      argv.targets = selectedRelayChains.join(',');
    }

    return [argv.origin, ...argv.targets];
  }

  private async resolveOriginDestinationChains(
    argv: Record<string, any>,
  ): Promise<ChainName[]> {
    const { chainMetadata } = argv.context;

    argv.origin =
      argv.origin ??
      (await runSingleChainSelectionStep(
        chainMetadata,
        'Select the origin chain',
      ));

    argv.destination =
      argv.destination ??
      (await runSingleChainSelectionStep(
        chainMetadata,
        'Select the destination chain',
      ));

    return [argv.origin, argv.destination];
  }

  private async resolveStrategyChains(
    argv: Record<string, any>,
  ): Promise<ChainName[]> {
    const strategy = await readChainSubmissionStrategyConfig(argv.strategy);
    return extractChainsFromObj(strategy);
  }

  private async resolveRelayerChains(
    argv: Record<string, any>,
  ): Promise<ChainName[]> {
    return argv.chains.split(',').map((item: string) => item.trim());
  }

  private async getWarpRouteConfigChains(
    configPath: string,
    skipConfirmation: boolean,
  ): Promise<ChainName[]> {
    if (!configPath || !isFile(configPath)) {
      assert(!skipConfirmation, 'Warp route deployment config is required');
      configPath = await runFileSelectionStep(
        './configs',
        'Warp route deployment config',
        'warp',
      );
    } else {
      log(`Using warp route deployment config at ${configPath}`);
    }

    // Alternative to readWarpRouteDeployConfig that doesn't use context for signer and zod validation
    const warpRouteConfig = (await readYamlOrJson(configPath)) as Record<
      string,
      any
    >;

    const chains = Object.keys(warpRouteConfig) as ChainName[];
    assert(
      chains.length !== 0,
      'No chains found in warp route deployment config',
    );

    return chains;
  }

  private async resolveCoreApplyChains(
    argv: Record<string, any>,
  ): Promise<ChainName[]> {
    try {
      const config = readCoreDeployConfigs(argv.config);

      if (!config?.interchainAccountRouter) {
        return [argv.chain];
      }

      const addresses = await argv.context.registry.getChainAddresses(
        argv.chain,
      );
      const coreAddresses = DeployedCoreAddressesSchema.parse(
        addresses,
      ) as DeployedCoreAddresses;

      const evmCoreModule = new EvmCoreModule(argv.context.multiProvider, {
        chain: argv.chain,
        config,
        addresses: coreAddresses,
      });

      const transactions = await evmCoreModule.update(config);

      return Array.from(new Set(transactions.map((tx) => tx.chainId))).map(
        (chainId) => argv.context.multiProvider.getChainName(chainId),
      );
    } catch (error) {
      throw new Error(`Failed to resolve core apply chains`, {
        cause: error,
      });
    }
  }

  static forAgentKurtosis(): MultiChainResolver {
    return new MultiChainResolver(ChainSelectionMode.AGENT_KURTOSIS);
  }

  static forOriginDestination(): MultiChainResolver {
    return new MultiChainResolver(ChainSelectionMode.ORIGIN_DESTINATION);
  }

  static forRelayer(): MultiChainResolver {
    return new MultiChainResolver(ChainSelectionMode.RELAYER);
  }

  static forStrategyConfig(): MultiChainResolver {
    return new MultiChainResolver(ChainSelectionMode.STRATEGY);
  }

  static forWarpRouteConfig(): MultiChainResolver {
    return new MultiChainResolver(ChainSelectionMode.WARP_CONFIG);
  }

  static forWarpCoreConfig(): MultiChainResolver {
    return new MultiChainResolver(ChainSelectionMode.WARP_READ);
  }

  static forCoreApply(): MultiChainResolver {
    return new MultiChainResolver(ChainSelectionMode.CORE_APPLY);
  }
}
