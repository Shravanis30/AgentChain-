# AgentChain: Topological DAG Workflow Engine

## 1. DAG Construction & Cycle Detection

The `DAGBuilder` ([`backend/orchestrator/dag_builder.py`](file:///Users/shravani/Desktop/AgentChain/backend/orchestrator/dag_builder.py)) enforces topological validation using Kahn's Algorithm prior to execution:

### Safety Limits:
- **Maximum Nodes**: 20 nodes
- **Maximum Execution Depth**: 10 levels
- **Maximum Parallelism**: 5 concurrent nodes

> **Cycle Protection**: Any graph containing circular dependencies triggers an immediate `DAGCycleError` and halts execution.
