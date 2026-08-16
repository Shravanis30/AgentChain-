# AgentChain: Smart Contract Security Review & Audit

**Date**: August 31, 2026  
**Contracts Audited**:
- [`AgentMarketplace.sol`](file:///Users/shravani/Desktop/AgentChain/contracts/src/AgentMarketplace.sol) (Solidity ^0.8.20)
- [`AgentRegistry.sol`](file:///Users/shravani/Desktop/AgentChain/contracts/src/AgentRegistry.sol) (Solidity ^0.8.20)

---

## 1. Executive Summary

A formal security review of the AgentChain smart contracts was conducted to evaluate state machine integrity, access controls, revenue distribution mathematics, reentrancy vulnerabilities, re-entrancy/replay attack vectors, and administrative privileges.

The smart contracts are written for EVM targets using Solidity `^0.8.20` and leverage OpenZeppelin's audited baseline libraries (`ReentrancyGuard`, `Pausable`, `Ownable`, `SafeERC20`).

---

## 2. Architecture & Ownership Model

```
 ┌─────────────────────────────────────────────────────────┐
 │                   AgentMarketplace                      │
 │  Inherits: Ownable, ReentrancyGuard, Pausable           │
 └────────────────────────────┬────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   [Client Wallet]    [Settlement Oracle]     [Admin / Owner]
   - lockTaskEscrow   - settleTaskEscrow     - resolveDispute
   - refundExpired    - (onlyOracleOrOwner)  - setRevenueSplit
   - raiseDispute                            - pause/unpause
```

### Access Control Matrix

| Function | Caller | Guard / Modifiers | Description |
|---|---|---|---|
| `lockTaskEscrow` | Anyone | `nonReentrant`, `whenNotPaused` | Deposits USDC into escrow for specified task ID. |
| `settleTaskEscrow` | Oracle / Owner | `nonReentrant`, `whenNotPaused`, `onlyOracleOrOwner` | Settles escrow, verifies proof hash, transfers 85/10/5 split. |
| `refundExpiredEscrow` | Client / Owner | `nonReentrant`, `whenNotPaused` | Refunds escrow if current timestamp >= deadline. |
| `raiseDispute` | Client / Dev | None (Status check) | Transitions LOCKED escrow to DISPUTED status. |
| `resolveDispute` | Owner (Admin) | `onlyOwner`, `nonReentrant` | Arbitrates dispute; refunds client or settles developer split. |
| `setRevenueSplit` | Owner (Admin) | `onlyOwner` | Adjusts BPS split (enforces dev + staker + dao == 10000). |
| `setSettlementOracle` | Owner (Admin) | `onlyOwner` | Updates settlement oracle address. |

---

## 3. Escrow State Machine

```
              ┌───────────┐
              │   NONE    │
              └─────┬─────┘
                    │ lockTaskEscrow()
                    ▼
              ┌───────────┐
  ┌───────────┤  LOCKED   ├───────────┐
  │           └─────┬─────┘           │
  │                 │                 │
  │ refundExpired() │ settleTaskEscrow()│ raiseDispute()
  ▼                 ▼                 ▼
┌───────────┐ ┌───────────┐     ┌───────────┐
│ REFUNDED  │ │  SETTLED  │     │ DISPUTED  │
└───────────┘ └───────────┘     └─────┬─────┘
                                      │ resolveDispute()
                                      ▼
                           ┌─────────────────────┐
                           │ REFUNDED / SETTLED  │
                           └─────────────────────┘
```

---

## 4. Threat Vectors & Security Analysis

### 4.1 Reentrancy Attacks
- **Mitigation**: All state-mutating financial functions (`lockTaskEscrow`, `settleTaskEscrow`, `refundExpiredEscrow`, `resolveDispute`) apply OpenZeppelin's `nonReentrant` modifier.
- **Checks-Effects-Interactions**: State transitions (`escrow.status = EscrowStatus.SETTLED` or `REFUNDED`) occur **before** external ERC-20 `safeTransfer` calls.
- **Verdict**: **SECURE**

### 4.2 Replay Attacks & Double Settlement
- **Mitigation**: `escrow.status` is checked explicitly (`require(escrow.status == EscrowStatus.LOCKED)`). Once settled or refunded, status becomes `SETTLED` or `REFUNDED`. Subsequent calls fail.
- **Verdict**: **SECURE**

### 4.3 Unauthorized Settlement / Oracle Compromise
- **Mitigation**: `settleTaskEscrow` requires `msg.sender == settlementOracle || msg.sender == owner()`.
- **Trust Assumption**: The backend settlement oracle key must be held securely (e.g. KMS/HSM). If the oracle private key is compromised, an attacker could attempt to settle locked escrows.
- **Remediation**: The backend oracle service verifies proof hashes and off-chain execution state before signing transactions.

### 4.4 Integer Overflow / Arithmetic & Revenue Split
- **Mitigation**: Solidity `^0.8.20` has built-in overflow/underflow protection.
- **Division Precision**:
  ```solidity
  uint256 devPayout = (escrow.amountUSDC * devSplitBPS) / TOTAL_BPS;
  uint256 stakerPayout = (escrow.amountUSDC * stakerSplitBPS) / TOTAL_BPS;
  uint256 daoPayout = escrow.amountUSDC - devPayout - stakerPayout;
  ```
  Calculating `daoPayout` as the exact remainder guarantees zero dust token loss due to division rounding.
- **Verdict**: **SECURE**

### 4.5 Zero Address Protections
- **Mitigation**: Constructor and parameter setters strictly assert `require(addr != address(0))` for USDC token, DAO vault, Staker vault, and Oracle addresses.
- **Verdict**: **SECURE**

---

## 5. Trust Assumptions & Recommendations

1. **Oracle Key Management**: The settlement oracle private key MUST NOT be embedded in source code or client bundles. Production environments must utilize AWS KMS, GCP KMS, or HashiCorp Vault.
2. **Event Indexer Confirmation Depth**: On-chain events must not trigger off-chain database ledger credits immediately upon broadcast. The indexer must wait for block confirmation depth (e.g., 2 blocks on Polygon Amoy, 12 blocks on Ethereum mainnet) to defend against chain reorganizations.
