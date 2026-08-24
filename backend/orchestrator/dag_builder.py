import logging
from typing import Dict, Any, List, Set
from collections import defaultdict, deque

logger = logging.getLogger("agentchain.dag_builder")

class DAGValidationError(Exception):
    """Base exception for DAG validation errors."""
    pass

class DAGCycleError(DAGValidationError):
    """Raised when a circular dependency is detected in the DAG."""
    pass

class DAGLimitExceededError(DAGValidationError):
    """Raised when DAG bounds exceed configured safety limits."""
    pass

MAX_NODES = 20
MAX_DEPTH = 10
MAX_PARALLELISM = 5

class DAGBuilder:
    """Constructs and validates topological Directed Acyclic Graphs (DAGs) for multi-agent workflows."""

    @staticmethod
    def validate_dag_structure(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Enforces topological acyclic validation using Kahn's Algorithm.
        """
        # 1. Bounds Check
        if len(nodes) == 0:
            raise DAGValidationError("DAG must contain at least 1 node.")
        if len(nodes) > MAX_NODES:
            raise DAGLimitExceededError(f"DAG node count ({len(nodes)}) exceeds maximum limit of {MAX_NODES}.")

        # 2. Build Adjacency Matrix & In-Degrees
        node_ids = {n["id"] for n in nodes}
        in_degree: Dict[str, int] = {n_id: 0 for n_id in node_ids}
        adj_list: Dict[str, List[str]] = defaultdict(list)

        for edge in edges:
            u, v = edge["parent_node_id"], edge["child_node_id"]
            if u not in node_ids or v not in node_ids:
                raise DAGValidationError(f"Edge references invalid node ID: {u} -> {v}")
            adj_list[u].append(v)
            in_degree[v] += 1

        # 3. Kahn's Algorithm Topological Sort
        queue = deque([n_id for n_id in node_ids if in_degree[n_id] == 0])
        visited_count = 0
        topological_order = []

        # Level/Depth tracking
        node_depth: Dict[str, int] = {n_id: 1 for n_id in node_ids if in_degree[n_id] == 0}

        while queue:
            curr = queue.popleft()
            visited_count += 1
            topological_order.append(curr)

            curr_depth = node_depth.get(curr, 1)
            if curr_depth > MAX_DEPTH:
                raise DAGLimitExceededError(f"DAG execution depth ({curr_depth}) exceeds maximum limit of {MAX_DEPTH}.")

            for neighbor in adj_list[curr]:
                in_degree[neighbor] -= 1
                node_depth[neighbor] = max(node_depth.get(neighbor, 1), curr_depth + 1)
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # 4. Cycle Check
        if visited_count != len(node_ids):
            raise DAGCycleError("CRITICAL SECURITY ERROR: Circular dependency detected in workflow DAG!")

        return {
            "valid": True,
            "topological_order": topological_order,
            "max_depth": max(node_depth.values()) if node_depth else 1,
            "total_nodes": len(nodes)
        }

    @staticmethod
    def construct_dag_from_intent(user_prompt: str, category: str = "general") -> Dict[str, Any]:
        """Generates structured DAG nodes and edges based on user task intent."""
        # Multi-node DAG structure
        n1_id = "node-1-research"
        n2_id = "node-2-coding"
        n3_id = "node-3-review"

        nodes = [
            {
                "id": n1_id,
                "step_order": 1,
                "domain": "research",
                "title": "Domain Research & Fact Extraction",
                "input_prompt": f"Analyze task domain requirements and gather key context for: {user_prompt}"
            },
            {
                "id": n2_id,
                "step_order": 2,
                "domain": "coding" if category == "coding" else "finance",
                "title": "Technical Implementation & Computation",
                "input_prompt": f"Construct code and logical solution for: {user_prompt}"
            },
            {
                "id": n3_id,
                "step_order": 3,
                "domain": "security",
                "title": "Verification & Quality Audit",
                "input_prompt": f"Audit outputs from research and technical steps for safety and accuracy."
            }
        ]

        edges = [
            {"parent_node_id": n1_id, "child_node_id": n2_id},
            {"parent_node_id": n2_id, "child_node_id": n3_id}
        ]

        DAGBuilder.validate_dag_structure(nodes, edges)
        return {"nodes": nodes, "edges": edges}

dag_builder = DAGBuilder()
