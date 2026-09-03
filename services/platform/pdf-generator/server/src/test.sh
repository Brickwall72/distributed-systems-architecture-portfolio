# services/platform/pdf-generator/server/src/test.sh
curl -X POST http://localhost:4001/api/v1/pdf/generate \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "satellite-compliance-report",
    "data": {
      "constellationName": "Starlink-LEO-Mesh-4",
      "timestamp": "2026-09-02T23:45:00Z",
      "satellites": [
        { "satId": "SAT-LEO-101", "altitudeKm": 550, "isOperational": true, "encryptionProtocol": "AES-256-GCM" },
        { "satId": "SAT-LEO-102", "altitudeKm": 542, "isOperational": false, "encryptionProtocol": "TLS-1.3-HYBRID" }
      ]
    }
  }' --output test-output.pdf