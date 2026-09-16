const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== AgentChain Polygon Amoy Deployment ===");

  const network = await hre.ethers.provider.getNetwork();
  console.log(`Connected network: ${network.name} (Chain ID: ${network.chainId})`);

  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error(
      "❌ No deployer account found! Please configure DEPLOYER_PRIVATE_KEY or PRIVATE_KEY in .env or shell environment."
    );
  }

  const deployer = signers[0];
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deployer balance: ${hre.ethers.formatEther(balance)} POL`);

  if (balance === 0n) {
    throw new Error(
      `❌ Insufficient funds on deployer account (${deployer.address}). ` +
      `Please fund this address with testnet POL from the Polygon Amoy Faucet (https://faucet.polygon.technology) before deploying.`
    );
  }

  // Official native Circle testnet USDC on Polygon Amoy (or custom override)
  const usdcAddress = process.env.USDC_ADDRESS || "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const daoVault = process.env.DAO_VAULT_ADDRESS || deployer.address;
  const stakerVault = process.env.STAKER_VAULT_ADDRESS || deployer.address;
  const oracleAddress = process.env.SETTLEMENT_ORACLE_ADDRESS || deployer.address;
  const treasuryVault = process.env.TREASURY_VAULT_ADDRESS || deployer.address;

  console.log("\nConfiguration:");
  console.log(`- USDC Address:     ${usdcAddress}`);
  console.log(`- DAO Vault:        ${daoVault}`);
  console.log(`- Staker Vault:     ${stakerVault}`);
  console.log(`- Settlement Oracle:${oracleAddress}`);
  console.log(`- Treasury Vault:   ${treasuryVault}`);

  // 1. Deploy AgentRegistry (or reuse if already deployed on Amoy)
  let registryAddress = process.env.AGENT_REGISTRY_ADDRESS || "0x8218bDB16D7E71d4F51D31D6F0e919C1302CD6d1";
  const regCode = await hre.ethers.provider.getCode(registryAddress);
  if (regCode && regCode.length > 2) {
    console.log(`ℹ️ Reusing verified deployed AgentRegistry at: ${registryAddress}`);
  } else {
    console.log("\n[1/3] Deploying AgentRegistry...");
    const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
    const registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();
    registryAddress = await registry.getAddress();
    console.log(`✅ AgentRegistry deployed at: ${registryAddress}`);
  }

  // 2. Deploy AgentMarketplace (or reuse if already deployed on Amoy)
  let marketplaceAddress = process.env.AGENT_MARKETPLACE_ADDRESS || "0x33b0709B52e782aB9576B6044132E65A3AF5206E";
  const marketCode = await hre.ethers.provider.getCode(marketplaceAddress);
  if (marketCode && marketCode.length > 2) {
    console.log(`ℹ️ Reusing verified deployed AgentMarketplace at: ${marketplaceAddress}`);
  } else {
    console.log("\n[2/3] Deploying AgentMarketplace...");
    const AgentMarketplace = await hre.ethers.getContractFactory("AgentMarketplace");
    const marketplace = await AgentMarketplace.deploy(
      usdcAddress,
      daoVault,
      stakerVault,
      oracleAddress
    );
    await marketplace.waitForDeployment();
    marketplaceAddress = await marketplace.getAddress();
    console.log(`✅ AgentMarketplace deployed at: ${marketplaceAddress}`);
  }

  // 3. Deploy WorkspaceRentalEscrow (Phase 6 container leasing)
  let rentalEscrowAddress = process.env.WORKSPACE_RENTAL_ESCROW_ADDRESS || null;
  if (rentalEscrowAddress) {
    const escrowCode = await hre.ethers.provider.getCode(rentalEscrowAddress);
    if (escrowCode && escrowCode.length > 2) {
      console.log(`ℹ️ Reusing verified deployed WorkspaceRentalEscrow at: ${rentalEscrowAddress}`);
    } else {
      rentalEscrowAddress = null;
    }
  }

  if (!rentalEscrowAddress && process.env.DEPLOY_WORKSPACE_ESCROW === "true") {
    try {
      console.log("\n[3/3] Deploying WorkspaceRentalEscrow...");
      const WorkspaceRentalEscrow = await hre.ethers.getContractFactory("WorkspaceRentalEscrow");
      const rentalEscrow = await WorkspaceRentalEscrow.deploy(
        usdcAddress,
        treasuryVault
      );
      await rentalEscrow.waitForDeployment();
      rentalEscrowAddress = await rentalEscrow.getAddress();
      console.log(`✅ WorkspaceRentalEscrow deployed at: ${rentalEscrowAddress}`);
    } catch (err) {
      console.warn("⚠️ WorkspaceRentalEscrow deployment skipped / pending gas:", err.message);
      rentalEscrowAddress = null;
    }
  } else if (!rentalEscrowAddress) {
    console.log("ℹ️ WorkspaceRentalEscrow deployment skipped (set DEPLOY_WORKSPACE_ESCROW=true to deploy)");
    rentalEscrowAddress = null;
  }

  // Save deployment artifact
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentData = {
    network: "amoy",
    chainId: Number(network.chainId),
    rpcUrl: hre.network.config.url || "https://polygon-amoy-bor-rpc.publicnode.com",
    deployedAt: new Date().toISOString(),
    deployerAddress: deployer.address,
    AgentRegistry: registryAddress,
    AgentMarketplace: marketplaceAddress,
    WorkspaceRentalEscrow: rentalEscrowAddress,
    EscrowPayment: marketplaceAddress,
    contracts: {
      AgentRegistry: registryAddress,
      AgentMarketplace: marketplaceAddress,
      WorkspaceRentalEscrow: rentalEscrowAddress,
      USDC: usdcAddress
    },
    explorerUrls: {
      AgentRegistry: `https://amoy.polygonscan.com/address/${registryAddress}`,
      AgentMarketplace: `https://amoy.polygonscan.com/address/${marketplaceAddress}`,
      ...(rentalEscrowAddress ? { WorkspaceRentalEscrow: `https://amoy.polygonscan.com/address/${rentalEscrowAddress}` } : {})
    }
  };

  const deploymentPath = path.join(deploymentsDir, "amoy.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2) + "\n");
  console.log(`\n💾 Saved deployment records to: ${deploymentPath}`);

  console.log("\n🎉 Deployment completed successfully!");
  console.log(`- AgentRegistry:         https://amoy.polygonscan.com/address/${registryAddress}`);
  console.log(`- AgentMarketplace:      https://amoy.polygonscan.com/address/${marketplaceAddress}`);
  if (rentalEscrowAddress) {
    console.log(`- WorkspaceRentalEscrow: https://amoy.polygonscan.com/address/${rentalEscrowAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
