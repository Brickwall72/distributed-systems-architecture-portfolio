# Requirements Traceability Matrix (RTM)

## Status
Accepted | **Date:** 2026-08-15 | **Author:** Sam Brickett

---

## 1. Traceability Ledger

| Requirement ID | Requirement Description | Target Subsystem | Implementation Code Module Link | Verification Test Suite Link | Compliance Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | The validation gate must check graph rules and telemetry concurrently before authorizing document execution. | `compliance-service` | `services/core/compliance-service/src/gateway.ts` | `services/core/compliance-service/test/gateway.test.ts` | 🟡 PENDING BUILD |
| **REQ-002** | The platform rendering tool must remain completely stateless and utilize immediate Request-Response HTTP binary streaming. | `platform/pdf-generator` | `services/platform/pdf-generator/src/renderer.ts` | `services/platform/pdf-generator/test/renderer.ts` | 🟡 PENDING BUILD |
| **REQ-003a** | The visual host interface must instantiate a unique tracking identifier (UUIDv4) at the entry point of a transaction request. | `ui-shell` | `services/core/ui-shell/src/utils/correlation.ts` | `services/core/ui-shell/test/correlation.test.ts` | 🟡 PENDING BUILD |
| **REQ-003b** | The process coordinator must intercept the inbound transaction token and transitively propagate it through all downstream HTTP headers and internal log statements. | `compliance-service` | `services/core/compliance-service/src/middleware/correlationPropagation.ts` | `services/core/compliance-service/test/correlationPropagation.test.ts` | 🟡 PENDING BUILD |
| **REQ-003c** | Downstream utility and domain nodes must intercept the universal tracking identifier, attach it to local logs, and echo it back within the HTTP response headers. | `infrastructure` | `shared/middleware/correlationEcho.ts` | `shared/middleware/test/correlationEcho.test.ts` | 🟡 PENDING BUILD |
| **REQ-004** | Post-signature ledger updates must be settlement-resilient and execute via an asynchronous Publish/Subscribe broker topic channel. | `audit-ledger` | `services/core/audit-ledger/src/consumer.ts` | `services/core/audit-ledger/test/consumer.test.ts` | 🟡 PENDING BUILD |
| **REQ-005** | Documents must be visually verified on screen before the digital signature gateway is allowed to unlock. | `ui-shell` | `services/core/ui-shell/src/components/SignGate.tsx` | `services/core/ui-shell/test/SignGate.test.tsx` | 🟡 PENDING BUILD |
