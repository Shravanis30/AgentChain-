require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {},
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC || process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com",
      accounts: (process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY) ? [process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY] : [],
      chainId: 80002
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || process.env.POLYGON_AMOY_RPC || "https://polygon-amoy-bor-rpc.publicnode.com",
      accounts: (process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY) ? [process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY] : [],
      chainId: 80002
    }
  }
};
