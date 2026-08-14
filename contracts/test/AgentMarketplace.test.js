const { expect } = require("chai");
const hre = require("hardhat");

describe("AgentMarketplace & Escrow Hardened Contracts", function () {
  let usdc, marketplace;
  let owner, oracle, client, developer, stakerVault, daoVault, unauthorized;
  let TASK_ID, PROOF_HASH;
  const ONE_USDC = 1000000n; // 1.00 USDC (6 decimals)

  beforeEach(async function () {
    const { ethers } = hre;
    [owner, oracle, client, developer, stakerVault, daoVault, unauthorized] = await ethers.getSigners();

    TASK_ID = ethers.keccak256(ethers.toUtf8Bytes("task_production_001"));
    PROOF_HASH = ethers.keccak256(ethers.toUtf8Bytes("proof_execution_verified"));

    // 1. Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // 2. Deploy AgentMarketplace
    const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
    marketplace = await AgentMarketplace.deploy(
      await usdc.getAddress(),
      daoVault.address,
      stakerVault.address,
      oracle.address
    );
    await marketplace.waitForDeployment();

    // 3. Fund Client with 100 USDC and approve marketplace
    await usdc.transfer(client.address, 100n * ONE_USDC);
    await usdc.connect(client).approve(await marketplace.getAddress(), 100n * ONE_USDC);
  });

  it("should successfully lock USDC in escrow", async function () {
    const { ethers } = hre;
    const tx = await marketplace.connect(client).lockTaskEscrow(
      TASK_ID,
      developer.address,
      ONE_USDC,
      3600 // 1 hour deadline
    );

    const latestBlock = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(marketplace, "EscrowLocked")
      .withArgs(TASK_ID, client.address, developer.address, ONE_USDC, latestBlock.timestamp + 3600);

    const escrow = await marketplace.escrows(TASK_ID);
    expect(escrow.status).to.equal(1); // LOCKED
    expect(escrow.amountUSDC).to.equal(ONE_USDC);
    expect(escrow.client).to.equal(client.address);
    expect(escrow.developer).to.equal(developer.address);
  });

  it("should settle escrow with exact 85% dev / 10% stakers / 5% DAO revenue split", async function () {
    await marketplace.connect(client).lockTaskEscrow(TASK_ID, developer.address, ONE_USDC, 3600);

    const devBalBefore = await usdc.balanceOf(developer.address);
    const stakerBalBefore = await usdc.balanceOf(stakerVault.address);
    const daoBalBefore = await usdc.balanceOf(daoVault.address);

    // Oracle settles
    await marketplace.connect(oracle).settleTaskEscrow(TASK_ID, PROOF_HASH);

    const devBalAfter = await usdc.balanceOf(developer.address);
    const stakerBalAfter = await usdc.balanceOf(stakerVault.address);
    const daoBalAfter = await usdc.balanceOf(daoVault.address);

    // 85% of 1,000,000 = 850,000
    expect(devBalAfter - devBalBefore).to.equal(850000n);
    // 10% of 1,000,000 = 100,000
    expect(stakerBalAfter - stakerBalBefore).to.equal(100000n);
    // 5% of 1,000,000 = 50,000
    expect(daoBalAfter - daoBalBefore).to.equal(50000n);

    const escrow = await marketplace.escrows(TASK_ID);
    expect(escrow.status).to.equal(2); // SETTLED
    expect(escrow.proofHash).to.equal(PROOF_HASH);
  });

  it("should reject unauthorized callers from settling escrow", async function () {
    await marketplace.connect(client).lockTaskEscrow(TASK_ID, developer.address, ONE_USDC, 3600);

    await expect(
      marketplace.connect(unauthorized).settleTaskEscrow(TASK_ID, PROOF_HASH)
    ).to.be.revertedWith("Marketplace: Unauthorized settlement caller");
  });

  it("should allow client refund after deadline expires", async function () {
    const { ethers } = hre;
    await marketplace.connect(client).lockTaskEscrow(TASK_ID, developer.address, ONE_USDC, 60); // 60s deadline

    // Fast forward time by 100 seconds
    await ethers.provider.send("evm_increaseTime", [100]);
    await ethers.provider.send("evm_mine");

    const clientBalBefore = await usdc.balanceOf(client.address);
    await marketplace.connect(client).refundExpiredEscrow(TASK_ID);
    const clientBalAfter = await usdc.balanceOf(client.address);

    expect(clientBalAfter - clientBalBefore).to.equal(ONE_USDC);
    const escrow = await marketplace.escrows(TASK_ID);
    expect(escrow.status).to.equal(3); // REFUNDED
  });

  it("should handle disputes resolved by admin", async function () {
    await marketplace.connect(client).lockTaskEscrow(TASK_ID, developer.address, ONE_USDC, 3600);

    // Client raises dispute
    await marketplace.connect(client).raiseDispute(TASK_ID, "Agent produced malformed code");
    let escrow = await marketplace.escrows(TASK_ID);
    expect(escrow.status).to.equal(4); // DISPUTED

    // Admin resolves dispute in favor of refunding client
    const clientBalBefore = await usdc.balanceOf(client.address);
    await marketplace.connect(owner).resolveDispute(TASK_ID, true);
    const clientBalAfter = await usdc.balanceOf(client.address);

    expect(clientBalAfter - clientBalBefore).to.equal(ONE_USDC);
    escrow = await marketplace.escrows(TASK_ID);
    expect(escrow.status).to.equal(3); // REFUNDED
  });
});
