# AgentChain: 10 Specialized Architecture Diagrams & Technical Specifications

> **System Overview**: Specialized architectural views for **AgentChain: A Decentralized Autonomous AI Workforce Platform**. All 10 diagrams are fully aligned with the core 8-layer vertical enterprise architecture design pattern.

---

## Diagram Index & Vector SVG Links

1. **C4 Context Diagram**: [diagrams/c4_context.svg](file:///Users/shravani/Documents/AgentChain/diagrams/c4_context.svg)
2. **C4 Container Diagram**: [diagrams/c4_container.svg](file:///Users/shravani/Documents/AgentChain/diagrams/c4_container.svg)
3. **C4 Component Diagram**: [diagrams/c4_component.svg](file:///Users/shravani/Documents/AgentChain/diagrams/c4_component.svg)
4. **Deployment Diagram**: [diagrams/deployment.svg](file:///Users/shravani/Documents/AgentChain/diagrams/deployment.svg)
5. **Sequence Diagram**: [diagrams/sequence.svg](file:///Users/shravani/Documents/AgentChain/diagrams/sequence.svg)
6. **Data Flow Diagram (DFD)**: [diagrams/data_flow.svg](file:///Users/shravani/Documents/AgentChain/diagrams/data_flow.svg)
7. **Microservice Architecture**: [diagrams/microservices.svg](file:///Users/shravani/Documents/AgentChain/diagrams/microservices.svg)
8. **Blockchain Transaction Flow**: [diagrams/blockchain_flow.svg](file:///Users/shravani/Documents/AgentChain/diagrams/blockchain_flow.svg)
9. **AI Agent Collaboration Flow**: [diagrams/agent_collaboration.svg](file:///Users/shravani/Documents/AgentChain/diagrams/agent_collaboration.svg)
10. **Kubernetes Deployment Architecture**: [diagrams/k8s_architecture.svg](file:///Users/shravani/Documents/AgentChain/diagrams/k8s_architecture.svg)

---

## 1. C4 Context Diagram

Defines the system boundary of AgentChain, highlighting end users, developers, external LLM providers, blockchain networks, and decentralized storage.

```mermaid
graph TD
    User["👤 Enterprise / End User"] -->|Submits Tasks & Pays| System["⚡ AgentChain Platform"]
    Dev["👨‍💻 Agent Developer"] -->|Publishes Agents & Earns Royalty| System
    
    System -->|Dynamic Inference Calls| LLM["🤖 External LLMs (OpenAI/Claude/Gemini/Llama/DeepSeek)"]
    System -->|Escrow, Reputation & Settlement| Web3["🔗 Blockchain (Ethereum L1 / Polygon L2)"]
    System -->|Weights & Artifact Storage| IPFS["📦 IPFS & AWS S3"]
```

---

## 2. C4 Container Diagram

Illustrates the high-level runnable containers composing AgentChain: Web/Mobile SPAs, API Gateway, Orchestration Services, WASM Swarm Workers, Qdrant Vector DB, LLM Router, Kafka, and Smart Contracts.

```mermaid
graph TB
    subgraph Clients["User Layer Containers"]
        Web["🌐 Web Portal SPA (Next.js)"]
        Mobile["📱 Mobile App (React Native)"]
    end

    subgraph Core["Core Microservice Containers"]
        Gateway["🚪 API Gateway (Envoy / OAuth2 / SIWE)"]
        Orchestrator["⚙️ Core Orchestrator (Go / Temporal)"]
        Swarm["🐝 Multi-Agent Swarm Workers (WASM Pods)"]
    end

    subgraph DataStores["Database & Messaging Containers"]
        VectorDB["🗄️ Vector & Knowledge Store (Qdrant)"]
        Kafka["🟢 Event Streaming Bus (Apache Kafka)"]
        Cache["🔴 In-Memory Session Cache (Redis)"]
    end

    subgraph External["Trust & Inference Containers"]
        LLMRouter["🤖 Dynamic LLM Router (OpenRouter)"]
        SmartContracts["📜 Smart Contracts (Polygon L2 / Solidity)"]
    end

    Web --> Gateway
    Mobile --> Gateway
    Gateway --> Orchestrator
    Orchestrator --> Swarm
    Swarm --> VectorDB
    Swarm --> LLMRouter
    Orchestrator --> Kafka
    Orchestrator --> SmartContracts
```

---

## 3. C4 Component Diagram (Core Orchestration Engine)

Zoomed-in micro-architecture of the **Core Orchestration Engine**, detailing internal software components.

```mermaid
graph LR
    subgraph Orchestrator["Container: Core Orchestration Engine"]
        TA["🧠 Task Analyzer (DSPy NLU)"]
        TP["📋 Task Planner"]
        TD["✂️ Task Decomposer (DAG Builder)"]
        WE["⚙️ Workflow Engine (Temporal)"]
        AS["🎯 Agent Selector"]
        CM["📂 Context Manager"]
        PO["✨ Prompt Optimizer"]
        RA["🧩 Result Aggregator & Guardrails"]
    end

    TA --> TP --> TD --> WE --> AS
    AS --> CM
    CM --> PO
    PO --> RA
```

---

## 4. Deployment Diagram (AWS & Azure Hybrid Cloud)

Multi-cloud deployment topology across AWS (us-east-1), Azure (eastus), and Web3 Polygon RPC Nodes.

```mermaid
graph TB
    Edge["🌐 Global Cloudflare CDN & Anycast Edge"]

    subgraph AWS["☁️ AWS Region (us-east-1)"]
        EKS["☸️ Amazon EKS Cluster"]
        EKS_API["Node Pool: API & Orchestrators"]
        EKS_Swarm["Node Pool: Swarm Agents (GPU A10G)"]
        Qdrant_K8s["StatefulSet: Qdrant Vector Cluster"]
        Kafka_K8s["StatefulSet: Apache Kafka Cluster"]
        Aurora["🐘 AWS Aurora PostgreSQL"]
        Redis["🔴 AWS ElastiCache Redis"]
    end

    subgraph Azure["☁️ Azure Region (eastus)"]
        AKS["☸️ Azure Kubernetes Service (AKS)"]
        AzureOpenAI["Azure OpenAI Dedicated Pods"]
        PolygonNode["Polygon zkEVM Execution Node"]
    end

    Edge --> EKS
    Edge --> AKS
```

---

## 5. Sequence Diagram (12-Step Task Lifecycle)

UML sequence trace detailing synchronous and asynchronous data flows across the system.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User Client
    participant GW as 🚪 API Gateway
    participant Orch as ⚙️ Core Orchestrator
    participant Swarm as 🐝 Swarm Agents
    participant Vec as 🗄️ Vector DB (RAG)
    participant LLM as 🤖 LLM Router
    participant Contract as 📜 Smart Contract

    User->>GW: 1. Submit Task Request (HTTPS/REST)
    GW->>Orch: 2. Validate SIWE Auth & Route (gRPC)
    Note over Orch: 3 & 4. Analyze Intent & Build DAG Graph
    Orch->>Swarm: 5. Assign & Dispatch Swarm (A2A Bus)
    Note over Swarm: 6. Autonomous P2P Agent Handoff
    Swarm->>Vec: 7. Query Vector Store (RAG Search)
    Vec-->>Swarm: Return Relevant Context
    Swarm->>LLM: 8. Route Prompt for Dynamic LLM Inference
    LLM-->>Swarm: Return Generated Responses
    Swarm->>Orch: 9. Return Swarm Outputs to Aggregator
    Orch->>Contract: 10. Submit Cryptographic Execution Proof
    Note over Contract: 11. Release Escrow Payouts & Update Reputation
    Orch-->>User: 12. Deliver Final Response & Deliverables
```

---

## 6. Data Flow Diagram (DFD Level 1/2)

Data movement across processes, external entities, and persistent data stores.

```mermaid
graph LR
    E1["E1: User Client"] -->|Prompt & Task Specs| P1["1.0 Ingestion & Auth"]
    P1 -->|Session Token| D1[("D1: Redis Cache")]
    P1 -->|Raw Task| P2["2.0 DAG Task Decomposition"]
    P2 -->|DAG Graph| D2[("D2: PostgreSQL Store")]
    P2 -->|Sub-task Nodes| P3["3.0 Swarm Execution"]
    P3 -->|Vector Query| P4["4.0 Semantic RAG Query"]
    P4 -->|Embeddings| D3[("D3: Qdrant Vector DB")]
    P3 -->|Execution Proof| P5["5.0 Settlement & Proof"]
    P5 -->|Escrow Payout| E3["E3: Polygon L2 Ledger"]
```

---

## 7. Microservice Architecture Diagram

Decoupled service mesh topology with Envoy sidecars, gRPC endpoints, and Kafka event streaming topics.

```mermaid
graph TB
    subgraph Mesh["Istio Service Mesh Boundary"]
        S1["🚪 Auth & Gateway Service"]
        S2["⚙️ Task Orchestration Service"]
        S3["🐝 Swarm Agent Controller Service"]
        S4["💾 Memory & RAG Service"]
        S5["🤖 Dynamic LLM Router Service"]
        S6["📜 Web3 Settlement Service"]
    end

    subgraph Bus["Apache Kafka Event Bus"]
        T1["Topic: task.submitted"]
        T2["Topic: swarm.a2a.messages"]
        T3["Topic: execution.proofs"]
    end

    S1 --> T1
    S2 --> T2
    S3 --> T2
    S3 --> T3
    S6 --> T3
```

---

## 8. Blockchain Transaction Flow

Complete Web3 transaction flow: SIWE authentication, ERC-725 DID resolution, escrow deposits, Proof-of-Execution, revenue splits, and reputation updates.

```mermaid
graph TD
    Step1["1. SIWE Wallet Auth & Session Key"] --> Step2["2. Sovereign Agent DID (ERC-725) & NFT Check"]
    Step2 --> Step3["3. Escrow Smart Contract Lock (USDC Deposit)"]
    Step3 --> Step4["4. Off-Chain Execution & Proof-of-Execution (PoE) Hash"]
    Step4 --> Step5["5. Escrow Release & Revenue Split (85% Dev / 10% Stakers / 5% DAO)"]
    Step5 --> Step6["6. On-Chain Reputation Update (EigenTrust Score)"]
```

---

## 9. AI Agent Collaboration Flow (A2A Protocol)

Peer-to-peer inter-agent messaging, shared workspace CRDT synchronization, sub-task handoffs, and swarm consensus voting.

```mermaid
graph TD
    subgraph Swarm["Autonomous Swarm Cluster"]
        RA["🔍 Research Agent"]
        CA["💻 Coding Agent"]
        FA["💰 Finance Agent"]
        LA["⚖️ Legal Agent"]
        DA["🚀 DevOps Agent"]
        SA["🛡️ Cybersecurity Agent"]
    end

    subgraph A2A["A2A Event Bus & CRDT Space"]
        Broadcast["Topic: swarm.task.broadcast"]
        Handoff["Topic: swarm.p2p.handoff"]
        Workspace["CRDT Shared Workspace Document"]
        Vote["Topic: swarm.consensus.vote"]
    end

    RA --> Broadcast
    CA --> Handoff
    FA --> Workspace
    LA --> Workspace
    DA --> Vote
    SA --> Vote
```

---

## 10. Kubernetes Deployment Architecture

K8s cluster topology: Ingress NGINX, HPA/KEDA Pod Autoscalers, Agent Worker Pods, StatefulSets for Vector DB and Kafka, and Prometheus monitoring operators.

```mermaid
graph TB
    subgraph K8s["☸️ Kubernetes Cluster Topology"]
        subgraph NS1["Namespace: agentchain-gateway"]
            Ingress["NGINX Ingress Controller (4 Replicas)"]
            APIGW["Deployment: api-gateway (HPA Min:3 / Max:20)"]
            Orch["Deployment: orchestrator-engine"]
        end

        subgraph NS2["Namespace: agentchain-workers"]
            WASM["🐝 WASM Agent Worker Pods (KEDA Scaled)"]
            SpecAgents["Deployment: specialized-agents (GPU/CPU Pools)"]
        end

        subgraph NS3["Namespace: agentchain-data-system"]
            QdrantSet["StatefulSet: Qdrant Vector Cluster (3 Replicas)"]
            KafkaSet["StatefulSet: Apache Kafka Cluster (3 Brokers)"]
            PromOperator["Prometheus & Grafana Operators"]
        end
    end
```
