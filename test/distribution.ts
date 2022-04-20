import { ethers } from 'hardhat'
const fs = require('fs')

import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised';

before(() => {
  chai.should();
  chai.use(chaiAsPromised);
});

const { expect } = chai

let treasury, ssvToken, merkleDistributor, distributionDataJSON
let doubleClaimAddress, noClaimAddress, addressData, addressDataNoClaim

describe('Distribution', function () {
  before(async function () {
    // Create treasury wallet
    [treasury] = await ethers.getSigners()
    // Get the JSON data from result.json in scripts folder
    distributionDataJSON = await JSON.parse(await fs.readFileSync(`./scripts/result.json`))
    // Initialize contracts
    const ssvTokenFactory = await ethers.getContractFactory('SSVToken')
    const merkleDistributorFactory = await ethers.getContractFactory('MerkleDistributor')
    // Deploy contracts
    ssvToken = await ssvTokenFactory.deploy()
    merkleDistributor = await merkleDistributorFactory.deploy(ssvToken.address, distributionDataJSON.merkleRoot, treasury.address)
    // Wait for contract deployment to finish
    await ssvToken.deployed()
    await merkleDistributor.deployed()
  })

  it('Claim all tokens', async function () {
    this.timeout(40000) // needed to exted the 20 second mocha timeout
    // Get rewards csv data from scripts folder and parse to JSON
    const distributionDataCSV = await fs.readFileSync(`./scripts/rewards.csv`)
    const linesCSV = distributionDataCSV.toString().split("\r")
    let distributionData = []
    const headers = linesCSV[0].split(",")
    for (let i = 1; i < linesCSV.length; i++) {
      let tempObj = {}
      const currentline = linesCSV[i].split(",")
      for (let j = 0; j < headers.length; j++) tempObj[headers[j]] = currentline[j]
      distributionData.push(tempObj)
    }
    let distributionDataObject = {}
    for (let i = 0; i < distributionData.length; i++) distributionDataObject[(distributionData[i].address.replace(/(\r\n|\n|\r)/gm, "")).toUpperCase()] = distributionData[i].amount
    // Mint tokens
    await ssvToken.mint(merkleDistributor.address, distributionDataJSON.tokenTotal)
    // Do a claim from all addresses except one and make sure the claimed wallet matches amount in csv file
    for (const address in distributionDataJSON.claims) {
      const addressData = distributionDataJSON.claims[address]
      if (addressData.index !== 3845) {
        if (addressData.index === 1) doubleClaimAddress = address
        await merkleDistributor.claim(addressData.index, address, addressData.amount, addressData.proof)
        expect(ethers.utils.formatEther(await ssvToken.balanceOf(address))).to.equal(String(distributionDataObject[address.toUpperCase()]))
      } else { noClaimAddress = address }
    }
    // Expect distribution contract to have certain amount of SSV left
    expect(ethers.utils.formatEther(await ssvToken.balanceOf(noClaimAddress))).to.equal('0.0')
    expect(ethers.utils.formatEther(await ssvToken.balanceOf(merkleDistributor.address))).to.equal('5963.632583')
  })

  it('Double Claim', async function () {
    // Try to claim from address that has already claimed
    addressData = distributionDataJSON.claims[doubleClaimAddress]
    await merkleDistributor.claim(addressData.index, doubleClaimAddress, addressData.amount, addressData.proof).should.be.rejectedWith('Drop already claimed.')
    expect(await merkleDistributor.isClaimed(3845)).to.equal(false)
    expect(await merkleDistributor.isClaimed(addressData.index)).to.equal(true)
  })

  it('Invalid Claims', async function () {
    addressDataNoClaim = distributionDataJSON.claims[noClaimAddress]
    // Invalid address
    await merkleDistributor.claim(addressDataNoClaim.index, treasury.address, addressDataNoClaim.amount, addressDataNoClaim.proof).should.be.rejectedWith('Invalid proof.')
    // Invalid amount
    await merkleDistributor.claim(addressDataNoClaim.index, noClaimAddress, addressData.amount, addressDataNoClaim.proof).should.be.rejectedWith('Invalid proof.')
    // Invalid proof
    await merkleDistributor.claim(addressDataNoClaim.index, noClaimAddress, addressDataNoClaim.amount, addressData.proof).should.be.rejectedWith('Invalid proof.')
  })

  it('Close Air Drop', async function () {
    // Close air drop and make sure remaining balance has transferred to the treasury and distribution contract is empty
    await merkleDistributor.connect(treasury).endAirdrop()
    expect(ethers.utils.formatEther(await ssvToken.balanceOf(treasury.address))).to.equal('5963.632583')
    expect(ethers.utils.formatEther(await ssvToken.balanceOf(merkleDistributor.address))).to.equal('0.0')
  })

  it('Claim After Air Drop Close', async function () {
    // Claim from account that did not claim yet after close
    await merkleDistributor.claim(addressDataNoClaim.index, noClaimAddress, addressDataNoClaim.amount, addressDataNoClaim.proof).should.be.rejectedWith('transfer amount exceeds balance')
    // Claim from account that did claim already after close
    await merkleDistributor.claim(addressData.index, doubleClaimAddress, addressData.amount, addressData.proof).should.be.rejectedWith('Drop already claimed.')
  })
})