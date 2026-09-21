{{/* File: charts/platform-lib/templates/_middleware-rewrite.tpl */}}

{{/* Takes a dict {name, regex, replacement} for a per-service Traefik path-rewrite Middleware */}}
{{- define "platform-lib.rewriteMiddleware" -}}
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: {{ .name }}
spec:
  replacePathRegex:
    regex: {{ .regex | quote }}
    replacement: {{ .replacement | quote }}
{{- end -}}
