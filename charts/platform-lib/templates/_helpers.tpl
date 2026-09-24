{{/* File: charts/platform-lib/templates/_helpers.tpl */}}

{{/* Uses .Values.nameOverride verbatim when set - needed when other services have a hardcoded hostname expectation (e.g. a database) */}}
{{- define "platform-lib.name" -}}
{{- if .Values.nameOverride -}}
{{ .Values.nameOverride }}
{{- else -}}
{{ printf "%s-%s" .Release.Name .Values.component }}
{{- end -}}
{{- end -}}

{{- define "platform-lib.labels" -}}
app.kubernetes.io/name: {{ include "platform-lib.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "platform-lib.podSecurityContext" -}}
runAsNonRoot: true
runAsUser: 1000
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{/* Database images (postgres/neo4j) manage their own non-root user internally - forcing runAsUser breaks them, so only seccomp applies */}}
{{- define "platform-lib.databasePodSecurityContext" -}}
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "platform-lib.containerSecurityContext" -}}
allowPrivilegeEscalation: false
capabilities:
  drop:
    - ALL
{{- end -}}

{{/* Takes a resources dict ({limits, requests}) directly, not the whole Values tree */}}
{{- define "platform-lib.resources" -}}
resources:
  limits:
    cpu: {{ .limits.cpu }}
    memory: {{ .limits.memory }}
  requests:
    cpu: {{ .requests.cpu }}
    memory: {{ .requests.memory }}
{{- end -}}

{{/* Takes a probes dict ({readiness, liveness}) directly, not the whole Values tree */}}
{{- define "platform-lib.probes" -}}
readinessProbe:
  httpGet:
    path: {{ .readiness.httpGet.path }}
    port: {{ .readiness.httpGet.port }}
  initialDelaySeconds: {{ .readiness.initialDelaySeconds }}
  periodSeconds: {{ .readiness.periodSeconds }}
livenessProbe:
  httpGet:
    path: {{ .liveness.httpGet.path }}
    port: {{ .liveness.httpGet.port }}
  initialDelaySeconds: {{ .liveness.initialDelaySeconds }}
  periodSeconds: {{ .liveness.periodSeconds }}
{{- end -}}
