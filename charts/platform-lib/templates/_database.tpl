{{/* File: charts/platform-lib/templates/_database.tpl */}}

{{- define "platform-lib.database" -}}
{{- $name := include "platform-lib.name" (dict "Release" .Release "Values" (dict "component" "database" "nameOverride" .Values.nameOverride)) -}}
{{- $labels := include "platform-lib.labels" (dict "Release" .Release "Values" (dict "component" "database" "nameOverride" .Values.nameOverride)) -}}
{{- if .Values.persistence.enabled }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ $name }}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: {{ .Values.persistence.size }}
---
{{- end }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $name }}
  labels:
    {{- $labels | nindent 4 }}
  {{- if .Values.annotations }}
  annotations:
    {{- toYaml .Values.annotations | nindent 4 }}
  {{- end }}
spec:
  replicas: 1
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
        {{- include "platform-lib.databasePodSecurityContext" . | nindent 8 }}
      containers:
        - name: database
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            {{- range .Values.ports }}
            - name: {{ .name }}
              containerPort: {{ .port }}
            {{- end }}
          {{- if .Values.env }}
          env:
            {{- toYaml .Values.env | nindent 12 }}
          {{- end }}
          {{- if .Values.envFrom }}
          envFrom:
            {{- toYaml .Values.envFrom | nindent 12 }}
          {{- end }}
          {{- if .Values.persistence.enabled }}
          volumeMounts:
            - name: data
              mountPath: {{ .Values.persistence.mountPath }}
          {{- end }}
          readinessProbe:
            {{- toYaml .Values.probes.readiness | nindent 12 }}
          livenessProbe:
            {{- toYaml .Values.probes.liveness | nindent 12 }}
          {{- include "platform-lib.resources" .Values.resources | nindent 10 }}
      {{- if .Values.persistence.enabled }}
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: {{ $name }}
      {{- end }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ $name }}
spec:
  selector:
    {{- $labels | nindent 4 }}
  ports:
    {{- range .Values.ports }}
    - name: {{ .name }}
      port: {{ .port }}
      targetPort: {{ .port }}
    {{- end }}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ $name }}
automountServiceAccountToken: false
{{- end -}}

