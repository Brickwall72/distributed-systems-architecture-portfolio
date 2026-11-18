import { ROOT_CONTEXT, SpanKind, SpanStatusCode, trace, type Context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { ExportResultCode, W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, ParentBasedSampler, TraceIdRatioBasedSampler, TracerProvider } from '@opentelemetry/sdk-trace';
import type { DiagnosticMetadata, Logger, OperationOutcome } from './logger';

const contexts = new AsyncLocalStorageContextManager();
const propagator = new W3CTraceContextPropagator();
let provider: TracerProvider | undefined;
let closing: Promise<void> | undefined;

export function startTracing(serviceName: string, logger: Logger, env = process.env): void {
  if (env.DSAP_TRACING_ENABLED !== 'true' || provider) return;
  const url = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const ratio = Number(env.OTEL_TRACES_SAMPLER_ARG ?? '1');
  if (!url || !URL.canParse(url) || !['http:', 'https:'].includes(new URL(url).protocol)
    || env.OTEL_TRACES_SAMPLER_ARG?.trim() === ''
    || !Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    logger.warn('Tracing disabled: expected an HTTP(S) trace endpoint and a sampling ratio between 0 and 1');
    return;
  }
  const exporter = new OTLPTraceExporter({ url, timeoutMillis: 1200, concurrencyLimit: 2 });
  let lastWarning = -Infinity;
  provider = new TracerProvider({
    resource: resourceFromAttributes({ 'service.name': serviceName }),
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) }),
    spanLimits: { attributeValueLengthLimit: 160 },
    spanProcessors: [new BatchSpanProcessor({
      exporter: {
        export: (spans, complete) => exporter.export(spans, (result) => {
          if (result.code !== ExportResultCode.SUCCESS && Date.now() - lastWarning >= 60_000) {
            lastWarning = Date.now();
            logger.warn('Could not export traces to Jaeger');
          }
          complete(result);
        }),
        shutdown: () => exporter.shutdown(),
      },
      maxQueueSize: 1024, maxExportBatchSize: 128, scheduledDelayMillis: 1000, exportTimeoutMillis: 1500,
    })],
  });
  contexts.enable();
}

export function stopTracing(logger: Logger): Promise<void> | undefined {
  if (!provider) return;
  return closing ??= new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      logger.warn('Trace shutdown timed out');
      resolve();
    }, 1800);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    void provider?.shutdown().then(finish, () => {
      logger.warn('Could not flush traces during shutdown');
      finish();
    });
  });
}

export function runWithoutTrace<T>(work: () => T): T {
  return provider ? contexts.with(ROOT_CONTEXT, work) : work();
}

export function injectTraceHeaders(set: (name: string, value: string) => void): void {
  if (provider) propagator.inject(contexts.active(), set, { set: (write, key, value) => write(key, value) });
}

export function runWithRemoteTrace<T>(get: (name: string) => string | undefined, work: () => T): T {
  if (!provider) return work();
  const parent = propagator.extract(ROOT_CONTEXT, get, {
    keys: () => ['traceparent', 'tracestate'],
    get: (read, key) => read(key),
  });
  return contexts.with(parent, work);
}

export function activeTraceIds() {
  const span = trace.getSpanContext(contexts.active());
  return span && trace.isSpanContextValid(span) ? { traceId: span.traceId, spanId: span.spanId } : {};
}

function spanAttributes(metadata: DiagnosticMetadata) {
  return {
    'http.request.method': metadata.method,
    'http.route': metadata.route,
    'http.response.status_code': metadata.statusCode,
    'messaging.destination.name': metadata.subject,
    'error.type': metadata.errorCode,
  };
}

export function startOperationSpan(operation: string, metadata: DiagnosticMetadata) {
  if (!provider) return;
  const parent = contexts.active();
  const kind = operation === 'http.request' || operation === 'nats.responder' ? SpanKind.SERVER
    : operation === 'nats.request' ? SpanKind.CLIENT : SpanKind.INTERNAL;
  const span = provider.getTracer('dsap.diagnostics').startSpan(operation, {
    kind, attributes: spanAttributes(metadata),
  }, parent);
  const scope: Context = trace.setSpan(parent, span);
  return {
    run: <T>(work: () => T) => contexts.with(scope, work),
    finish(outcome: OperationOutcome, details: DiagnosticMetadata) {
      span.setAttributes({ ...spanAttributes(details), 'dsap.outcome': outcome });
      if (details.route && details.method) span.updateName(`${details.method} ${details.route}`);
      if (outcome === 'failure' || details.errorCode === 'timeout' || details.errorCode === 'no_responders') {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
    },
  };
}
