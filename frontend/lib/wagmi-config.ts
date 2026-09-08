import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy, polygon, mainnet, sepolia } from 'wagmi/chains';
import { http } from 'wagmi';

// Public open WalletConnect Project ID for development & testing
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';

export const wagmiConfig = getDefaultConfig({
  appName: 'AgentChain Protocol',
  projectId: projectId,
  chains: [polygonAmoy, polygon, mainnet, sepolia],
  transports: {
    [polygonAmoy.id]: http('https://polygon-amoy-bor-rpc.publicnode.com'),
  },
  ssr: true,
});

