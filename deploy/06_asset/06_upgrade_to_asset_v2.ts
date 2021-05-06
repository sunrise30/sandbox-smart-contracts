import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {skipUnlessTest} from '../../utils/network';

const func: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const {deployments, getNamedAccounts} = hre;
  const {
    assetBouncerAdmin,
    assetAdmin,
    upgradeAdmin,
  } = await getNamedAccounts();
  const {deploy} = deployments;

  const forwarder = await deployments.get('TestMetaTxForwarder');

  await deploy('Asset', {
    from: upgradeAdmin,
    contract: 'AssetV2',
    args: [forwarder.address, assetAdmin, assetBouncerAdmin],
    proxy: {
      owner: upgradeAdmin,
      proxyContract: 'OpenZeppelinTransparentProxy',
      methodName: 'initV2',
      upgradeIndex: 1,
    },
    log: true,
  });

  console.log('Asset upgraded to AssetV2');
};

export default func;
func.tags = ['AssetV2', 'AssetV2_deploy'];
func.runAtTheEnd = true;
func.dependencies = [
  'Asset_deploy',
  'Asset_setup',
  'AssetMinter_deploy',
  'TestMetaTxForwarder_deploy',
  'GameToken_setup',
];
func.skip = skipUnlessTest;
