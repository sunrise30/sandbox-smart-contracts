import {getLandSales, LandSale} from '../../data/landSales/getLandSales';
import deadlines from '../../data/landSales/deadlines';
import fs from 'fs';
import helpers, {SaltedSaleLandInfo} from '../../lib/merkleTreeHelper';
const {calculateLandHash} = helpers;

const LANDSALE_PREFIX = 'LandPreSale_5';

import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, read, execute, catchUnknownSigner} = deployments;
  const {
    deployer,
    landSaleBeneficiary,
    backendReferralWallet,
    landSaleFeeRecipient,
    landSaleAdmin,
  } = await getNamedAccounts();

  const sandContract = await deployments.get('Sand');
  const landContract = await deployments.get('Land');
  const assetContract = await deployments.get('Asset');

  async function deployLandSale(landSale: LandSale) {
    const {lands, merkleRootHash, saltedLands, tree, sector} = landSale;

    const landSaleName = `${LANDSALE_PREFIX}_${sector}`;
    const deadline = deadlines[sector];

    if (!deadline) {
      throw new Error(`no deadline for sector ${sector}`);
    }

    const landSaleDeployment = await deploy(landSaleName, {
      from: deployer,
      linkedData: lands,
      contract: 'EstateSaleWithFee',
      args: [
        landContract.address,
        sandContract.address,
        sandContract.address,
        deployer,
        landSaleBeneficiary,
        merkleRootHash,
        deadline,
        backendReferralWallet,
        2000,
        '0x0000000000000000000000000000000000000000',
        assetContract.address,
        landSaleFeeRecipient,
      ],
      skipIfAlreadyDeployed: true,
      log: true,
    });

    if (hre.network.name !== 'hardat') {
      const landsWithProof: (SaltedSaleLandInfo & {proof: string[]})[] = [];
      for (const land of saltedLands) {
        const proof = tree.getProof(calculateLandHash(land));
        landsWithProof.push({...land, proof});
      }
      fs.writeFileSync(
        `./.proofs_${landSaleName}_${hre.network.name}.json`,
        JSON.stringify(landsWithProof, null, '  ')
      );
    }

    const isMinter = await read('Land', 'isMinter', landSaleDeployment.address);
    if (!isMinter) {
      const currentLandAdmin = await read('Land', 'getAdmin');
      await catchUnknownSigner(
        execute(
          'Land',
          {from: currentLandAdmin, log: true},
          'setMinter',
          landSaleDeployment.address,
          true
        )
      );
    }

    const currentAdmin = await read(landSaleName, 'getAdmin');
    if (currentAdmin.toLowerCase() !== landSaleAdmin.toLowerCase()) {
      await catchUnknownSigner(
        execute(
          landSaleName,
          {from: currentAdmin, log: true},
          'changeAdmin',
          landSaleAdmin
        )
      );
    }

    const isSandSuperOperator = await read(
      'Sand',
      'isSuperOperator',
      landSaleDeployment.address
    );
    if (!isSandSuperOperator) {
      const currentSandAdmin = await read('Sand', 'getAdmin');
      await catchUnknownSigner(
        execute(
          'Sand',
          {from: currentSandAdmin, log: true},
          'setSuperOperator',
          landSaleDeployment.address,
          true
        )
      );
    }
  }

  const landSales = await getLandSales(
    'LandPreSale_5',
    hre.network.name,
    hre.network.live
  );

  for (const landSale of landSales) {
    await deployLandSale(landSale);
  }
};

export default func;
func.tags = ['LandPreSale_5', 'LandPreSale_5_deploy'];
func.dependencies = ['Sand_deploy', 'Land_deploy', 'Asset_deploy'];
func.skip = async (hre) => hre.network.name !== 'hardhat'; // TODO enable
