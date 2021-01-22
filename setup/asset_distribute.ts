import {BigNumber} from 'ethers';
import fs from 'fs-extra';
import hre from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import inquirer from 'inquirer';

const beep = (num: number) => {
  for (let i = 0; i < num; i++) {
    console.log('---------------------------------------------------------');
  }
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
//require('node-beep');

const readOnly = false;
const BATCH_SIZE = 50;

let totalGasUsed = BigNumber.from(0);

let promptCounter = 1;

const func: DeployFunction = async function () {
  const {ethers, getNamedAccounts, network} = hre;

  const gasPriceFromNode = await ethers.provider.getGasPrice();
  let gasPrice = gasPriceFromNode;
  if (hre.network.name === 'mainnet') {
    gasPrice = BigNumber.from('56000000000'); // TODO allow it to be passed as parameter to the script
  }
  console.log({
    gasPriceFromNode: gasPriceFromNode.toString(),
    gasPrice: gasPrice.toString(),
  });

  const transfer_executed_file = `tmp/transfer_executed_${network.name}.json`;
  const {deployer} = await getNamedAccounts();
  const DeployerBatch = await ethers.getContract('DeployerBatch', deployer);

  const Asset = await ethers.getContract('Asset');

  let toContracts: Record<string, string> = {};

  const {transfers} = JSON.parse(
    fs.readFileSync('tmp/asset_regenerations.json').toString()
  );
  let transferExecuted: Record<number, {hash: string; nonce: number}>;
  try {
    transferExecuted = JSON.parse(
      fs.readFileSync(transfer_executed_file).toString()
    );
  } catch (e) {
    transferExecuted = {};
  }
  function saveTransfersTransaction(
    transfers: number[],
    tx: {hash: string; nonce: number}
  ) {
    if (network.name === 'hardhat') {
      return;
    }
    for (const index of transfers) {
      transferExecuted[index] = {hash: tx.hash, nonce: tx.nonce};
    }
    fs.writeFileSync(
      transfer_executed_file,
      JSON.stringify(transferExecuted, null, '  ')
    );
  }

  // fetch contract address from file if any
  try {
    toContracts = JSON.parse(
      fs
        // .readFileSync(`tmp/asset_owner_contracts_mainnet.json`)
        .readFileSync(`tmp/asset_owner_contracts_${network.name}.json`)
        .toString()
    );
  } catch (e) {
    //
  }

  type Transfer = {
    index: number;
    to: string;
    ids: string[];
    values: string[];
  };

  console.log({transfers: transfers.length});

  const suppliesRequired: Record<string, number> = {};
  for (const transfer of transfers) {
    const {ids, values} = transfer;
    for (let i = 0; i < ids.length; i++) {
      if (!suppliesRequired[ids[i]]) {
        suppliesRequired[ids[i]] = 0;
      }
      suppliesRequired[ids[i]] += BigNumber.from(values[i]).toNumber();
    }
  }

  // for (const tokenId of Object.keys(suppliesRequired)) {
  //   const supplyRequired = suppliesRequired[tokenId];
  //   const balance = await Asset.callStatic['balanceOf(address,uint256)'](
  //     DeployerBatch.address,
  //     tokenId
  //   );
  //   if (balance.toNumber() < supplyRequired) {
  //     console.log(
  //       `not enough balance for ${tokenId}: ${balance.toNumber()} vs ${supplyRequired} (required)`
  //     );
  //   }
  // }

  const batches: Transfer[][] = [];

  let currentBatch: Transfer[] = [];
  let index = 0;
  for (const transfer of transfers) {
    if (currentBatch.length >= BATCH_SIZE) {
      batches.push(currentBatch);
      currentBatch = [];
    }
    const {to, ids, values} = transfer;
    const performed = transferExecuted[index];

    let recordedContract = toContracts[to];
    if (!recordedContract) {
      // console.log(`${index}: checking contract. ${to}..`);
      const codeAtTo = await ethers.provider.getCode(to);
      if (codeAtTo !== '0x') {
        recordedContract = 'yes';
      } else {
        recordedContract = 'no';
      }
      toContracts[to] = recordedContract;

      console.log(index);
    }

    const toIsContract = recordedContract === 'yes';

    if (toIsContract) {
      console.log(`contract at ${to}`);
    } else if (!performed) {
      currentBatch.push({
        index,
        to,
        ids,
        values,
      });
    } else {
      console.log(
        `already being transfered in batch (${performed.hash})  nonce :${performed.nonce}`
      );
    }
    index++;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  for (const batch of batches) {
    const datas = [];
    console.log();
    for (const transfer of batch) {
      const {to, ids, values} = transfer;
      // console.log(JSON.stringify(transfer));
      // console.log({
      //   creator,
      //   packID,
      //   ipfsHash,
      //   supplies,
      //   raritiesPack,
      // });
      const {data} = await Asset.populateTransaction[
        'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)'
      ](DeployerBatch.address, to, ids, values, '0x');
      datas.push(data);
    }
    if (!readOnly) {
      try {
        const tx = await DeployerBatch.singleTargetAtomicBatch(
          Asset.address,
          datas,
          {gasPrice}
        );
        saveTransfersTransaction(
          batch.map((b) => b.index),
          tx
        );
        console.log(`transfers`, {
          tx: tx.hash,
        });
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed;
        totalGasUsed = totalGasUsed.add(gasUsed);
        console.log({
          gasUsed: gasUsed.toString(),
          totalGasUsed: totalGasUsed.toString(),
        });
      } catch (e) {
        console.error(e);
        console.error(JSON.stringify(batch));
      }

      console.log(batch[batch.length - 1].index);
      promptCounter--;
      if (promptCounter <= 0) {
        beep(3);
        // const answers = await inquirer.prompt([
        //   {type: 'confirm', name: 'continue', message: 'continue?'},
        // ]);
        // if (answers.continue) {
        //  promptCounter = 1;
        //   console.log('continuing...');
        // } else {
        //   console.log('stoping...');
        //   process.exit(0);
        // }
        const answers = await inquirer.prompt([
          {type: 'number', name: 'continue', message: 'continue?', default: 1},
        ]);
        if (answers.continue > 0) {
          promptCounter = answers.continue;
          console.log('continuing...');
        } else {
          console.log('stoping...');
          process.exit(0);
        }
      }
    } else {
      console.log(batch[batch.length - 1].index);
      console.log(`transfer`, datas.length);
    }
  }

  const contractsToCheck = [];
  for (const contractAddress of Object.keys(toContracts)) {
    const isContract = toContracts[contractAddress] === 'yes';
    if (isContract) {
      contractsToCheck.push(contractAddress);
    }
  }
  console.log({contractsToCheck});
};
export default func;

if (require.main === module) {
  func(hre);
}
