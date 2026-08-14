// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgentMarketplace & Escrow Settlement Contract
 * @notice Manages task deposits, proof-of-task verifications, configurable 85/10/5 BPS revenue splits,
 *         client-side timeout refunds, and administrative dispute arbitration.
 */
contract AgentMarketplace is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    address public daoVault;
    address public stakerVault;
    address public settlementOracle;

    // Basis Points (10000 BPS = 100%)
    uint256 public devSplitBPS = 8500;     // 85%
    uint256 public stakerSplitBPS = 1000;  // 10%
    uint256 public daoSplitBPS = 500;      // 5%
    uint256 public constant TOTAL_BPS = 10000;

    // Default escrow timeout window (e.g. 24 hours)
    uint256 public constant DEFAULT_ESCROW_TIMEOUT = 1 days;

    enum EscrowStatus { NONE, LOCKED, SETTLED, REFUNDED, DISPUTED }

    struct TaskEscrow {
        bytes32 taskId;
        address client;
        address developer;
        uint256 amountUSDC;
        bytes32 proofHash;
        uint256 createdAt;
        uint256 deadline;
        EscrowStatus status;
    }

    mapping(bytes32 => TaskEscrow) public escrows;

    event EscrowLocked(
        bytes32 indexed taskId,
        address indexed client,
        address indexed developer,
        uint256 amountUSDC,
        uint256 deadline
    );

    event EscrowSettled(
        bytes32 indexed taskId,
        address indexed developer,
        bytes32 proofHash,
        uint256 devPayout,
        uint256 stakerPayout,
        uint256 daoPayout
    );

    event EscrowRefunded(bytes32 indexed taskId, address indexed client, uint256 amountUSDC, string reason);
    event DisputeRaised(bytes32 indexed taskId, address indexed raisedBy, string reason);
    event DisputeResolved(bytes32 indexed taskId, EscrowStatus finalStatus, uint256 payoutAmount);
    event RevenueSplitUpdated(uint256 devBps, uint256 stakerBps, uint256 daoBps);
    event SettlementOracleUpdated(address indexed oldOracle, address indexed newOracle);

    modifier onlyOracleOrOwner() {
        require(msg.sender == settlementOracle || msg.sender == owner(), "Marketplace: Unauthorized settlement caller");
        _;
    }

    constructor(
        address _usdcToken,
        address _daoVault,
        address _stakerVault,
        address _settlementOracle
    ) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Marketplace: Invalid USDC address");
        require(_daoVault != address(0), "Marketplace: Invalid DAO vault address");
        require(_stakerVault != address(0), "Marketplace: Invalid Staker vault address");
        require(_settlementOracle != address(0), "Marketplace: Invalid Oracle address");

        usdcToken = IERC20(_usdcToken);
        daoVault = _daoVault;
        stakerVault = _stakerVault;
        settlementOracle = _settlementOracle;
    }

    /**
     * @notice Locks task payment in escrow.
     */
    function lockTaskEscrow(
        bytes32 _taskId,
        address _developer,
        uint256 _amountUSDC,
        uint256 _durationSeconds
    ) external nonReentrant whenNotPaused {
        require(_amountUSDC > 0, "Marketplace: Amount must be > 0");
        require(_developer != address(0), "Marketplace: Invalid developer address");
        require(escrows[_taskId].status == EscrowStatus.NONE, "Marketplace: Escrow already exists for this task");

        uint256 duration = _durationSeconds > 0 ? _durationSeconds : DEFAULT_ESCROW_TIMEOUT;
        uint256 deadline = block.timestamp + duration;

        // Safe transfer from client to contract
        usdcToken.safeTransferFrom(msg.sender, address(this), _amountUSDC);

        escrows[_taskId] = TaskEscrow({
            taskId: _taskId,
            client: msg.sender,
            developer: _developer,
            amountUSDC: _amountUSDC,
            proofHash: bytes32(0),
            createdAt: block.timestamp,
            deadline: deadline,
            status: EscrowStatus.LOCKED
        });

        emit EscrowLocked(_taskId, msg.sender, _developer, _amountUSDC, deadline);
    }

    /**
     * @notice Settles an escrow after successful task completion and cryptographic proof verification.
     * @dev Restricted to authorized settlement oracle or contract owner.
     */
    function settleTaskEscrow(bytes32 _taskId, bytes32 _proofHash) external nonReentrant whenNotPaused onlyOracleOrOwner {
        TaskEscrow storage escrow = escrows[_taskId];
        require(escrow.status == EscrowStatus.LOCKED, "Marketplace: Escrow is not in LOCKED status");
        require(_proofHash != bytes32(0), "Marketplace: Proof hash required");

        escrow.proofHash = _proofHash;
        escrow.status = EscrowStatus.SETTLED;

        // Calculate Revenue Distribution (85% Developer, 10% Stakers, 5% DAO Vault)
        uint256 devPayout = (escrow.amountUSDC * devSplitBPS) / TOTAL_BPS;
        uint256 stakerPayout = (escrow.amountUSDC * stakerSplitBPS) / TOTAL_BPS;
        uint256 daoPayout = escrow.amountUSDC - devPayout - stakerPayout;

        usdcToken.safeTransfer(escrow.developer, devPayout);
        if (stakerPayout > 0) {
            usdcToken.safeTransfer(stakerVault, stakerPayout);
        }
        if (daoPayout > 0) {
            usdcToken.safeTransfer(daoVault, daoPayout);
        }

        emit EscrowSettled(_taskId, escrow.developer, _proofHash, devPayout, stakerPayout, daoPayout);
    }

    /**
     * @notice Reclaims funds if task expired without settlement.
     */
    function refundExpiredEscrow(bytes32 _taskId) external nonReentrant whenNotPaused {
        TaskEscrow storage escrow = escrows[_taskId];
        require(escrow.status == EscrowStatus.LOCKED, "Marketplace: Escrow not locked");
        require(msg.sender == escrow.client || msg.sender == owner(), "Marketplace: Only client or admin can refund");
        require(block.timestamp >= escrow.deadline, "Marketplace: Escrow deadline has not passed");

        escrow.status = EscrowStatus.REFUNDED;
        usdcToken.safeTransfer(escrow.client, escrow.amountUSDC);

        emit EscrowRefunded(_taskId, escrow.client, escrow.amountUSDC, "TASK_TIMEOUT_EXPIRED");
    }

    /**
     * @notice Allows client or developer to raise a dispute.
     */
    function raiseDispute(bytes32 _taskId, string calldata _reason) external {
        TaskEscrow storage escrow = escrows[_taskId];
        require(escrow.status == EscrowStatus.LOCKED, "Marketplace: Escrow not locked");
        require(msg.sender == escrow.client || msg.sender == escrow.developer, "Marketplace: Not participant");

        escrow.status = EscrowStatus.DISPUTED;
        emit DisputeRaised(_taskId, msg.sender, _reason);
    }

    /**
     * @notice Admin dispute resolution.
     */
    function resolveDispute(bytes32 _taskId, bool _refundClient) external onlyOwner nonReentrant {
        TaskEscrow storage escrow = escrows[_taskId];
        require(escrow.status == EscrowStatus.DISPUTED, "Marketplace: Task is not disputed");

        if (_refundClient) {
            escrow.status = EscrowStatus.REFUNDED;
            usdcToken.safeTransfer(escrow.client, escrow.amountUSDC);
            emit DisputeResolved(_taskId, EscrowStatus.REFUNDED, escrow.amountUSDC);
        } else {
            escrow.status = EscrowStatus.SETTLED;
            uint256 devPayout = (escrow.amountUSDC * devSplitBPS) / TOTAL_BPS;
            uint256 stakerPayout = (escrow.amountUSDC * stakerSplitBPS) / TOTAL_BPS;
            uint256 daoPayout = escrow.amountUSDC - devPayout - stakerPayout;

            usdcToken.safeTransfer(escrow.developer, devPayout);
            if (stakerPayout > 0) usdcToken.safeTransfer(stakerVault, stakerPayout);
            if (daoPayout > 0) usdcToken.safeTransfer(daoVault, daoPayout);

            emit DisputeResolved(_taskId, EscrowStatus.SETTLED, devPayout);
        }
    }

    /**
     * @notice Updates revenue split percentages.
     */
    function setRevenueSplit(uint256 _devBps, uint256 _stakerBps, uint256 _daoBps) external onlyOwner {
        require(_devBps + _stakerBps + _daoBps == TOTAL_BPS, "Marketplace: Total BPS must equal 10000");
        devSplitBPS = _devBps;
        stakerSplitBPS = _stakerBps;
        daoSplitBPS = _daoBps;
        emit RevenueSplitUpdated(_devBps, _stakerBps, _daoBps);
    }

    function setSettlementOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Marketplace: Invalid oracle address");
        address oldOracle = settlementOracle;
        settlementOracle = _newOracle;
        emit SettlementOracleUpdated(oldOracle, _newOracle);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
