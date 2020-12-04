// const {ethers, getNamedAccounts, ethereum} = require('@nomiclabs/buidler');
const {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts,
} = require('hardhat');
const {supplyAssets} = require('./assets');
const {expectEventWithArgs} = require('../utils');
const erc721Tests = require('../erc721')(
  async () => {
    const {gameTokenAdmin} = await getNamedAccounts();
    const others = await getUnnamedAccounts();
    await deployments.fixture();

    const contract = await ethers.getContract('GameToken');
    const assetContract = await ethers.getContract('Asset');

    const gameAsAdmin = await contract.connect(
      ethers.provider.getSigner(gameTokenAdmin)
    );

    await gameAsAdmin.setGameManager(others[11]);

    async function mint(to) {
      const assetReceipt = await supplyAssets(to, to, 1);
      const transferEvent = await expectEventWithArgs(
        assetContract,
        assetReceipt,
        'Transfer'
      );
      const assetId = transferEvent.args[2];
      const gameAsGameManager = await contract.connect(
        ethers.provider.getSigner(others[11])
      );

      const receipt = await gameAsGameManager.createGame(
        to,
        to,
        [assetId],
        [1],
        [],
        'My GAME token URI!',
        454
      );
      const gameTransferEvent = await expectEventWithArgs(
        contract,
        receipt,
        'Transfer'
      );
      const gameId = gameTransferEvent.args[2].toString();
      return {receipt, gameId};
    }
    return {contractAddress: contract.address, users: others, mint};
  },
  {
    batchTransfer: true,
    burn: true,
    mandatoryERC721Receiver: true,
  }
);

function recurse(test) {
  if (test.subTests) {
    // eslint-disable-next-line mocha/no-setup-in-describe
    describe(test.title, function () {
      // eslint-disable-next-line mocha/no-setup-in-describe
      for (const subTest of test.subTests) {
        // eslint-disable-next-line mocha/no-setup-in-describe
        recurse(subTest);
      }
    });
  } else {
    it(test.title, test.test);
  }
}

describe('GameToken:ERC721', function () {
  for (const test of erc721Tests) {
    // eslint-disable-next-line mocha/no-setup-in-describe
    recurse(test);
  }
});
