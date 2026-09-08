export const AGENT_MARKETPLACE_ADDRESS = (
  process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890'
) as `0x${string}`;

export const AGENT_MARKETPLACE_ABI = [
  {
    inputs: [
      { name: '_agentId', type: 'bytes32' },
      { name: '_versionHash', type: 'string' },
      { name: '_developer', type: 'address' },
    ],
    name: 'registerAgent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_agentId', type: 'bytes32' }],
    name: 'registeredAgents',
    outputs: [
      { name: 'agentId', type: 'bytes32' },
      { name: 'versionHash', type: 'string' },
      { name: 'developer', type: 'address' },
      { name: 'publishedAt', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '_taskId', type: 'bytes32' },
      { name: '_developer', type: 'address' },
      { name: '_amountUSDC', type: 'uint256' },
      { name: '_durationSeconds', type: 'uint256' },
    ],
    name: 'lockTaskEscrow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentId', type: 'bytes32' },
      { indexed: false, name: 'versionHash', type: 'string' },
      { indexed: true, name: 'developer', type: 'address' },
    ],
    name: 'AgentPublishedOnChain',
    type: 'event',
  },
] as const;

export function getExplorerTxUrl(txHash: string, chainId: number = 80002): string {
  if (!txHash) return '#';
  if (chainId === 137) {
    return `https://polygonscan.com/tx/${txHash}`;
  }
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

/**
  * Converts an agent UUID or slug string into a deterministic bytes32 hex string.
  */
export function agentIdToBytes32(id: string): `0x${string}` {
  const cleanId = id.replace(/-/g, '').padEnd(32, '0').slice(0, 32);
  let hex = '0x';
  for (let i = 0; i < cleanId.length; i++) {
    hex += cleanId.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex.padEnd(66, '0') as `0x${string}`;
}
