import amoyDeployment from '../../../contracts/deployments/amoy.json';

export const USDC_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS ||
  (amoyDeployment as Record<string, any>)?.contracts?.USDC ||
  '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
) as `0x${string}`;

export const USDC_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Converts human-readable USDC to 6-decimal integer micro-units.
 */
export function usdcToAtomicUnits(amountUsdc: number): bigint {
  return BigInt(Math.round(amountUsdc * 1_000_000));
}

/**
 * Converts 6-decimal integer micro-units to human-readable USDC.
 */
export function atomicUnitsToUsdc(atomic: bigint): number {
  return Number(atomic) / 1_000_000;
}
