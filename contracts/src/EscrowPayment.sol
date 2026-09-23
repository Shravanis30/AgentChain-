// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentMarketplace.sol";

/**
 * @title EscrowPayment
 * @notice Alias contract for AgentMarketplace providing identical escrow settlement,
 *         85/10/5 revenue distribution, and dispute arbitration capabilities.
 */
contract EscrowPayment is AgentMarketplace {
    constructor(
        address _usdcToken,
        address _daoVault,
        address _stakerVault,
        address _settlementOracle
    ) AgentMarketplace(_usdcToken, _daoVault, _stakerVault, _settlementOracle) {}
}
