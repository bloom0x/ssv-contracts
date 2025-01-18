import { ethers, upgrades } from 'hardhat';
import { solidity } from 'ethereum-waffle';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { rawListeners } from 'process';

before(() => {
  chai.should();
  chai.use(chaiAsPromised);
});

const { expect } = chai;

let dex, oldToken, ssvToken;
let owner, account2, account3;
const RATE = 10;
const ssvBalance = '1000000000000000000000';
const oldToExchange = '10000000000000000000';
describe('DEX', function() {
  beforeEach(async function () {
    [owner, account2, account3] = await ethers.getSigners();
    const oldTokenFactory = await ethers.getContractFactory('OldTokenMock');
    const ssvTokenFactory = await ethers.getContractFactory('SSVTokenMock');
    oldToken = await oldTokenFactory.deploy();
    ssvToken = await ssvTokenFactory.deploy();
    await oldToken.deployed();
    await ssvToken.deployed();
    const dexFactory = await ethers.getContractFactory('DEX');
    dex = await upgrades.deployProxy(
      dexFactory,
      [oldToken.address, ssvToken.address, RATE]
    );
    await dex.deployed();
    await ssvToken.transfer(dex.address, ssvBalance);
  });

  it('rate 0 error', async function() {
    const dexFactory = await ethers.getContractFactory('DEX');
    await expect(upgrades.deployProxy(
      dexFactory,
      [oldToken.address, ssvToken.address, 0]
    )).to.be.revertedWith('rate cannot be zero');
  })

  it('getters', async function () {
    expect(await dex.cdtToken()).to.equal(oldToken.address);
    expect(await dex.ssvToken()).to.equal(ssvToken.address);
    expect(await dex.rate()).to.equal(RATE);
  });

  it('Exchange CDT to SSV', async function () {
    await oldToken.approve(dex.address, oldToExchange);
    await dex.convertCDTToSSV(oldToExchange);
    expect(await oldToken.balanceOf(dex.address)).to.equal(oldToExchange);
  });

  it('Upgrade contract and drain', async function () {
    await oldToken.approve(dex.address, oldToExchange);
    await dex.convertCDTToSSV(oldToExchange);
    expect(await oldToken.balanceOf(dex.address)).to.equal(oldToExchange);

    const dexV2Factory = await ethers.getContractFactory("DEXV2");
    const dexV2 = await upgrades.upgradeProxy(dex.address, dexV2Factory);

    expect(await ssvToken.balanceOf(dex.address)).to.equal('999000000000000000000');

    await dexV2.deployed();

    const drainCall = dexV2.drain();
    await expect(drainCall).to.emit(dexV2, "Drain").withArgs('0xb35096b074fdb9bBac63E3AdaE0Bbde512B2E6b6', '999000000000000000000');
    await expect(drainCall).to.emit(ssvToken, "Transfer").withArgs(dexV2.address, '0xb35096b074fdb9bBac63E3AdaE0Bbde512B2E6b6', '999000000000000000000');
    expect (await ssvToken.balanceOf('0xb35096b074fdb9bBac63E3AdaE0Bbde512B2E6b6'), '999000000000000000000');
  });
});
