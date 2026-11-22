# Internal dependency and boundary-call reference

First-party components and managed infrastructure; potential static impact, not a third-party SBOM or proof of a breaking change.

Dependencies point from consumer to provider. Change impact follows the reverse direction. Paths are possibilities, not a claim that implementation changes break every downstream contract.

[Architecture overview](../architecture/architecture.md) | [HTML reference](dependencies.html) | [Machine-readable graph](dependencies.json)

## Components

| Component | Kind | Source |
| --- | --- | --- |
| `dsap-minio-setup` | deployment | [skaffold.yaml:1](../../../skaffold.yaml#L1) |
| `MongoDB (audit)` | storage | [docs/architecture/model.json:1](../../../docs/architecture/model.json#L1) |
| `PostgreSQL (compliance)` | storage | [docs/architecture/model.json:1](../../../docs/architecture/model.json#L1) |
| `MinIO object storage` | storage | [docs/architecture/model.json:1](../../../docs/architecture/model.json#L1) |
| `NATS JetStream` | broker | [docs/architecture/model.json:1](../../../docs/architecture/model.json#L1) |
| `Neo4j (topology)` | storage | [docs/architecture/model.json:1](../../../docs/architecture/model.json#L1) |
| `DocumentsReview.page` | shell-page | [ui-shells/domain-shells/compliance-shell/src/pages/DocumentsReview/DocumentsReview.page.tsx:8](../../../ui-shells/domain-shells/compliance-shell/src/pages/DocumentsReview/DocumentsReview.page.tsx#L8) |
| `TransferAuthorization.page` | shell-page | [ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx:26](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx#L26) |
| `TransferReceipt.page` | shell-page | [ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx:20](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx#L20) |
| `App` | shell-page | [ui-shells/global-shell/src/App.tsx:9](../../../ui-shells/global-shell/src/App.tsx#L9) |
| `AssetRegistrationDashboard` | shell-page | [ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx:11](../../../ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx#L11) |
| `TransferHistory` | shell-page | [ui-shells/domain-shells/topology-shell/src/pages/TransferHistory.tsx:9](../../../ui-shells/domain-shells/topology-shell/src/pages/TransferHistory.tsx#L9) |
| `TransfersTable` | widget | [services/core/audit-ledger/client/vite.config.ts:8](../../../services/core/audit-ledger/client/vite.config.ts#L8) |
| `ProfileSelector` | widget | [services/platform/auth-service/client/vite.config.ts:8](../../../services/platform/auth-service/client/vite.config.ts#L8) |
| `ComplianceWorkflowWidget` | widget | [services/core/compliance-service/client/vite.config.ts:9](../../../services/core/compliance-service/client/vite.config.ts#L9) |
| `DocumentsTable` | widget | [services/core/compliance-service/client/vite.config.ts:8](../../../services/core/compliance-service/client/vite.config.ts#L8) |
| `TemplateSelector` | widget | [services/core/compliance-service/client/vite.config.ts:10](../../../services/core/compliance-service/client/vite.config.ts#L10) |
| `App` | widget | [ui-shells/domain-shells/compliance-shell/vite.config.ts:8](../../../ui-shells/domain-shells/compliance-shell/vite.config.ts#L8) |
| `AssetRegistration` | widget | [services/core/topology-service/client/vite.config.ts:8](../../../services/core/topology-service/client/vite.config.ts#L8) |
| `AssetSelector` | widget | [services/core/topology-service/client/vite.config.ts:10](../../../services/core/topology-service/client/vite.config.ts#L10) |
| `NetworkCanvas` | widget | [services/core/topology-service/client/vite.config.ts:9](../../../services/core/topology-service/client/vite.config.ts#L9) |
| `OrganizationSelector` | widget | [services/core/topology-service/client/vite.config.ts:11](../../../services/core/topology-service/client/vite.config.ts#L11) |
| `App` | widget | [ui-shells/domain-shells/topology-shell/vite.config.ts:8](../../../ui-shells/domain-shells/topology-shell/vite.config.ts#L8) |
| `@contracts/auth` | contract | [packages/contracts/auth/package.json:1](../../../packages/contracts/auth/package.json#L1) |
| `@contracts/common` | contract | [packages/contracts/common/package.json:1](../../../packages/contracts/common/package.json#L1) |
| `@contracts/compliance` | contract | [packages/contracts/compliance/package.json:1](../../../packages/contracts/compliance/package.json#L1) |
| `@contracts/esign` | contract | [packages/contracts/esign/package.json:1](../../../packages/contracts/esign/package.json#L1) |
| `@contracts/pdf` | contract | [packages/contracts/pdf/package.json:1](../../../packages/contracts/pdf/package.json#L1) |
| `@contracts/topology` | contract | [packages/contracts/topology/package.json:1](../../../packages/contracts/topology/package.json#L1) |
| `@shared/diagnostics` | workspace | [packages/diagnostics/package.json:1](../../../packages/diagnostics/package.json#L1) |
| `@shared/express` | workspace | [packages/express/package.json:1](../../../packages/express/package.json#L1) |
| `@shared/filestore` | workspace | [packages/file-storage/package.json:1](../../../packages/file-storage/package.json#L1) |
| `@shared/messaging` | workspace | [packages/messaging/package.json:1](../../../packages/messaging/package.json#L1) |
| `@shared/mf-runtime` | workspace | [packages/mf-runtime/package.json:1](../../../packages/mf-runtime/package.json#L1) |
| `@shared/styles` | workspace | [packages/styles/package.json:1](../../../packages/styles/package.json#L1) |
| `@shared/testing` | workspace | [packages/testing/package.json:1](../../../packages/testing/package.json#L1) |
| `@shared/tsconfig` | workspace | [packages/tsconfig/package.json:1](../../../packages/tsconfig/package.json#L1) |
| `@shared/tsup-config` | workspace | [packages/tsup-config/package.json:1](../../../packages/tsup-config/package.json#L1) |
| `@shared/ui-components` | workspace | [packages/ui/package.json:1](../../../packages/ui/package.json#L1) |
| `@shared/utils` | workspace | [packages/utils/package.json:1](../../../packages/utils/package.json#L1) |
| `@shared/vite-config` | workspace | [packages/vite-config/package.json:1](../../../packages/vite-config/package.json#L1) |
| `@shared/zod` | workspace | [packages/zod/package.json:1](../../../packages/zod/package.json#L1) |
| `audit-client` | workspace | [services/core/audit-ledger/client/package.json:1](../../../services/core/audit-ledger/client/package.json#L1) |
| `audit-server` | workspace | [services/core/audit-ledger/server/package.json:1](../../../services/core/audit-ledger/server/package.json#L1) |
| `audit-shared` | workspace | [services/core/audit-ledger/shared/package.json:1](../../../services/core/audit-ledger/shared/package.json#L1) |
| `auth-client` | workspace | [services/platform/auth-service/client/package.json:1](../../../services/platform/auth-service/client/package.json#L1) |
| `auth-server` | workspace | [services/platform/auth-service/server/package.json:1](../../../services/platform/auth-service/server/package.json#L1) |
| `auth-shared` | workspace | [services/platform/auth-service/shared/package.json:1](../../../services/platform/auth-service/shared/package.json#L1) |
| `compliance-client` | workspace | [services/core/compliance-service/client/package.json:1](../../../services/core/compliance-service/client/package.json#L1) |
| `compliance-server` | workspace | [services/core/compliance-service/server/package.json:1](../../../services/core/compliance-service/server/package.json#L1) |
| `compliance-shared` | workspace | [services/core/compliance-service/shared/package.json:1](../../../services/core/compliance-service/shared/package.json#L1) |
| `compliance-shell` | workspace | [ui-shells/domain-shells/compliance-shell/package.json:1](../../../ui-shells/domain-shells/compliance-shell/package.json#L1) |
| `esign-client` | workspace | [services/platform/esign-service/client/package.json:1](../../../services/platform/esign-service/client/package.json#L1) |
| `esign-server` | workspace | [services/platform/esign-service/server/package.json:1](../../../services/platform/esign-service/server/package.json#L1) |
| `global-shell` | workspace | [ui-shells/global-shell/package.json:1](../../../ui-shells/global-shell/package.json#L1) |
| `pdf-server` | workspace | [services/platform/pdf-generator/server/package.json:1](../../../services/platform/pdf-generator/server/package.json#L1) |
| `topology-client` | workspace | [services/core/topology-service/client/package.json:1](../../../services/core/topology-service/client/package.json#L1) |
| `topology-server` | workspace | [services/core/topology-service/server/package.json:1](../../../services/core/topology-service/server/package.json#L1) |
| `topology-shared` | workspace | [services/core/topology-service/shared/package.json:1](../../../services/core/topology-service/shared/package.json#L1) |
| `topology-shell` | workspace | [ui-shells/domain-shells/topology-shell/package.json:1](../../../ui-shells/domain-shells/topology-shell/package.json#L1) |

## Dependency connections

| Consumer | Provider | Relationship | Evidence status |
| --- | --- | --- | --- |
| `DocumentsReview.page` | `TransfersTable` | embeds | verified |
| `DocumentsReview.page` | `DocumentsTable` | embeds | verified |
| `TransferAuthorization.page` | `ComplianceWorkflowWidget` | embeds | verified |
| `TransferAuthorization.page` | `TemplateSelector` | embeds | verified |
| `TransferAuthorization.page` | `AssetSelector` | embeds | verified |
| `TransferAuthorization.page` | `OrganizationSelector` | embeds | verified |
| `TransferReceipt.page` | `ComplianceWorkflowWidget` | embeds | verified |
| `TransferReceipt.page` | `DocumentsTable` | embeds | verified |
| `TransferReceipt.page` | `AssetSelector` | embeds | verified |
| `TransferReceipt.page` | `OrganizationSelector` | embeds | verified |
| `App` | `ProfileSelector` | embeds | verified |
| `App` | `App` | embeds | verified |
| `App` | `App` | embeds | verified |
| `AssetRegistrationDashboard` | `AssetRegistration` | embeds | verified |
| `AssetRegistrationDashboard` | `NetworkCanvas` | embeds | verified |
| `AssetRegistrationDashboard` | `OrganizationSelector` | embeds | verified |
| `TransferHistory` | `NetworkCanvas` | embeds | verified |
| `TransfersTable` | `audit-client` | implemented-by | verified |
| `ProfileSelector` | `auth-client` | implemented-by | verified |
| `ComplianceWorkflowWidget` | `compliance-client` | implemented-by | verified |
| `DocumentsTable` | `compliance-client` | implemented-by | verified |
| `TemplateSelector` | `compliance-client` | implemented-by | verified |
| `App` | `compliance-shell` | implemented-by | verified |
| `AssetRegistration` | `topology-client` | implemented-by | verified |
| `AssetSelector` | `topology-client` | implemented-by | verified |
| `NetworkCanvas` | `topology-client` | implemented-by | verified |
| `OrganizationSelector` | `topology-client` | implemented-by | verified |
| `App` | `topology-shell` | implemented-by | verified |
| `@contracts/compliance` | `@contracts/common` | contract-dependency | verified |
| `@contracts/compliance` | `@contracts/topology` | contract-dependency | verified |
| `@contracts/esign` | `@contracts/common` | contract-dependency | verified |
| `@contracts/pdf` | `@contracts/common` | contract-dependency | verified |
| `@contracts/topology` | `@contracts/common` | contract-dependency | verified |
| `@shared/express` | `@contracts/auth` | contract-dependency | verified |
| `@shared/express` | `@shared/diagnostics` | workspace-dependency | verified |
| `@shared/express` | `@shared/testing` | build-dependency | verified |
| `@shared/filestore` | `@contracts/common` | contract-dependency | verified |
| `@shared/messaging` | `NATS JetStream` | nats-publish | unresolved |
| `@shared/messaging` | `NATS JetStream` | nats-request | unresolved |
| `@shared/messaging` | `NATS JetStream` | nats-subscribe | unresolved |
| `@shared/messaging` | `@contracts/common` | contract-dependency | verified |
| `@shared/messaging` | `@contracts/common` | contract-dependency | verified |
| `@shared/messaging` | `@contracts/common` | contract-dependency | verified |
| `@shared/messaging` | `@contracts/common` | contract-dependency | verified |
| `@shared/messaging` | `@shared/diagnostics` | workspace-dependency | verified |
| `@shared/messaging` | `@shared/express` | build-dependency | verified |
| `@shared/testing` | `@contracts/auth` | contract-dependency | verified |
| `@shared/ui-components` | `@contracts/auth` | contract-dependency | verified |
| `@shared/ui-components` | `@shared/styles` | build-dependency | verified |
| `@shared/ui-components` | `@shared/utils` | workspace-dependency | verified |
| `audit-client` | `MinIO object storage` | http | declared |
| `audit-client` | `@contracts/auth` | contract-dependency | verified |
| `audit-client` | `@shared/testing` | build-dependency | verified |
| `audit-client` | `@shared/ui-components` | workspace-dependency | verified |
| `audit-client` | `@shared/vite-config` | build-dependency | verified |
| `audit-client` | `audit-server` | http | declared |
| `audit-client` | `audit-shared` | contract-dependency | verified |
| `audit-client` | `audit-shared` | contract-dependency | verified |
| `audit-client` | `audit-shared` | workspace-dependency | verified |
| `audit-server` | `MongoDB (audit)` | storage | declared |
| `audit-server` | `NATS JetStream` | nats-request | verified |
| `audit-server` | `NATS JetStream` | nats-subscribe | unresolved |
| `audit-server` | `NATS JetStream` | nats-subscribe | verified |
| `audit-server` | `NATS JetStream` | transport-dependency | declared |
| `audit-server` | `NATS JetStream` | transport-dependency | declared |
| `audit-server` | `@contracts/common` | contract-dependency | verified |
| `audit-server` | `@contracts/compliance` | contract-dependency | verified |
| `audit-server` | `@contracts/compliance` | contract-dependency | verified |
| `audit-server` | `@contracts/compliance` | contract-dependency | verified |
| `audit-server` | `@contracts/pdf` | contract-dependency | verified |
| `audit-server` | `@contracts/pdf` | contract-dependency | verified |
| `audit-server` | `@contracts/topology` | contract-dependency | verified |
| `audit-server` | `@contracts/topology` | contract-dependency | verified |
| `audit-server` | `@contracts/topology` | contract-dependency | verified |
| `audit-server` | `@shared/express` | workspace-dependency | verified |
| `audit-server` | `@shared/filestore` | workspace-dependency | verified |
| `audit-server` | `@shared/messaging` | workspace-dependency | verified |
| `audit-server` | `@shared/testing` | build-dependency | verified |
| `audit-server` | `@shared/utils` | workspace-dependency | verified |
| `audit-server` | `audit-shared` | contract-dependency | verified |
| `audit-server` | `audit-shared` | contract-dependency | verified |
| `audit-server` | `audit-shared` | contract-dependency | verified |
| `audit-server` | `audit-shared` | workspace-dependency | verified |
| `audit-server` | `pdf-server` | nats-request-reply | declared |
| `audit-server` | `pdf-server` | request-contract | verified |
| `audit-shared` | `@contracts/common` | contract-dependency | verified |
| `audit-shared` | `@contracts/compliance` | contract-dependency | verified |
| `audit-shared` | `@contracts/topology` | contract-dependency | verified |
| `auth-client` | `@contracts/auth` | contract-dependency | verified |
| `auth-client` | `@contracts/auth` | contract-dependency | verified |
| `auth-client` | `@contracts/auth` | contract-dependency | verified |
| `auth-client` | `@shared/testing` | build-dependency | verified |
| `auth-client` | `@shared/ui-components` | workspace-dependency | verified |
| `auth-client` | `@shared/vite-config` | build-dependency | verified |
| `auth-client` | `auth-server` | http | declared |
| `auth-client` | `auth-shared` | contract-dependency | verified |
| `auth-client` | `auth-shared` | contract-dependency | verified |
| `auth-client` | `auth-shared` | workspace-dependency | verified |
| `auth-server` | `@contracts/auth` | contract-dependency | verified |
| `auth-server` | `@contracts/common` | contract-dependency | verified |
| `auth-server` | `@shared/express` | workspace-dependency | verified |
| `auth-server` | `@shared/testing` | build-dependency | verified |
| `auth-server` | `auth-shared` | workspace-dependency | verified |
| `auth-shared` | `@contracts/auth` | contract-dependency | verified |
| `auth-shared` | `@contracts/common` | contract-dependency | verified |
| `compliance-client` | `MinIO object storage` | http | declared |
| `compliance-client` | `@contracts/auth` | contract-dependency | verified |
| `compliance-client` | `@contracts/common` | contract-dependency | verified |
| `compliance-client` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-client` | `@contracts/esign` | contract-dependency | verified |
| `compliance-client` | `@contracts/topology` | contract-dependency | verified |
| `compliance-client` | `@shared/testing` | build-dependency | verified |
| `compliance-client` | `@shared/ui-components` | workspace-dependency | verified |
| `compliance-client` | `@shared/utils` | workspace-dependency | verified |
| `compliance-client` | `@shared/vite-config` | build-dependency | verified |
| `compliance-client` | `compliance-server` | http | declared |
| `compliance-client` | `compliance-shared` | contract-dependency | verified |
| `compliance-client` | `compliance-shared` | contract-dependency | verified |
| `compliance-client` | `compliance-shared` | contract-dependency | verified |
| `compliance-client` | `compliance-shared` | contract-dependency | verified |
| `compliance-client` | `compliance-shared` | contract-dependency | verified |
| `compliance-client` | `compliance-shared` | contract-dependency | verified |
| `compliance-client` | `compliance-shared` | contract-dependency | verified |
| `compliance-client` | `compliance-shared` | contract-dependency | verified |
| `compliance-client` | `compliance-shared` | workspace-dependency | verified |
| `compliance-client` | `esign-client` | workspace-dependency | verified |
| `compliance-server` | `PostgreSQL (compliance)` | storage | declared |
| `compliance-server` | `NATS JetStream` | nats-publish | unresolved |
| `compliance-server` | `NATS JetStream` | nats-request | unresolved |
| `compliance-server` | `NATS JetStream` | nats-request | verified |
| `compliance-server` | `NATS JetStream` | nats-subscribe | verified |
| `compliance-server` | `NATS JetStream` | transport-dependency | declared |
| `compliance-server` | `NATS JetStream` | transport-dependency | declared |
| `compliance-server` | `@contracts/common` | contract-dependency | verified |
| `compliance-server` | `@contracts/common` | contract-dependency | verified |
| `compliance-server` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-server` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-server` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-server` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-server` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-server` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-server` | `@contracts/esign` | contract-dependency | verified |
| `compliance-server` | `@contracts/esign` | contract-dependency | verified |
| `compliance-server` | `@contracts/esign` | contract-dependency | verified |
| `compliance-server` | `@contracts/pdf` | contract-dependency | verified |
| `compliance-server` | `@contracts/topology` | contract-dependency | verified |
| `compliance-server` | `@contracts/topology` | contract-dependency | verified |
| `compliance-server` | `@contracts/topology` | contract-dependency | verified |
| `compliance-server` | `@contracts/topology` | contract-dependency | verified |
| `compliance-server` | `@contracts/topology` | contract-dependency | verified |
| `compliance-server` | `@contracts/topology` | contract-dependency | verified |
| `compliance-server` | `@contracts/topology` | contract-dependency | verified |
| `compliance-server` | `@contracts/topology` | contract-dependency | verified |
| `compliance-server` | `@shared/express` | workspace-dependency | verified |
| `compliance-server` | `@shared/filestore` | workspace-dependency | verified |
| `compliance-server` | `@shared/messaging` | workspace-dependency | verified |
| `compliance-server` | `@shared/utils` | workspace-dependency | verified |
| `compliance-server` | `compliance-shared` | contract-dependency | verified |
| `compliance-server` | `compliance-shared` | workspace-dependency | verified |
| `compliance-server` | `esign-server` | nats-request-reply | declared |
| `compliance-server` | `esign-server` | request-contract | verified |
| `compliance-server` | `pdf-server` | nats-request-reply | declared |
| `compliance-server` | `topology-server` | nats-request-reply | declared |
| `compliance-server` | `topology-server` | request-contract | verified |
| `compliance-server` | `topology-server` | request-contract | verified |
| `compliance-shared` | `@contracts/common` | contract-dependency | verified |
| `compliance-shared` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-shared` | `@contracts/esign` | contract-dependency | verified |
| `compliance-shared` | `@contracts/topology` | contract-dependency | verified |
| `compliance-shell` | `DocumentsReview.page` | implements-page | verified |
| `compliance-shell` | `TransferAuthorization.page` | implements-page | verified |
| `compliance-shell` | `TransferReceipt.page` | implements-page | verified |
| `compliance-shell` | `@contracts/common` | contract-dependency | verified |
| `compliance-shell` | `@contracts/common` | contract-dependency | verified |
| `compliance-shell` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-shell` | `@contracts/compliance` | contract-dependency | verified |
| `compliance-shell` | `@contracts/topology` | contract-dependency | verified |
| `compliance-shell` | `@contracts/topology` | contract-dependency | verified |
| `compliance-shell` | `@shared/mf-runtime` | workspace-dependency | verified |
| `compliance-shell` | `@shared/styles` | workspace-dependency | verified |
| `compliance-shell` | `@shared/testing` | build-dependency | verified |
| `compliance-shell` | `@shared/ui-components` | workspace-dependency | verified |
| `compliance-shell` | `@shared/vite-config` | workspace-dependency | verified |
| `compliance-shell` | `audit-client` | federation | verified |
| `compliance-shell` | `compliance-client` | federation | verified |
| `compliance-shell` | `topology-client` | federation | verified |
| `esign-client` | `@contracts/esign` | contract-dependency | verified |
| `esign-client` | `@shared/ui-components` | workspace-dependency | verified |
| `esign-client` | `@shared/vite-config` | build-dependency | verified |
| `esign-server` | `MinIO object storage` | storage | declared |
| `esign-server` | `NATS JetStream` | nats-responder | verified |
| `esign-server` | `@contracts/esign` | contract-dependency | verified |
| `esign-server` | `@contracts/esign` | contract-dependency | verified |
| `esign-server` | `@contracts/esign` | contract-dependency | verified |
| `esign-server` | `@shared/express` | workspace-dependency | verified |
| `esign-server` | `@shared/filestore` | workspace-dependency | verified |
| `esign-server` | `@shared/messaging` | workspace-dependency | verified |
| `esign-server` | `@shared/zod` | workspace-dependency | verified |
| `global-shell` | `App` | implements-page | verified |
| `global-shell` | `@shared/mf-runtime` | workspace-dependency | verified |
| `global-shell` | `@shared/styles` | workspace-dependency | verified |
| `global-shell` | `@shared/ui-components` | workspace-dependency | verified |
| `global-shell` | `@shared/vite-config` | workspace-dependency | verified |
| `global-shell` | `auth-client` | federation | verified |
| `global-shell` | `compliance-shell` | federation | verified |
| `global-shell` | `topology-shell` | federation | verified |
| `pdf-server` | `MinIO object storage` | storage | declared |
| `pdf-server` | `NATS JetStream` | nats-responder | unresolved |
| `pdf-server` | `NATS JetStream` | nats-responder | verified |
| `pdf-server` | `@contracts/pdf` | contract-dependency | verified |
| `pdf-server` | `@contracts/pdf` | contract-dependency | verified |
| `pdf-server` | `@contracts/pdf` | contract-dependency | verified |
| `pdf-server` | `@contracts/pdf` | contract-dependency | verified |
| `pdf-server` | `@shared/express` | workspace-dependency | verified |
| `pdf-server` | `@shared/filestore` | workspace-dependency | verified |
| `pdf-server` | `@shared/messaging` | workspace-dependency | verified |
| `pdf-server` | `@shared/zod` | workspace-dependency | verified |
| `topology-client` | `@contracts/auth` | contract-dependency | verified |
| `topology-client` | `@contracts/topology` | contract-dependency | verified |
| `topology-client` | `@contracts/topology` | contract-dependency | verified |
| `topology-client` | `@contracts/topology` | contract-dependency | verified |
| `topology-client` | `@contracts/topology` | contract-dependency | verified |
| `topology-client` | `@contracts/topology` | contract-dependency | verified |
| `topology-client` | `@shared/ui-components` | workspace-dependency | verified |
| `topology-client` | `@shared/vite-config` | build-dependency | verified |
| `topology-client` | `topology-server` | http | declared |
| `topology-client` | `topology-shared` | contract-dependency | verified |
| `topology-client` | `topology-shared` | contract-dependency | verified |
| `topology-client` | `topology-shared` | contract-dependency | verified |
| `topology-client` | `topology-shared` | contract-dependency | verified |
| `topology-client` | `topology-shared` | workspace-dependency | verified |
| `topology-server` | `NATS JetStream` | nats-publish | unresolved |
| `topology-server` | `NATS JetStream` | nats-responder | verified |
| `topology-server` | `NATS JetStream` | nats-subscribe | verified |
| `topology-server` | `NATS JetStream` | transport-dependency | declared |
| `topology-server` | `NATS JetStream` | transport-dependency | declared |
| `topology-server` | `Neo4j (topology)` | storage | declared |
| `topology-server` | `@contracts/common` | contract-dependency | verified |
| `topology-server` | `@contracts/compliance` | contract-dependency | verified |
| `topology-server` | `@contracts/compliance` | contract-dependency | verified |
| `topology-server` | `@contracts/topology` | contract-dependency | verified |
| `topology-server` | `@contracts/topology` | contract-dependency | verified |
| `topology-server` | `@contracts/topology` | contract-dependency | verified |
| `topology-server` | `@contracts/topology` | contract-dependency | verified |
| `topology-server` | `@contracts/topology` | contract-dependency | verified |
| `topology-server` | `@contracts/topology` | contract-dependency | verified |
| `topology-server` | `@contracts/topology` | contract-dependency | verified |
| `topology-server` | `@shared/express` | workspace-dependency | verified |
| `topology-server` | `@shared/messaging` | workspace-dependency | verified |
| `topology-server` | `@shared/testing` | build-dependency | verified |
| `topology-server` | `topology-shared` | workspace-dependency | verified |
| `topology-shared` | `@contracts/common` | contract-dependency | verified |
| `topology-shared` | `@contracts/topology` | contract-dependency | verified |
| `topology-shell` | `AssetRegistrationDashboard` | implements-page | verified |
| `topology-shell` | `TransferHistory` | implements-page | verified |
| `topology-shell` | `@contracts/topology` | contract-dependency | verified |
| `topology-shell` | `@contracts/topology` | contract-dependency | verified |
| `topology-shell` | `@shared/mf-runtime` | workspace-dependency | verified |
| `topology-shell` | `@shared/styles` | workspace-dependency | verified |
| `topology-shell` | `@shared/ui-components` | workspace-dependency | verified |
| `topology-shell` | `@shared/vite-config` | workspace-dependency | verified |
| `topology-shell` | `topology-client` | federation | verified |

## Potential downstream slices

### MongoDB (audit)

- `MongoDB (audit)` -[storage, declared]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `MongoDB (audit)` -[storage, declared]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `MongoDB (audit)` -[storage, declared]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `MongoDB (audit)` -[storage, declared]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `MongoDB (audit)` -[storage, declared]-> `audit-server` -[http, declared]-> `audit-client`
- `MongoDB (audit)` -[storage, declared]-> `audit-server`
- `MongoDB (audit)` -[storage, declared]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `MongoDB (audit)` -[storage, declared]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### PostgreSQL (compliance)

- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell`
- `PostgreSQL (compliance)` -[storage, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### MinIO object storage

- `MinIO object storage` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `MinIO object storage` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `MinIO object storage` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `MinIO object storage` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `MinIO object storage` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `MinIO object storage` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `MinIO object storage` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `MinIO object storage` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `MinIO object storage` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `MinIO object storage` -[http, declared]-> `audit-client`
- `MinIO object storage` -[storage, declared]-> `pdf-server` -[nats-request-reply, declared]-> `audit-server`
- `MinIO object storage` -[http, declared]-> `compliance-client`
- `MinIO object storage` -[storage, declared]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server`
- `MinIO object storage` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `MinIO object storage` -[storage, declared]-> `esign-server`
- `MinIO object storage` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `MinIO object storage` -[storage, declared]-> `pdf-server`

### Neo4j (topology)

- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector` -[embeds, verified]-> `TransferReceipt.page`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `compliance-shell`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client`
- `Neo4j (topology)` -[storage, declared]-> `topology-server`
- `Neo4j (topology)` -[storage, declared]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell`

### TransfersTable

- `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `TransfersTable` -[embeds, verified]-> `DocumentsReview.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `TransfersTable` -[embeds, verified]-> `DocumentsReview.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `TransfersTable` -[embeds, verified]-> `DocumentsReview.page` -[implements-page, verified]-> `compliance-shell`
- `TransfersTable` -[embeds, verified]-> `DocumentsReview.page` -[implements-page, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### ProfileSelector

- `ProfileSelector` -[embeds, verified]-> `App`
- `ProfileSelector` -[embeds, verified]-> `App` -[implements-page, verified]-> `global-shell`

### ComplianceWorkflowWidget

- `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell`
- `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### DocumentsTable

- `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `DocumentsTable` -[embeds, verified]-> `TransferReceipt.page`
- `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page` -[implements-page, verified]-> `compliance-shell`
- `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page` -[implements-page, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### TemplateSelector

- `TemplateSelector` -[embeds, verified]-> `TransferAuthorization.page`
- `TemplateSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `TemplateSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `TemplateSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell`
- `TemplateSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### App

- `App` -[embeds, verified]-> `App`
- `App` -[embeds, verified]-> `App` -[implements-page, verified]-> `global-shell`

### AssetRegistration

- `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell` -[federation, verified]-> `global-shell`
- `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell`

### AssetSelector

- `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page`
- `AssetSelector` -[embeds, verified]-> `TransferReceipt.page`
- `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell`
- `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### NetworkCanvas

- `NetworkCanvas` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `NetworkCanvas` -[embeds, verified]-> `AssetRegistrationDashboard`
- `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `NetworkCanvas` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `NetworkCanvas` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell` -[federation, verified]-> `global-shell`
- `NetworkCanvas` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell`

### OrganizationSelector

- `OrganizationSelector` -[embeds, verified]-> `TransferAuthorization.page`
- `OrganizationSelector` -[embeds, verified]-> `TransferReceipt.page`
- `OrganizationSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `OrganizationSelector` -[embeds, verified]-> `AssetRegistrationDashboard`
- `OrganizationSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `OrganizationSelector` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `OrganizationSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell`
- `OrganizationSelector` -[embeds, verified]-> `TransferAuthorization.page` -[implements-page, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `OrganizationSelector` -[embeds, verified]-> `AssetRegistrationDashboard` -[implements-page, verified]-> `topology-shell`

### App

- `App` -[embeds, verified]-> `App`
- `App` -[embeds, verified]-> `App` -[implements-page, verified]-> `global-shell`

### @contracts/auth

- `@contracts/auth` -[contract-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@contracts/auth` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@contracts/auth` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@contracts/auth` -[contract-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `@contracts/auth` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@contracts/auth` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@contracts/auth` -[contract-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@contracts/auth` -[contract-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@contracts/auth` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@contracts/auth` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@contracts/auth` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/testing` -[build-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@contracts/auth` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@contracts/auth` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@contracts/auth` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@contracts/auth` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/express`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/express` -[build-dependency, verified]-> `@shared/messaging`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/testing`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/ui-components`
- `@contracts/auth` -[contract-dependency, verified]-> `audit-client`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `audit-server`
- `@contracts/auth` -[contract-dependency, verified]-> `auth-client`
- `@contracts/auth` -[contract-dependency, verified]-> `auth-server`
- `@contracts/auth` -[contract-dependency, verified]-> `auth-shared`
- `@contracts/auth` -[contract-dependency, verified]-> `compliance-client`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/testing` -[build-dependency, verified]-> `compliance-shell`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `esign-client`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `esign-server`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `global-shell`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `pdf-server`
- `@contracts/auth` -[contract-dependency, verified]-> `topology-client`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server`
- `@contracts/auth` -[contract-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-shell`

### @contracts/common

- `@contracts/common` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@contracts/common` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@contracts/common` -[contract-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/compliance`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/esign`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/pdf`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology`
- `@contracts/common` -[contract-dependency, verified]-> `@shared/filestore`
- `@contracts/common` -[contract-dependency, verified]-> `@shared/messaging`
- `@contracts/common` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client`
- `@contracts/common` -[contract-dependency, verified]-> `audit-server`
- `@contracts/common` -[contract-dependency, verified]-> `audit-shared`
- `@contracts/common` -[contract-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client`
- `@contracts/common` -[contract-dependency, verified]-> `auth-server`
- `@contracts/common` -[contract-dependency, verified]-> `auth-shared`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-client`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-server`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-shared`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-shell`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/esign` -[contract-dependency, verified]-> `esign-client`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/esign` -[contract-dependency, verified]-> `esign-server`
- `@contracts/common` -[contract-dependency, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/pdf` -[contract-dependency, verified]-> `pdf-server`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-client`
- `@contracts/common` -[contract-dependency, verified]-> `topology-server`
- `@contracts/common` -[contract-dependency, verified]-> `topology-shared`
- `@contracts/common` -[contract-dependency, verified]-> `@contracts/topology` -[contract-dependency, verified]-> `topology-shell`

### @contracts/compliance

- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@contracts/compliance` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@contracts/compliance` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client`
- `@contracts/compliance` -[contract-dependency, verified]-> `audit-server`
- `@contracts/compliance` -[contract-dependency, verified]-> `audit-shared`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-client`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-server`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-shared`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-shell`
- `@contracts/compliance` -[contract-dependency, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server`
- `@contracts/compliance` -[contract-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell`

### @contracts/esign

- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-server`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-shared`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell`
- `@contracts/esign` -[contract-dependency, verified]-> `esign-client`
- `@contracts/esign` -[contract-dependency, verified]-> `esign-server`
- `@contracts/esign` -[contract-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### @contracts/pdf

- `@contracts/pdf` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@contracts/pdf` -[contract-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@contracts/pdf` -[contract-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@contracts/pdf` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@contracts/pdf` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@contracts/pdf` -[contract-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@contracts/pdf` -[contract-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@contracts/pdf` -[contract-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@contracts/pdf` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@contracts/pdf` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client`
- `@contracts/pdf` -[contract-dependency, verified]-> `audit-server`
- `@contracts/pdf` -[contract-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client`
- `@contracts/pdf` -[contract-dependency, verified]-> `compliance-server`
- `@contracts/pdf` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `@contracts/pdf` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `@contracts/pdf` -[contract-dependency, verified]-> `pdf-server`

### @contracts/topology

- `@contracts/topology` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@contracts/topology` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@contracts/topology` -[contract-dependency, verified]-> `@contracts/compliance`
- `@contracts/topology` -[contract-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client`
- `@contracts/topology` -[contract-dependency, verified]-> `audit-server`
- `@contracts/topology` -[contract-dependency, verified]-> `audit-shared`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-client`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-server`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-shared`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-shell`
- `@contracts/topology` -[contract-dependency, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-client`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-server`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-shared`
- `@contracts/topology` -[contract-dependency, verified]-> `topology-shell`

### @shared/diagnostics

- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/messaging`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `audit-server`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `auth-server`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `esign-server`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client` -[federation, verified]-> `global-shell`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `pdf-server`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server`
- `@shared/diagnostics` -[workspace-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell`

### @shared/express

- `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/express` -[workspace-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/express` -[workspace-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/express` -[build-dependency, verified]-> `@shared/messaging`
- `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client`
- `@shared/express` -[workspace-dependency, verified]-> `audit-server`
- `@shared/express` -[workspace-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client`
- `@shared/express` -[workspace-dependency, verified]-> `auth-server`
- `@shared/express` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client`
- `@shared/express` -[workspace-dependency, verified]-> `compliance-server`
- `@shared/express` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `@shared/express` -[workspace-dependency, verified]-> `esign-server`
- `@shared/express` -[workspace-dependency, verified]-> `auth-server` -[http, declared]-> `auth-client` -[federation, verified]-> `global-shell`
- `@shared/express` -[workspace-dependency, verified]-> `pdf-server`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server`
- `@shared/express` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell`

### @shared/filestore

- `@shared/filestore` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/filestore` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/filestore` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/filestore` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@shared/filestore` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/filestore` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/filestore` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/filestore` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/filestore` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/filestore` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client`
- `@shared/filestore` -[workspace-dependency, verified]-> `audit-server`
- `@shared/filestore` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client`
- `@shared/filestore` -[workspace-dependency, verified]-> `compliance-server`
- `@shared/filestore` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `@shared/filestore` -[workspace-dependency, verified]-> `esign-server`
- `@shared/filestore` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `@shared/filestore` -[workspace-dependency, verified]-> `pdf-server`

### @shared/messaging

- `@shared/messaging` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/messaging` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/messaging` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/messaging` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@shared/messaging` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/messaging` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/messaging` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/messaging` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/messaging` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/messaging` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client`
- `@shared/messaging` -[workspace-dependency, verified]-> `audit-server`
- `@shared/messaging` -[workspace-dependency, verified]-> `compliance-server` -[http, declared]-> `compliance-client`
- `@shared/messaging` -[workspace-dependency, verified]-> `compliance-server`
- `@shared/messaging` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `@shared/messaging` -[workspace-dependency, verified]-> `esign-server`
- `@shared/messaging` -[workspace-dependency, verified]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `@shared/messaging` -[workspace-dependency, verified]-> `pdf-server`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server`
- `@shared/messaging` -[workspace-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell`

### @shared/mf-runtime

- `@shared/mf-runtime` -[workspace-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@shared/mf-runtime` -[workspace-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/mf-runtime` -[workspace-dependency, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/mf-runtime` -[workspace-dependency, verified]-> `compliance-shell`
- `@shared/mf-runtime` -[workspace-dependency, verified]-> `global-shell`
- `@shared/mf-runtime` -[workspace-dependency, verified]-> `topology-shell`

### @shared/styles

- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/styles` -[workspace-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/styles` -[workspace-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@shared/styles` -[workspace-dependency, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `audit-client`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `auth-client`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client`
- `@shared/styles` -[workspace-dependency, verified]-> `compliance-shell`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `esign-client`
- `@shared/styles` -[workspace-dependency, verified]-> `global-shell`
- `@shared/styles` -[build-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client`
- `@shared/styles` -[workspace-dependency, verified]-> `topology-shell`

### @shared/testing

- `@shared/testing` -[build-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/testing` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/testing` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/testing` -[build-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@shared/testing` -[build-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/testing` -[build-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@shared/testing` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/testing` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/testing` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/testing` -[build-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/testing` -[build-dependency, verified]-> `@shared/express`
- `@shared/testing` -[build-dependency, verified]-> `@shared/express` -[build-dependency, verified]-> `@shared/messaging`
- `@shared/testing` -[build-dependency, verified]-> `audit-client`
- `@shared/testing` -[build-dependency, verified]-> `audit-server`
- `@shared/testing` -[build-dependency, verified]-> `auth-client`
- `@shared/testing` -[build-dependency, verified]-> `auth-server`
- `@shared/testing` -[build-dependency, verified]-> `compliance-client`
- `@shared/testing` -[build-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `compliance-server`
- `@shared/testing` -[build-dependency, verified]-> `compliance-shell`
- `@shared/testing` -[build-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `esign-server`
- `@shared/testing` -[build-dependency, verified]-> `auth-client` -[federation, verified]-> `global-shell`
- `@shared/testing` -[build-dependency, verified]-> `@shared/express` -[workspace-dependency, verified]-> `pdf-server`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client`
- `@shared/testing` -[build-dependency, verified]-> `topology-server`
- `@shared/testing` -[build-dependency, verified]-> `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell`

### @shared/tsconfig

No downstream relationship resolved.

### @shared/tsup-config

No downstream relationship resolved.

### @shared/ui-components

- `@shared/ui-components` -[workspace-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/ui-components` -[workspace-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@shared/ui-components` -[workspace-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/ui-components` -[workspace-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/ui-components` -[workspace-dependency, verified]-> `audit-client`
- `@shared/ui-components` -[workspace-dependency, verified]-> `auth-client`
- `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-client`
- `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-shell`
- `@shared/ui-components` -[workspace-dependency, verified]-> `esign-client`
- `@shared/ui-components` -[workspace-dependency, verified]-> `global-shell`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client`
- `@shared/ui-components` -[workspace-dependency, verified]-> `topology-shell`

### @shared/utils

- `@shared/utils` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/utils` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/utils` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@shared/utils` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/utils` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/utils` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `audit-client`
- `@shared/utils` -[workspace-dependency, verified]-> `audit-server`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `auth-client`
- `@shared/utils` -[workspace-dependency, verified]-> `compliance-client`
- `@shared/utils` -[workspace-dependency, verified]-> `compliance-server`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `compliance-shell`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `esign-client`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `global-shell`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-client`
- `@shared/utils` -[workspace-dependency, verified]-> `@shared/ui-components` -[workspace-dependency, verified]-> `topology-shell`

### @shared/vite-config

- `@shared/vite-config` -[build-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/vite-config` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/vite-config` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/vite-config` -[build-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `@shared/vite-config` -[build-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `@shared/vite-config` -[build-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `@shared/vite-config` -[build-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/vite-config` -[build-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `@shared/vite-config` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/vite-config` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/vite-config` -[build-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/vite-config` -[workspace-dependency, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/vite-config` -[build-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `@shared/vite-config` -[build-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `@shared/vite-config` -[build-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `@shared/vite-config` -[build-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `@shared/vite-config` -[workspace-dependency, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `@shared/vite-config` -[build-dependency, verified]-> `audit-client`
- `@shared/vite-config` -[build-dependency, verified]-> `auth-client`
- `@shared/vite-config` -[build-dependency, verified]-> `compliance-client`
- `@shared/vite-config` -[workspace-dependency, verified]-> `compliance-shell`
- `@shared/vite-config` -[build-dependency, verified]-> `esign-client`
- `@shared/vite-config` -[workspace-dependency, verified]-> `global-shell`
- `@shared/vite-config` -[build-dependency, verified]-> `topology-client`
- `@shared/vite-config` -[workspace-dependency, verified]-> `topology-shell`

### @shared/zod

- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `@shared/zod` -[workspace-dependency, verified]-> `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `@shared/zod` -[workspace-dependency, verified]-> `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client`
- `@shared/zod` -[workspace-dependency, verified]-> `pdf-server` -[nats-request-reply, declared]-> `audit-server`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server`
- `@shared/zod` -[workspace-dependency, verified]-> `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `@shared/zod` -[workspace-dependency, verified]-> `pdf-server`

### audit-client

- `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `audit-client` -[federation, verified]-> `compliance-shell`
- `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### audit-server

- `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `audit-server` -[http, declared]-> `audit-client`
- `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### audit-shared

- `audit-shared` -[contract-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `audit-shared` -[contract-dependency, verified]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `audit-shared` -[contract-dependency, verified]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `audit-shared` -[contract-dependency, verified]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `audit-shared` -[contract-dependency, verified]-> `audit-client`
- `audit-shared` -[contract-dependency, verified]-> `audit-server`
- `audit-shared` -[contract-dependency, verified]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `audit-shared` -[contract-dependency, verified]-> `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### auth-client

- `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `auth-client` -[federation, verified]-> `global-shell`

### auth-server

- `auth-server` -[http, declared]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `auth-server` -[http, declared]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `auth-server` -[http, declared]-> `auth-client`
- `auth-server` -[http, declared]-> `auth-client` -[federation, verified]-> `global-shell`

### auth-shared

- `auth-shared` -[contract-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector` -[embeds, verified]-> `App`
- `auth-shared` -[contract-dependency, verified]-> `auth-client` -[implemented-by, verified]-> `ProfileSelector`
- `auth-shared` -[contract-dependency, verified]-> `auth-client`
- `auth-shared` -[workspace-dependency, verified]-> `auth-server`
- `auth-shared` -[contract-dependency, verified]-> `auth-client` -[federation, verified]-> `global-shell`

### compliance-client

- `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `compliance-client` -[federation, verified]-> `compliance-shell`
- `compliance-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### compliance-server

- `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `compliance-server` -[http, declared]-> `compliance-client`
- `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell`
- `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### compliance-shared

- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-server`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell`
- `compliance-shared` -[contract-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### compliance-shell

- `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `compliance-shell` -[implemented-by, verified]-> `App`
- `compliance-shell` -[federation, verified]-> `global-shell`

### esign-client

- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell`
- `esign-client` -[workspace-dependency, verified]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### esign-server

- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell`
- `esign-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### global-shell

No downstream relationship resolved.

### pdf-server

- `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable` -[embeds, verified]-> `DocumentsReview.page`
- `pdf-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferAuthorization.page`
- `pdf-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget` -[embeds, verified]-> `TransferReceipt.page`
- `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client` -[implemented-by, verified]-> `TransfersTable`
- `pdf-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `pdf-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `pdf-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client`
- `pdf-server` -[nats-request-reply, declared]-> `audit-server`
- `pdf-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client`
- `pdf-server` -[nats-request-reply, declared]-> `compliance-server`
- `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell`
- `pdf-server` -[nats-request-reply, declared]-> `audit-server` -[http, declared]-> `audit-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`

### topology-client

- `topology-client` -[implemented-by, verified]-> `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page`
- `topology-client` -[implemented-by, verified]-> `AssetSelector` -[embeds, verified]-> `TransferReceipt.page`
- `topology-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `topology-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `topology-client` -[federation, verified]-> `compliance-shell`
- `topology-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `topology-client` -[federation, verified]-> `topology-shell`

### topology-server

- `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page`
- `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector` -[embeds, verified]-> `TransferReceipt.page`
- `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `topology-server` -[http, declared]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client`
- `topology-server` -[nats-request-reply, declared]-> `compliance-server`
- `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `compliance-shell`
- `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `topology-server` -[http, declared]-> `topology-client`
- `topology-server` -[http, declared]-> `topology-client` -[federation, verified]-> `topology-shell`

### topology-shared

- `topology-shared` -[workspace-dependency, verified]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable` -[embeds, verified]-> `DocumentsReview.page`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector` -[embeds, verified]-> `TransferAuthorization.page`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector` -[embeds, verified]-> `TransferReceipt.page`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration` -[embeds, verified]-> `AssetRegistrationDashboard`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas` -[embeds, verified]-> `TransferHistory`
- `topology-shared` -[workspace-dependency, verified]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `ComplianceWorkflowWidget`
- `topology-shared` -[workspace-dependency, verified]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `DocumentsTable`
- `topology-shared` -[workspace-dependency, verified]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client` -[implemented-by, verified]-> `TemplateSelector`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[federation, verified]-> `compliance-shell` -[implemented-by, verified]-> `App`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetRegistration`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `AssetSelector`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `NetworkCanvas`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[implemented-by, verified]-> `OrganizationSelector`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[federation, verified]-> `topology-shell` -[implemented-by, verified]-> `App`
- `topology-shared` -[workspace-dependency, verified]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server` -[http, declared]-> `compliance-client`
- `topology-shared` -[workspace-dependency, verified]-> `topology-server` -[nats-request-reply, declared]-> `compliance-server`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[federation, verified]-> `compliance-shell`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[federation, verified]-> `compliance-shell` -[federation, verified]-> `global-shell`
- `topology-shared` -[contract-dependency, verified]-> `topology-client`
- `topology-shared` -[workspace-dependency, verified]-> `topology-server`
- `topology-shared` -[contract-dependency, verified]-> `topology-client` -[federation, verified]-> `topology-shell`

### topology-shell

- `topology-shell` -[implemented-by, verified]-> `App` -[embeds, verified]-> `App`
- `topology-shell` -[implemented-by, verified]-> `App`
- `topology-shell` -[federation, verified]-> `global-shell`

## Boundary functions by segment

### @shared/filestore

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `ObjectStorageClient.uploadFile` | `this.client.send` | boundary | object-storage: unresolved  (unresolved) | - | [packages/file-storage/src/s3-storage-client/s3-storage-client.ts:47](../../../packages/file-storage/src/s3-storage-client/s3-storage-client.ts#L47) |
| `ObjectStorageClient.getFileStream` | `this.client.send` | boundary | object-storage: unresolved  (unresolved) | - | [packages/file-storage/src/s3-storage-client/s3-storage-client.ts:72](../../../packages/file-storage/src/s3-storage-client/s3-storage-client.ts#L72) |
| `ObjectStorageClient.getSignedDownloadUrl` | `getSignedUrl` | boundary | object-storage: unresolved  (unresolved) | - | [packages/file-storage/src/s3-storage-client/s3-storage-client.ts:101](../../../packages/file-storage/src/s3-storage-client/s3-storage-client.ts#L101) |

### @shared/messaging

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `EventBroker.request > callback@151 > callback@153` | `this.nc.request` | boundary | nats-request: nats subject (unresolved) | - | [packages/messaging/src/event-broker.ts:160](../../../packages/messaging/src/event-broker.ts#L160) |
| `EventBroker.respond` | `this.nc.subscribe` | boundary | nats-subscribe: nats subject (unresolved) | - | [packages/messaging/src/event-broker.ts:181](../../../packages/messaging/src/event-broker.ts#L181) |
| `EventBroker.publish > callback@242` | `this.js.publish` | boundary | nats-publish: nats subject (unresolved) | - | [packages/messaging/src/event-broker.ts:246](../../../packages/messaging/src/event-broker.ts#L246) |

### @shared/mf-runtime

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `lazyRemote > callback@8` | `loadRemote` | boundary | federation: unresolved  (unresolved) | - | [packages/mf-runtime/src/lazyRemote.ts:9](../../../packages/mf-runtime/src/lazyRemote.ts#L9) |
| `useFederationRegistry > callback@21 > bootstrapDomainRegistry` | `fetch` | boundary | http: unresolved registryUrl (unresolved) | `useFederationRegistry > callback@21` [packages/mf-runtime/src/useFederationRegistry.ts:48](../../../packages/mf-runtime/src/useFederationRegistry.ts#L48) | [packages/mf-runtime/src/useFederationRegistry.ts:26](../../../packages/mf-runtime/src/useFederationRegistry.ts#L26) |

### audit-client

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `useGetTransferPdf > queryFn` | `apiClient.getTransferDocument` | boundary | http: unresolved /audit/api/v1/transfers/:requisitionNumber/document (unresolved) | - | [services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts:15](../../../services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts#L15) |
| `useGetTransferPdf > queryFn` | `fetch` | boundary | http: unresolved response.body.presignedUrl (unresolved) | - | [services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts:20](../../../services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts#L20) |
| `useGetTransfers > queryFn` | `apiClient.getTransfers` | boundary | http: unresolved /audit/api/v1/transfers (unresolved) | - | [services/core/audit-ledger/client/src/hooks/transfers/useGetTransfers.ts:14](../../../services/core/audit-ledger/client/src/hooks/transfers/useGetTransfers.ts#L14) |

### audit-server

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `connectDatabase` | `candidate.connect` | boundary | database: unresolved  (unresolved) | `connectDatabaseWithRetry > attemptConnection` [services/core/audit-ledger/server/src/db/database.ts:48](../../../services/core/audit-ledger/server/src/db/database.ts#L48) | [services/core/audit-ledger/server/src/db/database.ts:31](../../../services/core/audit-ledger/server/src/db/database.ts#L31) |
| `connectDatabase` | `handle.command` | boundary | database: unresolved  (unresolved) | `connectDatabaseWithRetry > attemptConnection` [services/core/audit-ledger/server/src/db/database.ts:48](../../../services/core/audit-ledger/server/src/db/database.ts#L48) | [services/core/audit-ledger/server/src/db/database.ts:33](../../../services/core/audit-ledger/server/src/db/database.ts#L33) |
| `ensureIndexes > callback@19` | `db.collection` | boundary | database: unresolved  (unresolved) | - | [services/core/audit-ledger/server/src/db/indexes.ts:20](../../../services/core/audit-ledger/server/src/db/indexes.ts#L20) |
| `ensureIndexes` | `db.collection` | boundary | database: unresolved  (unresolved) | - | [services/core/audit-ledger/server/src/db/indexes.ts:37](../../../services/core/audit-ledger/server/src/db/indexes.ts#L37) |
| `ensureIndexes` | `db.collection` | boundary | database: unresolved  (unresolved) | - | [services/core/audit-ledger/server/src/db/indexes.ts:38](../../../services/core/audit-ledger/server/src/db/indexes.ts#L38) |
| `AuditEventConsumer.start` | `this.listen` | local wrapper | nats-subscribe: nats events.topology.transfer.created (verified) | - | [services/core/audit-ledger/server/src/messaging/consumer.ts:33](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L33) |
| `AuditEventConsumer.start` | `this.listen` | local wrapper | nats-subscribe: nats events.topology.transfer.updated (verified) | - | [services/core/audit-ledger/server/src/messaging/consumer.ts:40](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L40) |
| `AuditEventConsumer.start` | `this.listen` | local wrapper | nats-subscribe: nats events.topology.transfer.completed (verified) | - | [services/core/audit-ledger/server/src/messaging/consumer.ts:47](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L47) |
| `AuditEventConsumer.start` | `this.listen` | local wrapper | nats-subscribe: nats events.compliance.transfer.initiated (verified) | - | [services/core/audit-ledger/server/src/messaging/consumer.ts:54](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L54) |
| `AuditEventConsumer.start` | `this.listen` | local wrapper | nats-subscribe: nats events.compliance.transfer.received (verified) | - | [services/core/audit-ledger/server/src/messaging/consumer.ts:61](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L61) |
| `AuditEventConsumer.listen` | `this.broker.subscribe` | boundary | nats-subscribe: nats subject (unresolved) | `AuditEventConsumer.start` [services/core/audit-ledger/server/src/messaging/consumer.ts:33](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L33), `AuditEventConsumer.start` [services/core/audit-ledger/server/src/messaging/consumer.ts:40](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L40), `AuditEventConsumer.start` [services/core/audit-ledger/server/src/messaging/consumer.ts:47](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L47), `AuditEventConsumer.start` [services/core/audit-ledger/server/src/messaging/consumer.ts:54](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L54), `AuditEventConsumer.start` [services/core/audit-ledger/server/src/messaging/consumer.ts:61](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L61) | [services/core/audit-ledger/server/src/messaging/consumer.ts:81](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L81) |
| `DeadLettersRepository.collection` | `this.db.collection` | boundary | database: unresolved  (unresolved) | - | [services/core/audit-ledger/server/src/repositories/dead-letters/dead-letters.repository.ts:10](../../../services/core/audit-ledger/server/src/repositories/dead-letters/dead-letters.repository.ts#L10) |
| `DraftsRepository.collection` | `this.db.collection` | boundary | database: unresolved  (unresolved) | - | [services/core/audit-ledger/server/src/repositories/drafts/drafts.repository.ts:15](../../../services/core/audit-ledger/server/src/repositories/drafts/drafts.repository.ts#L15) |
| `EventsRepository.append` | `this.db.collection` | boundary | database: unresolved  (unresolved) | - | [services/core/audit-ledger/server/src/repositories/events/events.repository.ts:13](../../../services/core/audit-ledger/server/src/repositories/events/events.repository.ts#L13) |
| `RenditionsRepository.collection` | `this.db.collection` | boundary | database: unresolved  (unresolved) | - | [services/core/audit-ledger/server/src/repositories/renditions/renditions.repository.ts:32](../../../services/core/audit-ledger/server/src/repositories/renditions/renditions.repository.ts#L32) |
| `SealedTransfersRepository.collection` | `this.db.collection` | boundary | database: unresolved  (unresolved) | - | [services/core/audit-ledger/server/src/repositories/sealed/sealed.repository.ts:12](../../../services/core/audit-ledger/server/src/repositories/sealed/sealed.repository.ts#L12) |
| `bootstrapApplicationServer > getSignedDownloadUrl` | `storage.getSignedDownloadUrl` | boundary | object-storage: unresolved  (unresolved) | `<module>` [services/core/audit-ledger/server/src/server.ts:158](../../../services/core/audit-ledger/server/src/server.ts#L158) | [services/core/audit-ledger/server/src/server.ts:141](../../../services/core/audit-ledger/server/src/server.ts#L141) |
| `RenditionService.process > callback@106 > callback@106 > callback@128` | `this.broker.request` | boundary | nats-request: nats pdf.command.generate-audit (verified) | `RenditionService.tick` [services/core/audit-ledger/server/src/services/rendition.service.ts:101](../../../services/core/audit-ledger/server/src/services/rendition.service.ts#L101) | [services/core/audit-ledger/server/src/services/rendition.service.ts:129](../../../services/core/audit-ledger/server/src/services/rendition.service.ts#L129) |

### auth-client

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `useProfileSession > callback@19` | `apiClient.getIdentities` | boundary | http: unresolved getIdentities (unresolved) | - | [services/platform/auth-service/client/src/hooks/useProfileSession.ts:21](../../../services/platform/auth-service/client/src/hooks/useProfileSession.ts#L21) |
| `useProfileSession > signIn` | `apiClient.createSession` | boundary | http: unresolved createSession (unresolved) | - | [services/platform/auth-service/client/src/hooks/useProfileSession.ts:42](../../../services/platform/auth-service/client/src/hooks/useProfileSession.ts#L42) |

### compliance-client

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `useDocumentSync > queryFn` | `apiClient.getDocumentById` | boundary | http: unresolved /compliance/api/v1/documents/:id (unresolved) | - | [services/core/compliance-service/client/src/hooks/documents/useDocumentSync.ts:15](../../../services/core/compliance-service/client/src/hooks/documents/useDocumentSync.ts#L15) |
| `useDocuments > fetchDocuments` | `apiClient.getDocuments` | boundary | http: unresolved /compliance/api/v1/documents (unresolved) | - | [services/core/compliance-service/client/src/hooks/documents/useDocuments.ts:40](../../../services/core/compliance-service/client/src/hooks/documents/useDocuments.ts#L40) |
| `useGeneratePdf > generatePdf` | `apiClient.createTemplateDraft` | boundary | http: unresolved /compliance/api/v1/templates/:id/drafts (unresolved) | - | [services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts:29](../../../services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts#L29) |
| `useGeneratePdf > generatePdf` | `fetch` | boundary | http: unresolved response.body.presignedUrl (unresolved) | - | [services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts:36](../../../services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts#L36) |
| `useGetPdf > queryFn` | `apiClient.getDocumentContentById` | boundary | http: unresolved /compliance/api/v1/documents/:id/content (unresolved) | - | [services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts:21](../../../services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts#L21) |
| `useGetPdf > queryFn` | `fetch` | boundary | http: unresolved response.body.presignedUrl (unresolved) | - | [services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts:30](../../../services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts#L30) |
| `useSignPdf > signPdf` | `apiClient.signDocument` | boundary | http: unresolved /compliance/api/v1/documents/sign (unresolved) | - | [services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts:31](../../../services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts#L31) |
| `useSignPdf > signPdf` | `fetch` | boundary | http: unresolved responseBody.presignedUrl (unresolved) | - | [services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts:46](../../../services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts#L46) |
| `useTemplateQuery > fetcher` | `apiClient.getTemplate` | boundary | http: unresolved /compliance/api/v1/templates/:id (unresolved) | - | [services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.ts:25](../../../services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.ts#L25) |
| `useTemplatesQuery > fetcher` | `apiClient.getTemplates` | boundary | http: unresolved /compliance/api/v1/templates (unresolved) | - | [services/core/compliance-service/client/src/hooks/templates/useTemplatesQuery.ts:10](../../../services/core/compliance-service/client/src/hooks/templates/useTemplatesQuery.ts#L10) |

### compliance-server

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `initDatabase` | `pool.query` | boundary | database: unresolved  (unresolved) | `initializeDatabaseWithRetry` [services/core/compliance-service/server/src/db/initDatabase.ts:99](../../../services/core/compliance-service/server/src/db/initDatabase.ts#L99) | [services/core/compliance-service/server/src/db/initDatabase.ts:12](../../../services/core/compliance-service/server/src/db/initDatabase.ts#L12) |
| `ComplianceEventConsumer.start` | `this.broker.subscribe` | boundary | nats-subscribe: nats events.topology.transfer.created (verified) | - | [services/core/compliance-service/server/src/messaging/consumer.ts:27](../../../services/core/compliance-service/server/src/messaging/consumer.ts#L27) |
| `ComplianceEventConsumer.start` | `this.broker.subscribe` | boundary | nats-subscribe: nats events.topology.transfer.updated (verified) | - | [services/core/compliance-service/server/src/messaging/consumer.ts:41](../../../services/core/compliance-service/server/src/messaging/consumer.ts#L41) |
| `ComplianceEventConsumer.start` | `this.broker.subscribe` | boundary | nats-subscribe: nats events.topology.transfer.completed (verified) | - | [services/core/compliance-service/server/src/messaging/consumer.ts:55](../../../services/core/compliance-service/server/src/messaging/consumer.ts#L55) |
| `TopologyNatsClient.validateDraft > callback@18` | `this.request` | local wrapper | nats-request: nats requests.topology.transfer.validate-draft (verified) | - | [services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts:19](../../../services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts#L19) |
| `TopologyNatsClient.reserve > callback@29` | `this.request` | local wrapper | nats-request: nats requests.topology.transfer.reserve (verified) | - | [services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts:31](../../../services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts#L31) |
| `TopologyNatsClient.request` | `this.broker.request` | boundary | nats-request: nats subject (unresolved) | `TopologyNatsClient.validateDraft > callback@18` [services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts:19](../../../services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts#L19), `TopologyNatsClient.reserve > callback@29` [services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts:31](../../../services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts#L31) | [services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts:42](../../../services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts#L42) |
| `DocumentsRepository.saveDraftBinding` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:47](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L47) |
| `DocumentsRepository.findDraftBinding` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:54](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L54) |
| `DocumentsRepository.insert` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:110](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L110) |
| `DocumentsRepository.updateForDocNumber` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:123](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L123) |
| `DocumentsRepository.markTopologyApplied` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:129](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L129) |
| `DocumentsRepository.updateForReqNumber` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:167](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L167) |
| `DocumentsRepository.findAll` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:207](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L207) |
| `DocumentsRepository.findAll` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:207](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L207) |
| `DocumentsRepository.findById` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:226](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L226) |
| `DocumentsRepository.recordTransferParticipants` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:238](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L238) |
| `DocumentsRepository.findTransferParticipants` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:256](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L256) |
| `DocumentsRepository.getRequisitionNumberById` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:270](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L270) |
| `SignedOutboxRepository.finalize` | `this.db.connect` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:26](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L26) |
| `SignedOutboxRepository.finalize` | `client.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:28](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L28) |
| `SignedOutboxRepository.finalize` | `client.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:29](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L29) |
| `SignedOutboxRepository.finalize` | `client.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:43](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L43) |
| `SignedOutboxRepository.finalize` | `client.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:64](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L64) |
| `SignedOutboxRepository.finalize` | `client.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:104](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L104) |
| `SignedOutboxRepository.finalize` | `client.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:117](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L117) |
| `SignedOutboxRepository.finalize` | `client.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:123](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L123) |
| `SignedOutboxRepository.finalize` | `client.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:125](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L125) |
| `SignedOutboxRepository.claimNext` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:134](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L134) |
| `SignedOutboxRepository.flagStalled` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:152](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L152) |
| `SignedOutboxRepository.markPublished` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:161](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L161) |
| `SignedOutboxRepository.defer` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:169](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L169) |
| `SigningOperationsRepository.enqueue` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:45](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L45) |
| `SigningOperationsRepository.find` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:57](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L57) |
| `SigningOperationsRepository.claimNext` | `this.db.query` | boundary | database: unresolved  (unresolved) | - | [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:63](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L63) |
| `SigningOperationsRepository.updateWithLease` | `this.db.query` | boundary | database: unresolved  (unresolved) | `SigningOperationsRepository.saveSigned` [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:81](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L81), `SigningOperationsRepository.complete` [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:90](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L90), `SigningOperationsRepository.defer` [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:100](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L100) | [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:113](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L113) |
| `bootstrapApplicationServer > getSignedDownloadUrl` | `publicStorageClient.getSignedDownloadUrl` | boundary | object-storage: unresolved  (unresolved) | `<module>` [services/core/compliance-service/server/src/server.ts:161](../../../services/core/compliance-service/server/src/server.ts#L161) | [services/core/compliance-service/server/src/server.ts:147](../../../services/core/compliance-service/server/src/server.ts#L147) |
| `NatsSigningCoordinator.processNext > process > callback@30 > callback@36` | `this.broker.request` | boundary | nats-request: nats esign.command.sign-document (verified) | `NatsSigningCoordinator.processNext` [services/core/compliance-service/server/src/services/signing/coordinator/nats-signing-coordinator.ts:61](../../../services/core/compliance-service/server/src/services/signing/coordinator/nats-signing-coordinator.ts#L61) | [services/core/compliance-service/server/src/services/signing/coordinator/nats-signing-coordinator.ts:37](../../../services/core/compliance-service/server/src/services/signing/coordinator/nats-signing-coordinator.ts#L37) |
| `SignedOutboxService.publishNext > callback@22 > callback@26` | `this.broker.publish` | boundary | nats-publish: nats item.subject (unresolved) | `SignedOutboxService.schedule > callback@67 > callback@67` [services/core/compliance-service/server/src/services/signing/outbox/signed-outbox.service.ts:69](../../../services/core/compliance-service/server/src/services/signing/outbox/signed-outbox.service.ts#L69) | [services/core/compliance-service/server/src/services/signing/outbox/signed-outbox.service.ts:42](../../../services/core/compliance-service/server/src/services/signing/outbox/signed-outbox.service.ts#L42) |

### compliance-shell

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `<module>` | `lazyRemote` | boundary | federation: compliance-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/DocumentsReview/DocumentsReview.page.tsx:7](../../../ui-shells/domain-shells/compliance-shell/src/pages/DocumentsReview/DocumentsReview.page.tsx#L7) |
| `<module>` | `lazyRemote` | boundary | federation: audit-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/DocumentsReview/DocumentsReview.page.tsx:8](../../../ui-shells/domain-shells/compliance-shell/src/pages/DocumentsReview/DocumentsReview.page.tsx#L8) |
| `<module>` | `lazyRemote` | boundary | federation: topology-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx:23](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx#L23) |
| `<module>` | `lazyRemote` | boundary | federation: topology-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx:24](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx#L24) |
| `<module>` | `lazyRemote` | boundary | federation: compliance-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx:25](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx#L25) |
| `<module>` | `lazyRemote` | boundary | federation: compliance-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx:26](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.tsx#L26) |
| `<module>` | `lazyRemote` | boundary | federation: compliance-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx:17](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx#L17) |
| `<module>` | `lazyRemote` | boundary | federation: topology-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx:18](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx#L18) |
| `<module>` | `lazyRemote` | boundary | federation: topology-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx:19](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx#L19) |
| `<module>` | `lazyRemote` | boundary | federation: compliance-client  (verified) | - | [ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx:20](../../../ui-shells/domain-shells/compliance-shell/src/pages/TransferReceipt/TransferReceipt.page.tsx#L20) |

### esign-server

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `registerESignResponder` | `broker.respond` | boundary | nats-responder: nats esign.command.sign-document (verified) | - | [services/platform/esign-service/server/src/messaging/responder.ts:68](../../../services/platform/esign-service/server/src/messaging/responder.ts#L68) |
| `registerESignResponder > callback@68 > callback@69 > callback@109` | `publicStorageClient.getSignedDownloadUrl` | boundary | object-storage: unresolved  (unresolved) | - | [services/platform/esign-service/server/src/messaging/responder.ts:109](../../../services/platform/esign-service/server/src/messaging/responder.ts#L109) |

### global-shell

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `<module>` | `lazyRemote` | boundary | federation: topology-shell  (verified) | - | [ui-shells/global-shell/src/App.tsx:7](../../../ui-shells/global-shell/src/App.tsx#L7) |
| `<module>` | `lazyRemote` | boundary | federation: auth-client  (verified) | - | [ui-shells/global-shell/src/App.tsx:8](../../../ui-shells/global-shell/src/App.tsx#L8) |
| `<module>` | `lazyRemote` | boundary | federation: compliance-shell  (verified) | - | [ui-shells/global-shell/src/App.tsx:9](../../../ui-shells/global-shell/src/App.tsx#L9) |
| `<module>` | `fetch` | boundary | http: unresolved /registry/apps.json (unresolved) | - | [ui-shells/global-shell/src/main.tsx:7](../../../ui-shells/global-shell/src/main.tsx#L7) |

### pdf-server

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `registerPdfResponder > register` | `broker.respond` | boundary | nats-responder: nats subject (unresolved) | `registerPdfResponder` [services/platform/pdf-generator/server/src/messaging/responder.ts:54](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L54), `registerPdfResponder` [services/platform/pdf-generator/server/src/messaging/responder.ts:55](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L55) | [services/platform/pdf-generator/server/src/messaging/responder.ts:26](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L26) |
| `registerPdfResponder > register > callback@26 > callback@27 > callback@44` | `publicStorageClient.getSignedDownloadUrl` | boundary | object-storage: unresolved  (unresolved) | `registerPdfResponder` [services/platform/pdf-generator/server/src/messaging/responder.ts:54](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L54), `registerPdfResponder` [services/platform/pdf-generator/server/src/messaging/responder.ts:55](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L55) | [services/platform/pdf-generator/server/src/messaging/responder.ts:44](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L44) |
| `registerPdfResponder` | `register` | local wrapper | nats-responder: nats pdf.command.generate-draft (verified) | - | [services/platform/pdf-generator/server/src/messaging/responder.ts:54](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L54) |
| `registerPdfResponder` | `register` | local wrapper | nats-responder: nats pdf.command.generate-audit (verified) | - | [services/platform/pdf-generator/server/src/messaging/responder.ts:55](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L55) |

### topology-client

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `useCreateAsset > createAsset` | `apiClient.createAsset` | boundary | http: unresolved /topology/api/v1/assets (unresolved) | - | [services/core/topology-service/client/src/hooks/useCreateAsset/useCreateAsset.ts:15](../../../services/core/topology-service/client/src/hooks/useCreateAsset/useCreateAsset.ts#L15) |
| `useGetAssets > fetcher` | `apiClient.getAssets` | boundary | http: unresolved /topology/api/v1/assets (unresolved) | - | [services/core/topology-service/client/src/hooks/useGetAssets/useGetAssets.ts:11](../../../services/core/topology-service/client/src/hooks/useGetAssets/useGetAssets.ts#L11) |
| `useGetOrganizations > fetcher` | `apiClient.getOrganizations` | boundary | http: unresolved /topology/api/v1/organizations (unresolved) | - | [services/core/topology-service/client/src/hooks/useGetOrganizations/useGetOrganizations.ts:11](../../../services/core/topology-service/client/src/hooks/useGetOrganizations/useGetOrganizations.ts#L11) |
| `useGraph > queryFn` | `apiClient.getGraph` | boundary | http: unresolved /topology/api/v1/graph (unresolved) | - | [services/core/topology-service/client/src/hooks/useGraph/useGraph.ts:15](../../../services/core/topology-service/client/src/hooks/useGraph/useGraph.ts#L15) |

### topology-server

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `seedSpaceCustodyGraphTopology > callback@41 > callback@41 > callback@41` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/database/seed.ts:41](../../../services/core/topology-service/server/src/database/seed.ts#L41) |
| `seedSpaceCustodyGraphTopology > callback@41 > callback@41` | `session.executeWrite` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/database/seed.ts:41](../../../services/core/topology-service/server/src/database/seed.ts#L41) |
| `seedSpaceCustodyGraphTopology` | `session.executeWrite` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/database/seed.ts:45](../../../services/core/topology-service/server/src/database/seed.ts#L45) |
| `seedSpaceCustodyGraphTopology > callback@45` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/database/seed.ts:45](../../../services/core/topology-service/server/src/database/seed.ts#L45) |
| `startSignedTransferConsumer` | `broker.subscribe` | boundary | nats-subscribe: nats events.compliance.transfer.signed (verified) | - | [services/core/topology-service/server/src/messaging/signed-transfer.consumer.ts:17](../../../services/core/topology-service/server/src/messaging/signed-transfer.consumer.ts#L17) |
| `registerTransferRequestResponders` | `broker.respond` | boundary | nats-responder: nats requests.topology.transfer.validate-draft (verified) | - | [services/core/topology-service/server/src/messaging/transfer-requests.responder.ts:17](../../../services/core/topology-service/server/src/messaging/transfer-requests.responder.ts#L17) |
| `registerTransferRequestResponders` | `broker.respond` | boundary | nats-responder: nats requests.topology.transfer.reserve (verified) | - | [services/core/topology-service/server/src/messaging/transfer-requests.responder.ts:40](../../../services/core/topology-service/server/src/messaging/transfer-requests.responder.ts#L40) |
| `BaseRepository.executeReadQuery` | `session.executeRead` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/base.repository.ts:17](../../../services/core/topology-service/server/src/repositories/base.repository.ts#L17) |
| `BaseRepository.executeReadQuery > callback@17` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/base.repository.ts:17](../../../services/core/topology-service/server/src/repositories/base.repository.ts#L17) |
| `BaseRepository.executeWriteQuery` | `session.executeWrite` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/base.repository.ts:34](../../../services/core/topology-service/server/src/repositories/base.repository.ts#L34) |
| `BaseRepository.executeWriteQuery > callback@34` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/base.repository.ts:34](../../../services/core/topology-service/server/src/repositories/base.repository.ts#L34) |
| `TransferClaimsRepository.reserveForSigning` | `session.executeWrite` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:25](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L25) |
| `TransferClaimsRepository.reserveForSigning > callback@25` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:26](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L26) |
| `TransferClaimsRepository.reserveForSigning > callback@25` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:51](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L51) |
| `TransferClaimsRepository.reserveForSigning > callback@25` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:57](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L57) |
| `TransferClaimsRepository.reserveForSigning > callback@25` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:72](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L72) |
| `TransferClaimsRepository.reserveForSigning > callback@25` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:83](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L83) |
| `TransferClaimsRepository.commitSigned` | `session.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:132](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L132) |
| `TransferClaimsRepository.commitClaim` | `session.executeWrite` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:155](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L155) |
| `TransferClaimsRepository.commitClaim > callback@155` | `tx.run` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:156](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L156) |
| `TransferClaimsRepository.commitClaim > callback@155` | `tx.run` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:177](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L177) |
| `TransferClaimsRepository.commitClaim > callback@155` | `tx.run` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:185](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L185) |
| `TransferClaimsRepository.commitClaim > callback@155` | `tx.run` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:196](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L196) |
| `TransferClaimsRepository.commitClaim > callback@155` | `tx.run` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:225](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L225) |
| `TransferClaimsRepository.commitClaim > callback@155` | `tx.run` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:246](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L246) |
| `TransferClaimsRepository.commitClaim > callback@155` | `tx.run` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:263](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L263) |
| `TransferClaimsRepository.commitClaim > callback@155` | `tx.run` | boundary | database: unresolved  (unresolved) | `TransferClaimsRepository.commitSigned` [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:139](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L139) | [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:289](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L289) |
| `TransferDraftRepository.validate` | `session.executeRead` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts:16](../../../services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts#L16) |
| `TransferDraftRepository.validate > callback@16` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts:17](../../../services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts#L17) |
| `TransferOutboxRepository.claimNext` | `session.executeWrite` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:39](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L39) |
| `TransferOutboxRepository.claimNext > callback@39` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:40](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L40) |
| `TransferOutboxRepository.claimNext > callback@39` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:54](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L54) |
| `TransferOutboxRepository.markPublished` | `session.executeWrite` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:104](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L104) |
| `TransferOutboxRepository.markPublished > callback@104` | `tx.run` | boundary | database: unresolved  (unresolved) | - | [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:105](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L105) |
| `TransferOutboxService.publishNext > callback@20 > callback@23` | `this.broker.publish` | boundary | nats-publish: nats item.subject (unresolved) | `TransferOutboxService.schedule > callback@45 > callback@45` [services/core/topology-service/server/src/services/transfer-outbox.service.ts:47](../../../services/core/topology-service/server/src/services/transfer-outbox.service.ts#L47) | [services/core/topology-service/server/src/services/transfer-outbox.service.ts:24](../../../services/core/topology-service/server/src/services/transfer-outbox.service.ts#L24) |

### topology-shell

| Function | Call | Role | Connection / target | Immediate callers | Source |
| --- | --- | --- | --- | --- | --- |
| `<module>` | `lazyRemote` | boundary | federation: topology-client  (verified) | - | [ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx:9](../../../ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx#L9) |
| `<module>` | `lazyRemote` | boundary | federation: topology-client  (verified) | - | [ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx:10](../../../ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx#L10) |
| `<module>` | `lazyRemote` | boundary | federation: topology-client  (verified) | - | [ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx:11](../../../ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx#L11) |
| `<module>` | `lazyRemote` | boundary | federation: topology-client  (verified) | - | [ui-shells/domain-shells/topology-shell/src/pages/TransferHistory.tsx:9](../../../ui-shells/domain-shells/topology-shell/src/pages/TransferHistory.tsx#L9) |

## Coverage gaps and assumptions

- Model broker arrows describe transport, not payload impact. Only resolved matching subjects establish automatic cross-service event dependencies. - [docs/architecture/model.json:1](../../../docs/architecture/model.json#L1)
- object-storage target cannot be proven from the call - [packages/file-storage/src/s3-storage-client/s3-storage-client.ts:47](../../../packages/file-storage/src/s3-storage-client/s3-storage-client.ts#L47)
- object-storage target cannot be proven from the call - [packages/file-storage/src/s3-storage-client/s3-storage-client.ts:72](../../../packages/file-storage/src/s3-storage-client/s3-storage-client.ts#L72)
- object-storage target cannot be proven from the call - [packages/file-storage/src/s3-storage-client/s3-storage-client.ts:101](../../../packages/file-storage/src/s3-storage-client/s3-storage-client.ts#L101)
- Dynamic or unsafe nats-request destination - [packages/messaging/src/event-broker.ts:160](../../../packages/messaging/src/event-broker.ts#L160)
- Dynamic or unsafe nats-subscribe destination - [packages/messaging/src/event-broker.ts:181](../../../packages/messaging/src/event-broker.ts#L181)
- Dynamic or unsafe nats-publish destination - [packages/messaging/src/event-broker.ts:246](../../../packages/messaging/src/event-broker.ts#L246)
- Dynamic or unsupported federation module - [packages/mf-runtime/src/lazyRemote.ts:9](../../../packages/mf-runtime/src/lazyRemote.ts#L9)
- Dynamic or unsafe http destination - [packages/mf-runtime/src/useFederationRegistry.ts:26](../../../packages/mf-runtime/src/useFederationRegistry.ts#L26)
- HTTP target cannot be proven from the call - [packages/mf-runtime/src/useFederationRegistry.ts:26](../../../packages/mf-runtime/src/useFederationRegistry.ts#L26)
- HTTP target cannot be proven from the call - [services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts:15](../../../services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts#L15)
- Dynamic or unsafe http destination - [services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts:20](../../../services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts#L20)
- HTTP target cannot be proven from the call - [services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts:20](../../../services/core/audit-ledger/client/src/hooks/transfers/useGetTransferPdf.ts#L20)
- HTTP target cannot be proven from the call - [services/core/audit-ledger/client/src/hooks/transfers/useGetTransfers.ts:14](../../../services/core/audit-ledger/client/src/hooks/transfers/useGetTransfers.ts#L14)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/db/database.ts:31](../../../services/core/audit-ledger/server/src/db/database.ts#L31)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/db/database.ts:33](../../../services/core/audit-ledger/server/src/db/database.ts#L33)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/db/indexes.ts:20](../../../services/core/audit-ledger/server/src/db/indexes.ts#L20)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/db/indexes.ts:37](../../../services/core/audit-ledger/server/src/db/indexes.ts#L37)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/db/indexes.ts:38](../../../services/core/audit-ledger/server/src/db/indexes.ts#L38)
- Dynamic or unsafe nats-subscribe destination - [services/core/audit-ledger/server/src/messaging/consumer.ts:81](../../../services/core/audit-ledger/server/src/messaging/consumer.ts#L81)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/repositories/dead-letters/dead-letters.repository.ts:10](../../../services/core/audit-ledger/server/src/repositories/dead-letters/dead-letters.repository.ts#L10)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/repositories/drafts/drafts.repository.ts:15](../../../services/core/audit-ledger/server/src/repositories/drafts/drafts.repository.ts#L15)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/repositories/events/events.repository.ts:13](../../../services/core/audit-ledger/server/src/repositories/events/events.repository.ts#L13)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/repositories/renditions/renditions.repository.ts:32](../../../services/core/audit-ledger/server/src/repositories/renditions/renditions.repository.ts#L32)
- database target cannot be proven from the call - [services/core/audit-ledger/server/src/repositories/sealed/sealed.repository.ts:12](../../../services/core/audit-ledger/server/src/repositories/sealed/sealed.repository.ts#L12)
- object-storage target cannot be proven from the call - [services/core/audit-ledger/server/src/server.ts:141](../../../services/core/audit-ledger/server/src/server.ts#L141)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/documents/useDocumentSync.ts:15](../../../services/core/compliance-service/client/src/hooks/documents/useDocumentSync.ts#L15)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/documents/useDocuments.ts:40](../../../services/core/compliance-service/client/src/hooks/documents/useDocuments.ts#L40)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts:29](../../../services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts#L29)
- Dynamic or unsafe http destination - [services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts:36](../../../services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts#L36)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts:36](../../../services/core/compliance-service/client/src/hooks/pdfs/useGeneratePdf.ts#L36)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts:21](../../../services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts#L21)
- Dynamic or unsafe http destination - [services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts:30](../../../services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts#L30)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts:30](../../../services/core/compliance-service/client/src/hooks/pdfs/useGetPdf.ts#L30)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts:31](../../../services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts#L31)
- Dynamic or unsafe http destination - [services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts:46](../../../services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts#L46)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts:46](../../../services/core/compliance-service/client/src/hooks/pdfs/useSignPdf.ts#L46)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.ts:25](../../../services/core/compliance-service/client/src/hooks/templates/useTemplateQuery.ts#L25)
- HTTP target cannot be proven from the call - [services/core/compliance-service/client/src/hooks/templates/useTemplatesQuery.ts:10](../../../services/core/compliance-service/client/src/hooks/templates/useTemplatesQuery.ts#L10)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/db/initDatabase.ts:12](../../../services/core/compliance-service/server/src/db/initDatabase.ts#L12)
- Dynamic or unsafe nats-request destination - [services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts:42](../../../services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts#L42)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:47](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L47)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:54](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L54)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:110](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L110)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:123](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L123)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:129](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L129)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:167](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L167)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:207](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L207)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:226](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L226)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:238](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L238)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:256](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L256)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/documents.repository.ts:270](../../../services/core/compliance-service/server/src/repositories/documents/documents.repository.ts#L270)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:26](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L26)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:28](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L28)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:29](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L29)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:43](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L43)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:64](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L64)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:104](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L104)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:117](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L117)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:123](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L123)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:125](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L125)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:134](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L134)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:152](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L152)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:161](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L161)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts:169](../../../services/core/compliance-service/server/src/repositories/documents/signed-outbox.repository.ts#L169)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:45](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L45)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:57](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L57)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:63](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L63)
- database target cannot be proven from the call - [services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts:113](../../../services/core/compliance-service/server/src/repositories/documents/signing-operations.repository.ts#L113)
- object-storage target cannot be proven from the call - [services/core/compliance-service/server/src/server.ts:147](../../../services/core/compliance-service/server/src/server.ts#L147)
- Dynamic or unsafe nats-publish destination - [services/core/compliance-service/server/src/services/signing/outbox/signed-outbox.service.ts:42](../../../services/core/compliance-service/server/src/services/signing/outbox/signed-outbox.service.ts#L42)
- HTTP target cannot be proven from the call - [services/core/topology-service/client/src/hooks/useCreateAsset/useCreateAsset.ts:15](../../../services/core/topology-service/client/src/hooks/useCreateAsset/useCreateAsset.ts#L15)
- HTTP target cannot be proven from the call - [services/core/topology-service/client/src/hooks/useGetAssets/useGetAssets.ts:11](../../../services/core/topology-service/client/src/hooks/useGetAssets/useGetAssets.ts#L11)
- HTTP target cannot be proven from the call - [services/core/topology-service/client/src/hooks/useGetOrganizations/useGetOrganizations.ts:11](../../../services/core/topology-service/client/src/hooks/useGetOrganizations/useGetOrganizations.ts#L11)
- HTTP target cannot be proven from the call - [services/core/topology-service/client/src/hooks/useGraph/useGraph.ts:15](../../../services/core/topology-service/client/src/hooks/useGraph/useGraph.ts#L15)
- database target cannot be proven from the call - [services/core/topology-service/server/src/database/seed.ts:41](../../../services/core/topology-service/server/src/database/seed.ts#L41)
- database target cannot be proven from the call - [services/core/topology-service/server/src/database/seed.ts:45](../../../services/core/topology-service/server/src/database/seed.ts#L45)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/base.repository.ts:17](../../../services/core/topology-service/server/src/repositories/base.repository.ts#L17)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/base.repository.ts:34](../../../services/core/topology-service/server/src/repositories/base.repository.ts#L34)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:25](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L25)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:26](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L26)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:51](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L51)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:57](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L57)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:72](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L72)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:83](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L83)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:132](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L132)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:155](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L155)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:156](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L156)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:177](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L177)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:185](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L185)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:196](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L196)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:225](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L225)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:246](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L246)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:263](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L263)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts:289](../../../services/core/topology-service/server/src/repositories/transfers/claims/transfer-claims.repository.ts#L289)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts:16](../../../services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts#L16)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts:17](../../../services/core/topology-service/server/src/repositories/transfers/draft/transfer-draft.repository.ts#L17)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:39](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L39)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:40](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L40)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:54](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L54)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:104](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L104)
- database target cannot be proven from the call - [services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts:105](../../../services/core/topology-service/server/src/repositories/transfers/outbox/transfer-outbox.repository.ts#L105)
- Dynamic or unsafe nats-publish destination - [services/core/topology-service/server/src/services/transfer-outbox.service.ts:24](../../../services/core/topology-service/server/src/services/transfer-outbox.service.ts#L24)
- Dynamic or unsafe http destination - [services/platform/auth-service/client/src/hooks/useProfileSession.ts:21](../../../services/platform/auth-service/client/src/hooks/useProfileSession.ts#L21)
- HTTP target cannot be proven from the call - [services/platform/auth-service/client/src/hooks/useProfileSession.ts:21](../../../services/platform/auth-service/client/src/hooks/useProfileSession.ts#L21)
- Dynamic or unsafe http destination - [services/platform/auth-service/client/src/hooks/useProfileSession.ts:42](../../../services/platform/auth-service/client/src/hooks/useProfileSession.ts#L42)
- HTTP target cannot be proven from the call - [services/platform/auth-service/client/src/hooks/useProfileSession.ts:42](../../../services/platform/auth-service/client/src/hooks/useProfileSession.ts#L42)
- object-storage target cannot be proven from the call - [services/platform/esign-service/server/src/messaging/responder.ts:109](../../../services/platform/esign-service/server/src/messaging/responder.ts#L109)
- Dynamic or unsafe nats-responder destination - [services/platform/pdf-generator/server/src/messaging/responder.ts:26](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L26)
- object-storage target cannot be proven from the call - [services/platform/pdf-generator/server/src/messaging/responder.ts:44](../../../services/platform/pdf-generator/server/src/messaging/responder.ts#L44)
- HTTP target cannot be proven from the call - [ui-shells/global-shell/src/main.tsx:7](../../../ui-shells/global-shell/src/main.tsx#L7)
