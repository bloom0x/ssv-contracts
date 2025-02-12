import { ethers, upgrades } from 'hardhat';

async function main() {
  // ethers is avaialble in the global scope
  const [deployer] = await ethers.getSigners();
  console.log(
    'Deploying the contracts with the account:',
    await deployer.getAddress()
  );

  console.log('Account balance:', (await deployer.getBalance()).toString());

  const ContractFactory = await ethers.getContractFactory('DEXV2');
  const contract = await upgrades.upgradeProxy(
    process.env.DEX_ADDRESS,
    ContractFactory
  );
  await contract.deployed();

  console.log('DEX contract address:', contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });