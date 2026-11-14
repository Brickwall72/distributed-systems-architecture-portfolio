// File: services/core/audit-ledger/server/src/messaging/durableConsumers.ts

export const TOPOLOGY_DURABLE_CONSUMERS = {
  AUDIT_CREATED: 'audit-ledger-transfer-created-consumer',
  AUDIT_UPDATED: 'audit-ledger-transfer-updated-consumer',
  AUDIT_COMPLETED: 'audit-ledger-transfer-completed-consumer',
} as const;

export const COMPLIANCE_DURABLE_CONSUMERS = {
  AUDIT_INITIATED: 'audit-ledger-transfer-initiated-consumer',
  AUDIT_RECEIVED: 'audit-ledger-transfer-received-consumer',
} as const;