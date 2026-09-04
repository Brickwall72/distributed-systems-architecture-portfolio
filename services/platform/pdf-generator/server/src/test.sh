#!/bin/bash
# File: services/platform/pdf-generator/server/src/test.sh

# The HTML string is minified and double-quotes are escaped for valid JSON
curl -X POST http://localhost:4001/api/v1/pdf/generate \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: manual-bash-test-01" \
  -d '{
    "html": "<!DOCTYPE html><html><head><style>body{font-family:sans-serif;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background-color:#f2f2f2;}.operational{color:green;}.offline{color:red;}</style></head><body><h1>LEO Constellation Compliance Report</h1><h2>Starlink-LEO-Mesh-4</h2><p>Generated: 2026-09-02T23:45:00Z</p><table><tr><th>Sat ID</th><th>Altitude</th><th>Status</th><th>Encryption</th></tr><tr><td>SAT-LEO-101</td><td>550km</td><td class=\"operational\">Operational</td><td>AES-256-GCM</td></tr><tr><td>SAT-LEO-102</td><td>542km</td><td class=\"offline\">Offline</td><td>TLS-1.3-HYBRID</td></tr></table></body></html>"
  }' --output test-output.pdf

echo "PDF generation complete. Check test-output.pdf"