import { stringify as yamlStringify } from 'yaml';

import { buildArtifact as coreBuildArtifact } from '@hyperlane-xyz/core/buildArtifact.js';
import { ChainAddresses } from '@hyperlane-xyz/registry';
import { DeployedCoreAddresses, MultiProvider } from '@hyperlane-xyz/sdk';
import {
  ChainMap,
  ChainName,
  ContractVerifier,
  CoreConfig,
  EvmCoreModule,
  ExplorerLicenseType,
  StarknetCoreModule,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, assert } from '@hyperlane-xyz/utils';

import { MINIMUM_CORE_DEPLOY_GAS } from '../consts.js';
import { requestAndSaveApiKeys } from '../context/context.js';
import { MultiProtocolSignerManager } from '../context/strategies/signer/MultiProtocolSignerManager.js';
import { WriteCommandContext } from '../context/types.js';
import { log, logBlue, logGray, logGreen } from '../logger.js';
import { runSingleChainSelectionStep } from '../utils/chains.js';
import { indentYamlOrJson } from '../utils/files.js';

import {
  completeDeploy,
  prepareDeploy,
  runDeployPlanStep,
  runPreflightChecksForChains,
} from './utils.js';

interface DeployParams {
  context: WriteCommandContext;
  chain: ChainName;
  config: CoreConfig;
}

interface EthereumDeployParams extends DeployParams {
  apiKeys: ChainMap<string>;
}

interface StarknetDeployParams {
  chain: ChainName;
  config: CoreConfig;
  multiProtocolSigner: MultiProtocolSignerManager | undefined;
  multiProvider: MultiProvider;
}

interface ApplyParams extends DeployParams {
  deployedCoreAddresses: DeployedCoreAddresses;
}

/**
 * Executes the core deploy command.
 */
export async function runCoreDeploy(params: DeployParams) {
  const { context, config } = params;
  let chain = params.chain;

  const {
    isDryRun,
    chainMetadata,
    dryRunChain,
    registry,
    skipConfirmation,
    multiProvider,
    multiProtocolSigner,
  } = context;

  if (dryRunChain) {
    chain = dryRunChain;
  } else if (!chain) {
    if (skipConfirmation) throw new Error('No chain provided');
    chain = await runSingleChainSelectionStep(
      chainMetadata,
      'Select chain to connect:',
    );
  }

  let apiKeys: ChainMap<string> = {};
  if (!skipConfirmation)
    apiKeys = await requestAndSaveApiKeys([chain], chainMetadata, registry);

  let deployedAddresses: ChainAddresses;
  switch (multiProvider.tryGetProtocol(chain)) {
    case ProtocolType.Ethereum:
      {
        const signer = multiProvider.getSigner(chain);
        deployedAddresses = await deployEthereumCore({
          context: { ...context, signer },
          chain,
          config,
          apiKeys,
        });
      }
      break;
    case ProtocolType.Starknet:
      {
        deployedAddresses = await deployStarknetCore({
          chain,
          config,
          multiProtocolSigner,
          multiProvider,
        });
      }
      break;
    default:
      throw new Error('Chain protocol is not supported yet!');
  }

  if (!isDryRun) {
    await registry.updateChain({
      chainName: chain,
      addresses: deployedAddresses,
    });
  }

  logGreen('✅ Core contract deployments complete:\n');
  log(indentYamlOrJson(yamlStringify(deployedAddresses, null, 2), 4));
}

export async function runCoreApply(params: ApplyParams) {
  const { context, chain, deployedCoreAddresses, config } = params;
  const { multiProvider } = context;
  const evmCoreModule = new EvmCoreModule(multiProvider, {
    chain,
    config,
    addresses: deployedCoreAddresses,
  });

  const transactions = await evmCoreModule.update(config);

  if (transactions.length) {
    logGray('Updating deployed core contracts');
    for (const transaction of transactions) {
      await multiProvider.sendTransaction(chain, transaction);
    }

    logGreen(`Core config updated on ${chain}.`);
  } else {
    logGreen(
      `Core config on ${chain} is the same as target. No updates needed.`,
    );
  }
}

async function deployEthereumCore({
  context,
  chain,
  config,
  apiKeys,
}: EthereumDeployParams): Promise<ChainAddresses> {
  const { multiProvider, signer } = context;

  await runDeployPlanStep({ context, chain });

  await runPreflightChecksForChains({
    context,
    chains: [chain],
    minGas: MINIMUM_CORE_DEPLOY_GAS,
  });

  const userAddress = await signer.getAddress();
  const initialBalances = await prepareDeploy(context, userAddress, [chain]);

  const contractVerifier = new ContractVerifier(
    multiProvider,
    apiKeys,
    coreBuildArtifact,
    ExplorerLicenseType.MIT,
  );

  logBlue('🚀 All systems ready, captain! Beginning deployment...');

  const evmCoreModule = await EvmCoreModule.create({
    chain,
    config,
    multiProvider,
    contractVerifier,
  });

  await completeDeploy(context, 'core', initialBalances, userAddress, [chain]);

  return evmCoreModule.serialize();
}

async function deployStarknetCore({
  chain,
  config,
  multiProtocolSigner,
  multiProvider,
}: StarknetDeployParams): Promise<ChainAddresses> {
  const domainId = multiProvider.getDomainId(chain);
  const signer = await multiProtocolSigner?.getStarknetSigner(chain);

  assert(signer, `No Starknet signer available for chain ${chain}`);

  const starknetCoreModule = new StarknetCoreModule(signer, domainId);
  return starknetCoreModule.deploy({
    chain,
    config,
  });
}
