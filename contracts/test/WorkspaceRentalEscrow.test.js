const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WorkspaceRentalEscrow Contract", function () {
  let usdcToken;
  let escrowContract;
  let owner;
  let treasury;
  let renter;
  let workspaceOwner;

  const INITIAL_BALANCE = ethers.parseUnits("10000", 6);
  const LEASE_AMOUNT = ethers.parseUnits("1000", 6); // $1000 USDC
  const LEASE_DURATION = 86400; // 24 Hours

  beforeEach(async function () {
    [owner, treasury, renter, workspaceOwner] = await ethers.getSigners();

    // Mock ERC20 Token for USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdcToken = await MockUSDC.deploy();
    await usdcToken.waitForDeployment();

    // Fund renter with USDC
    await usdcToken.transfer(renter.address, INITIAL_BALANCE);

    // Deploy Escrow Contract
    const EscrowFactory = await ethers.getContractFactory("WorkspaceRentalEscrow");
    escrowContract = await EscrowFactory.deploy(await usdcToken.getAddress(), treasury.address);
    await escrowContract.waitForDeployment();

    // Approve Escrow Contract
    await usdcToken.connect(renter).approve(await escrowContract.getAddress(), INITIAL_BALANCE);
  });

  it("Should correctly create workspace lease escrow lock", async function () {
    const leaseId = ethers.keccak256(ethers.toUtf8Bytes("lease-1"));
    const workspaceId = ethers.keccak256(ethers.toUtf8Bytes("ws-1"));

    await escrowContract.connect(renter).createLease(
      leaseId,
      workspaceId,
      workspaceOwner.address,
      LEASE_AMOUNT,
      LEASE_DURATION
    );

    const lease = await escrowContract.leases(leaseId);
    expect(lease.renter).to.equal(renter.address);
    expect(lease.owner).to.equal(workspaceOwner.address);
    expect(lease.totalAmountUSDC).to.equal(LEASE_AMOUNT);
  });

  it("Should settle 98% to workspace owner and 2% to treasury upon completion", async function () {
    const leaseId = ethers.keccak256(ethers.toUtf8Bytes("lease-complete"));
    const workspaceId = ethers.keccak256(ethers.toUtf8Bytes("ws-1"));

    await escrowContract.connect(renter).createLease(
      leaseId,
      workspaceId,
      workspaceOwner.address,
      LEASE_AMOUNT,
      LEASE_DURATION
    );

    // Fast-forward time past duration
    await ethers.provider.send("evm_increaseTime", [LEASE_DURATION + 10]);
    await ethers.provider.send("evm_mine");

    await escrowContract.settleCompletedLease(leaseId);

    const ownerBalance = await usdcToken.balanceOf(workspaceOwner.address);
    const treasuryBalance = await usdcToken.balanceOf(treasury.address);

    // 98% = 980 USDC, 2% = 20 USDC
    expect(ownerBalance).to.equal(ethers.parseUnits("980", 6));
    expect(treasuryBalance).to.equal(ethers.parseUnits("20", 6));
  });

  it("Should correctly process early termination refund proportional to elapsed time", async function () {
    const leaseId = ethers.keccak256(ethers.toUtf8Bytes("lease-early"));
    const workspaceId = ethers.keccak256(ethers.toUtf8Bytes("ws-1"));

    await escrowContract.connect(renter).createLease(
      leaseId,
      workspaceId,
      workspaceOwner.address,
      LEASE_AMOUNT,
      LEASE_DURATION
    );

    // Fast-forward half duration (12 hours)
    await ethers.provider.send("evm_increaseTime", [43200]);
    await ethers.provider.send("evm_mine");

    await escrowContract.connect(renter).earlyTerminateRefund(leaseId);

    const renterBalance = await usdcToken.balanceOf(renter.address);
    expect(renterBalance).to.be.gt(ethers.parseUnits("9400", 6));
  });
});
