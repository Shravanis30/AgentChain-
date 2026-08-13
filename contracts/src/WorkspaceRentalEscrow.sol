// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title WorkspaceRentalEscrow
 * @notice Time-based rental escrow for AgentChain Virtual Workspace Containers.
 *         Handles 98% Owner / 2% Treasury fee splits and partial early-termination refunds.
 */
contract WorkspaceRentalEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    address public treasuryVault;

    // Basis Points (10000 BPS = 100%)
    uint256 public constant OWNER_BPS = 9800;    // 98%
    uint256 public constant TREASURY_BPS = 200;   // 2%
    uint256 public constant TOTAL_BPS = 10000;

    enum LeaseStatus { NONE, LOCKED, COMPLETED, EARLY_TERMINATED, REFUNDED }

    struct WorkspaceLease {
        bytes32 leaseId;
        bytes32 workspaceId;
        address renter;
        address owner;
        uint256 totalAmountUSDC;
        uint256 leaseDurationSeconds;
        uint256 startTime;
        LeaseStatus status;
    }

    mapping(bytes32 => WorkspaceLease) public leases;

    event LeaseCreated(bytes32 indexed leaseId, bytes32 indexed workspaceId, address indexed renter, address owner, uint256 amountUSDC, uint256 durationSeconds);
    event LeaseCompleted(bytes32 indexed leaseId, uint256 ownerPayout, uint256 treasuryFee);
    event LeaseTerminatedEarly(bytes32 indexed leaseId, uint256 ownerPayout, uint256 renterRefund, uint256 treasuryFee);

    constructor(address _usdcToken, address _treasuryVault) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_treasuryVault != address(0), "Invalid Treasury address");
        usdcToken = IERC20(_usdcToken);
        treasuryVault = _treasuryVault;
    }

    function createLease(
        bytes32 _leaseId,
        bytes32 _workspaceId,
        address _owner,
        uint256 _amountUSDC,
        uint256 _durationSeconds
    ) external nonReentrant {
        require(leases[_leaseId].status == LeaseStatus.NONE, "Lease ID already exists");
        require(_owner != address(0), "Invalid owner address");
        require(_amountUSDC > 0, "Lease amount must be > 0");
        require(_durationSeconds > 0, "Duration must be > 0");

        usdcToken.safeTransferFrom(msg.sender, address(this), _amountUSDC);

        leases[_leaseId] = WorkspaceLease({
            leaseId: _leaseId,
            workspaceId: _workspaceId,
            renter: msg.sender,
            owner: _owner,
            totalAmountUSDC: _amountUSDC,
            leaseDurationSeconds: _durationSeconds,
            startTime: block.timestamp,
            status: LeaseStatus.LOCKED
        });

        emit LeaseCreated(_leaseId, _workspaceId, msg.sender, _owner, _amountUSDC, _durationSeconds);
    }

    function settleCompletedLease(bytes32 _leaseId) external nonReentrant {
        WorkspaceLease storage lease = leases[_leaseId];
        require(lease.status == LeaseStatus.LOCKED, "Lease not in LOCKED status");
        require(block.timestamp >= lease.startTime + lease.leaseDurationSeconds, "Lease duration not yet elapsed");

        lease.status = LeaseStatus.COMPLETED;

        uint256 treasuryFee = (lease.totalAmountUSDC * TREASURY_BPS) / TOTAL_BPS;
        uint256 ownerPayout = lease.totalAmountUSDC - treasuryFee;

        usdcToken.safeTransfer(lease.owner, ownerPayout);
        usdcToken.safeTransfer(treasuryVault, treasuryFee);

        emit LeaseCompleted(_leaseId, ownerPayout, treasuryFee);
    }

    function earlyTerminateRefund(bytes32 _leaseId) external nonReentrant {
        WorkspaceLease storage lease = leases[_leaseId];
        require(lease.status == LeaseStatus.LOCKED, "Lease not in LOCKED status");
        require(msg.sender == lease.renter || msg.sender == owner(), "Unauthorized termination");

        lease.status = LeaseStatus.EARLY_TERMINATED;

        uint256 elapsed = block.timestamp > lease.startTime ? block.timestamp - lease.startTime : 0;
        if (elapsed > lease.leaseDurationSeconds) {
            elapsed = lease.leaseDurationSeconds;
        }

        uint256 elapsedAmount = (lease.totalAmountUSDC * elapsed) / lease.leaseDurationSeconds;
        uint256 remainingAmount = lease.totalAmountUSDC - elapsedAmount;

        uint256 treasuryFee = (elapsedAmount * TREASURY_BPS) / TOTAL_BPS;
        uint256 ownerPayout = elapsedAmount > treasuryFee ? elapsedAmount - treasuryFee : 0;

        usdcToken.safeTransfer(lease.renter, remainingAmount);
        if (ownerPayout > 0) usdcToken.safeTransfer(lease.owner, ownerPayout);
        if (treasuryFee > 0) usdcToken.safeTransfer(treasuryVault, treasuryFee);

        emit LeaseTerminatedEarly(_leaseId, ownerPayout, remainingAmount, treasuryFee);
    }
}
