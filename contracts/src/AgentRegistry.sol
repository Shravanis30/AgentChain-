// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentRegistry
 * @notice Manages sovereign decentralized agent identities (ERC-725/DID) and version metadata.
 */
contract AgentRegistry is Ownable {
    struct AgentMeta {
        string did;
        address developer;
        string metadataURI;
        string category;
        uint256 pricePerCallUSDC;
        uint256 registeredAt;
        bool active;
    }

    mapping(bytes32 => AgentMeta) public agents;
    bytes32[] public agentIds;

    event AgentRegistered(bytes32 indexed agentId, string did, address indexed developer, string category);
    event AgentUpdated(bytes32 indexed agentId, string metadataURI, uint256 pricePerCallUSDC);
    event AgentStatusChanged(bytes32 indexed agentId, bool active);

    constructor() Ownable(msg.sender) {}

    function registerAgent(
        string calldata _did,
        string calldata _metadataURI,
        string calldata _category,
        uint256 _pricePerCallUSDC
    ) external returns (bytes32) {
        bytes32 agentId = keccak256(abi.encodePacked(_did, msg.sender, block.timestamp));
        require(agents[agentId].developer == address(0), "AgentRegistry: Agent ID collision");

        agents[agentId] = AgentMeta({
            did: _did,
            developer: msg.sender,
            metadataURI: _metadataURI,
            category: _category,
            pricePerCallUSDC: _pricePerCallUSDC,
            registeredAt: block.timestamp,
            active: true
        });

        agentIds.push(agentId);
        emit AgentRegistered(agentId, _did, msg.sender, _category);
        return agentId;
    }

    function updateAgent(
        bytes32 _agentId,
        string calldata _metadataURI,
        uint256 _pricePerCallUSDC
    ) external {
        AgentMeta storage agent = agents[_agentId];
        require(agent.developer == msg.sender || msg.sender == owner(), "AgentRegistry: Not authorized");
        agent.metadataURI = _metadataURI;
        agent.pricePerCallUSDC = _pricePerCallUSDC;
        emit AgentUpdated(_agentId, _metadataURI, _pricePerCallUSDC);
    }

    function setAgentStatus(bytes32 _agentId, bool _active) external {
        AgentMeta storage agent = agents[_agentId];
        require(agent.developer == msg.sender || msg.sender == owner(), "AgentRegistry: Not authorized");
        agent.active = _active;
        emit AgentStatusChanged(_agentId, _active);
    }

    function getAgent(bytes32 _agentId) external view returns (AgentMeta memory) {
        return agents[_agentId];
    }

    function getTotalAgents() external view returns (uint256) {
        return agentIds.length;
    }
}
