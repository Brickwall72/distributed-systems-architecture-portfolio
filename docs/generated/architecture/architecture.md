# Generated service architecture

This view is generated from `docs/architecture/model.json`; application image nodes are discovered from `skaffold.yaml` during CI. Update the model when page composition or service interactions change.

```mermaid
flowchart LR
  classDef application fill:#172554,stroke:#60a5fa,color:#fff
  classDef shell fill:#312e81,stroke:#a78bfa,color:#fff
  classDef broker fill:#78350f,stroke:#f59e0b,color:#fff

  subgraph images[Application images from Skaffold]
    compliance_client["compliance-client"]:::application
    compliance_server["compliance-server"]:::application
    compliance_shell["compliance-shell"]:::shell
    esign_server["esign-server"]:::application
    global_shell["global-shell"]:::shell
    pdf_server["pdf-server"]:::application
    topology_client["topology-client"]:::application
    topology_server["topology-server"]:::application
    topology_shell["topology-shell"]:::shell
  end
  nats["NATS JetStream"]:::broker
  global_shell ==>|Mission Operations: Fleet Topology tab| topology_shell
  global_shell ==>|Mission Operations: Flight Compliance tab| compliance_shell
  topology_shell ==>|Topology Dashboard: AssetRegistration| topology_client
  topology_shell ==>|Topology Dashboard: NetworkCanvas| topology_client
  compliance_shell ==>|Unified Custody: TemplateSelector| compliance_client
  compliance_shell ==>|Unified Custody: OrganizationSelector| topology_client
  compliance_shell ==>|Unified Custody: AssetSelector| topology_client
  compliance_shell ==>|Unified Custody: ComplianceWorkflowWidget| compliance_client
  compliance_shell ==>|Documents: DocumentsTable| compliance_client
  compliance_shell ==>|Transfer Receipt: DocumentsTable| compliance_client
  compliance_shell ==>|Transfer Receipt: OrganizationSelector| topology_client
  compliance_shell ==>|Transfer Receipt: AssetSelector| topology_client
  compliance_shell ==>|Transfer Receipt: ComplianceWorkflowWidget| compliance_client
  compliance_client -->|Compliance REST API| compliance_server
  topology_client -->|Topology REST API| topology_server
  compliance_server <-->|Generate PDF| pdf_server
  compliance_server <-->|Sign document| esign_server
  compliance_server -.->|Publish transfer initiated / received| nats
  nats -.->|Deliver transfer initiated / received| topology_server
  topology_server -.->|Publish transfer event updates| nats
  nats -.->|Deliver transfer event updates| compliance_server
  linkStyle 0 stroke:#a78bfa,stroke-width:3px
  linkStyle 1 stroke:#a78bfa,stroke-width:3px
  linkStyle 2 stroke:#a78bfa,stroke-width:3px
  linkStyle 3 stroke:#a78bfa,stroke-width:3px
  linkStyle 4 stroke:#a78bfa,stroke-width:3px
  linkStyle 5 stroke:#a78bfa,stroke-width:3px
  linkStyle 6 stroke:#a78bfa,stroke-width:3px
  linkStyle 7 stroke:#a78bfa,stroke-width:3px
  linkStyle 8 stroke:#a78bfa,stroke-width:3px
  linkStyle 9 stroke:#a78bfa,stroke-width:3px
  linkStyle 10 stroke:#a78bfa,stroke-width:3px
  linkStyle 11 stroke:#a78bfa,stroke-width:3px
  linkStyle 12 stroke:#a78bfa,stroke-width:3px
  linkStyle 13 stroke:#2563eb,stroke-width:2px
  linkStyle 14 stroke:#2563eb,stroke-width:2px
  linkStyle 15 stroke:#c2410c,stroke-width:2px
  linkStyle 16 stroke:#c2410c,stroke-width:2px
  linkStyle 17 stroke:#0f766e,stroke-width:2px,stroke-dasharray: 6 4
  linkStyle 18 stroke:#0f766e,stroke-width:2px,stroke-dasharray: 6 4
  linkStyle 19 stroke:#0f766e,stroke-width:2px,stroke-dasharray: 6 4
  linkStyle 20 stroke:#0f766e,stroke-width:2px,stroke-dasharray: 6 4
```

## Interaction legend

- **HTTP / REST**
- **NATS request / reply**
- **NATS pub / sub**

**UI composition** uses thick purple arrows, labeled by page and widget. NATS pub/sub is shown as separate publisher-to-broker and broker-to-subscriber edges.
