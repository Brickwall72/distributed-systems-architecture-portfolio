// File: services/core/compliance-service/server/src/messaging/durableConsumers.ts
export const TOPOLOGY_DURABLE_CONSUMERS = {
  COMPLIANCE_CREATED: 'compliance-service-transfer-event-created-consumer',
  COMPLIANCE_UPDATED: 'compliance-service-transfer-event-updated-consumer',
  COMPLIANCE_COMPLETED: 'compliance-service-transfer-event-completed-consumer',
} as const;