// File: services/core/compliance-service/client/src/api/client-config.ts
let currentBaseUrl = '';

export function setApiBaseUrl(url: string) {
  currentBaseUrl = url;
}

export function getApiBaseUrl(): string {
  return currentBaseUrl;
}