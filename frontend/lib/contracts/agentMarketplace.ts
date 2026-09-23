import amoyDeployment from '../../../contracts/deployments/amoy.json';

export const AMOY_DEPLOYMENT = amoyDeployment;

export const AGENT_MARKETPLACE_ADDRESS = (
  process.env.NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS ||
  process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS ||
  (amoyDeployment as Record<string, any>)?.AgentMarketplace ||
  '0x33b0709B52e782aB9576B6044132E65A3AF5206E'
) as `0x${string}`;

export const AGENT_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS ||
  (amoyDeployment as Record<string, any>)?.AgentRegistry ||
  '0x8218bDB16D7E71d4F51D31D6F0e919C1302CD6d1'
) as `0x${string}`;

export const WORKSPACE_RENTAL_ESCROW_ADDRESS = (
  process.env.NEXT_PUBLIC_RENTAL_ESCROW_CONTRACT_ADDRESS ||
  (amoyDeployment as Record<string, any>)?.WorkspaceRentalEscrow ||
  null
) as `0x${string}` | null;

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
    inputs: [
      { name: '_agentId', type: 'bytes32' },
      { name: '_versionHash', type: 'string' },
      { name: '_amount', type: 'uint256' },
      { name: '_clientDeadline', type: 'uint256' },
    ],
    name: 'createEscrow',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_agentId', type: 'bytes32' }],
    name: 'isAgentRegistered',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
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
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentId', type: 'bytes32' },
      { indexed: false, name: 'versionHash', type: 'string' },
      { indexed: true, name: 'developer', type: 'address' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'AgentRegistered',
    type: 'event',
  },
] as const;

export const WORKSPACE_RENTAL_ESCROW_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: '_leaseId', type: 'bytes32' },
      { internalType: 'bytes32', name: '_workspaceId', type: 'bytes32' },
      { internalType: 'address', name: '_owner', type: 'address' },
      { internalType: 'uint256', name: '_amountUSDC', type: 'uint256' },
      { internalType: 'uint256', name: '_durationSeconds', type: 'uint256' }
    ],
    name: 'createLease',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: '_leaseId', type: 'bytes32' }],
    name: 'settleCompletedLease',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: '_leaseId', type: 'bytes32' }],
    name: 'earlyTerminateRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name: 'leases',
    outputs: [
      { internalType: 'bytes32', name: 'leaseId', type: 'bytes32' },
      { internalType: 'bytes32', name: 'workspaceId', type: 'bytes32' },
      { internalType: 'address', name: 'renter', type: 'address' },
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'uint256', name: 'totalAmountUSDC', type: 'uint256' },
      { internalType: 'uint256', name: 'leaseDurationSeconds', type: 'uint256' },
      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { internalType: 'uint8', name: 'status', type: 'uint8' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
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
