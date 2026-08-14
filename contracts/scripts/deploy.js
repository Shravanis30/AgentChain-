const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying AgentChain contracts with account: ${deployer.address}`);

  // Testnet USDC address or mock
  const usdcAddress = process.env.USDC_ADDRESS || "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const daoVault = process.env.DAO_VAULT_ADDRESS || deployer.address;
  const stakerVault = process.env.STAKER_VAULT_ADDRESS || deployer.address;
  const oracleAddress = process.env.SETTLEMENT_ORACLE_ADDRESS || deployer.address;

  // 1. Deploy AgentRegistry
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  console.log(`✅ AgentRegistry deployed at: ${await registry.getAddress()}`);

  // 2. Deploy AgentMarketplace
  const AgentMarketplace = await hre.ethers.getContractFactory("AgentMarketplace");
  const marketplace = await AgentMarketplace.deploy(
    usdcAddress,
    daoVault,
    stakerVault,
    oracleAddress
  );
  await marketplace.waitForDeployment();
  console.log(`✅ AgentMarketplace deployed at: ${await marketplace.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
