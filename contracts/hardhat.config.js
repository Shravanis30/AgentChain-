require("@nomicfoundation/hardhat-toolbox");
const fs = require("fs");
const path = require("path");

// Automatically load .env from root or local contracts directory
function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (val.includes("#") && !val.startsWith('"') && !val.startsWith("'")) {
          val = val.split("#")[0].trim();
        }
        val = val.replace(/^["'](.*)["']$/, "$1");
        if (!process.env[key] && val) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, ".env"));

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
