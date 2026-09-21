{{/* File: charts/platform-lib/templates/_client.tpl */}}

{{- define "platform-lib.client" -}}
{{- $name := include "platform-lib.name" (dict "Release" .Release "Values" (dict "component" "client" "nameOverride" .Values.nameOverride)) -}}
{{- $labels := include "platform-lib.labels" (dict "Release" .Release "Values" (dict "component" "client" "nameOverride" .Values.nameOverride)) -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $name }}
  labels:
    {{- $labels | nindent 4 }}
spec:
  replicas: {{ .Values.replicas }}
  selector:
    matchLabels:
      {{- $labels | nindent 6 }}
  template:
    metadata:
      labels:
        {{- $labels | nindent 8 }}
      {{- if .Values.annotations }}
      annotations:
        {{- toYaml .Values.annotations | nindent 8 }}
      {{- end }}
    spec:
      serviceAccountName: {{ $name }}
      automountServiceAccountToken: false
      securityContext:
        {{- include "platform-lib.podSecurityContext" . | nindent 8 }}
      containers:
        - name: client
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          securityContext:
            {{- include "platform-lib.containerSecurityContext" . | nindent 12 }}
          ports:
            - name: http
              containerPort: 3000
          {{- if .Values.env }}
          env:
            {{- toYaml .Values.env | nindent 12 }}
          {{- end }}
          {{- if .Values.envFrom }}
          envFrom:
            {{- toYaml .Values.envFrom | nindent 12 }}
          {{- end }}
          {{- include "platform-lib.probes" .Values.probes | nindent 10 }}
          {{- include "platform-lib.resources" .Values.resources | nindent 10 }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ $name }}
spec:
  selector:
    {{- $labels | nindent 4 }}
  ports:
    - name: http
      port: 80
      targetPort: 3000
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ $name }}
automountServiceAccountToken: false
{{- end -}}
