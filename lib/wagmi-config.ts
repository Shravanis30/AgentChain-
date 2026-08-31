import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, polygon } from 'wagmi/chains';

// Public open WalletConnect Project ID for development & testing
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';

export const wagmiConfig = getDefaultConfig({
  appName: 'AgentChain Protocol',
  projectId: projectId,
  chains: [mainnet, sepolia, polygon],
  ssr: true,
});
