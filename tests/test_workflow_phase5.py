import pytest
from backend.orchestrator.dag_builder import dag_builder, DAGCycleError, DAGLimitExceededError, DAGValidationError

def test_dag_builder_topological_sort_success():
    nodes = [
        {"id": "node-1", "step_order": 1},
        {"id": "node-2", "step_order": 2},
        {"id": "node-3", "step_order": 3}
    ]
    edges = [
        {"parent_node_id": "node-1", "child_node_id": "node-2"},
        {"parent_node_id": "node-2", "child_node_id": "node-3"}
    ]

    res = dag_builder.validate_dag_structure(nodes, edges)
    assert res["valid"] is True
    assert res["topological_order"] == ["node-1", "node-2", "node-3"]
    assert res["max_depth"] == 3

def test_dag_builder_circular_dependency_cycle_detection():
    # Construct circular graph: node-1 -> node-2 -> node-3 -> node-1
    nodes = [
        {"id": "node-1", "step_order": 1},
        {"id": "node-2", "step_order": 2},
        {"id": "node-3", "step_order": 3}
    ]
    edges = [
        {"parent_node_id": "node-1", "child_node_id": "node-2"},
        {"parent_node_id": "node-2", "child_node_id": "node-3"},
        {"parent_node_id": "node-3", "child_node_id": "node-1"} # Cycle!
    ]

    with pytest.raises(DAGCycleError) as exc_info:
        dag_builder.validate_dag_structure(nodes, edges)
    assert "circular dependency detected" in str(exc_info.value).lower()

def test_dag_builder_node_limit_exceeded():
    nodes = [{"id": f"node-{i}", "step_order": i} for i in range(25)]
    edges = []

    with pytest.raises(DAGLimitExceededError) as exc_info:
        dag_builder.validate_dag_structure(nodes, edges)
    assert "exceeds maximum limit" in str(exc_info.value).lower()
