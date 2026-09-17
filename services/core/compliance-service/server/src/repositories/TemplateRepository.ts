// File: services/core/compliance-service/server/src/repositories/TemplateRepository.ts

export interface ComplianceTemplate {
  id: string;
  name: string;
  html: string;
}

const TEMPLATES_DB: Record<string, ComplianceTemplate> = {
  // The new initiation/approval template
  'transfer-authorization': {
    id: 'transfer-authorization',
    name: 'Asset Transfer Authorization',
    html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Asset Transfer Authorization</title>
          <style>
            html, body {
              height: 100%;
              margin: 0;
            }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-size: 12px;
              color: #333;
              padding: 40px;
              box-sizing: border-box;
              position: relative; /* Crucial for absolute signature block */
            }
            .header-title {
              text-align: center;
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 20px;
              text-transform: uppercase;
            }
            .form-grid {
              display: table;
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .grid-row {
              display: table-row;
            }
            .grid-cell {
              display: table-cell;
              border: 1px solid #000;
              padding: 8px;
              vertical-align: top;
              width: 50%;
            }
            .label {
              font-size: 10px;
              font-weight: bold;
              text-transform: uppercase;
              display: block;
              margin-bottom: 4px;
            }
            .table-items {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .table-items th, .table-items td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
            }
            .table-items th {
              font-size: 10px;
              background-color: #f3f4f6;
            }
            /* Hardcoded to the bottom for the e-sign backend */
            .signature-block {
              border: 1px solid #000;
              padding: 15px;
              position: absolute;
              bottom: 40px;
              left: 40px;
              right: 40px;
              box-sizing: border-box;
            }
            .sig-line {
              border-bottom: 1px solid #000;
              width: 250px;
              display: inline-block;
              margin-left: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header-title">
            Asset Transfer Authorization Form<br>
            (Initiating Document)
          </div>
          
          <div class="form-grid">
            <div class="grid-row">
              <div class="grid-cell">
                <span class="label">1. Receiving Entity (Destination):</span>
                <strong>{{receivingEntityName}}</strong><br>
                {{receivingAddressLine1}}<br>
                {{receivingAddressLine2}}
              </div>
              <div class="grid-cell">
                <span class="label">2. Releasing Entity (Authorizing):</span>
                <strong>{{releasingEntityName}}</strong><br>
                {{releasingAddressLine1}}<br>
                {{releasingAddressLine2}}
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-cell">
                <span class="label">3. Authorization / Project Code:</span>
                {{authorizationCode}}
              </div>
              <div class="grid-cell">
                <span class="label">4. Authorization Date (YYYYMMDD):</span>
                {{authorizationDate}}
              </div>
            </div>
          </div>

          <table class="table-items">
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Asset Description & Serial Number</th>
                <th>Unit of Issue</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {{#each items}}
              <tr>
                <td>{{this.itemNumber}}</td>
                <td>
                  <strong>{{this.nomenclature}}</strong><br>
                  S/N: {{this.serialNumber}}<br>
                  <em>{{this.additionalNotes}}</em>
                </td>
                <td>{{this.unit}}</td>
                <td>{{this.quantity}}</td>
              </tr>
              {{/each}}
            </tbody>
          </table>

          <div class="signature-block">
            <span class="label">Release Authorization</span>
            <p>I certify that the release and transfer of the assets listed above is authorized.</p>
            <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <strong>Authorizing Official:</strong> 
								<span class="sig-line"></span>
              </div>
              <div>
                <strong>Date:</strong> <span class="sig-line" style="width: 150px; display: inline-block;"></span>
              </div>
            </div>
          </div>
        </body>
        </html>`
  },

  // The full, complex production template
  'dd-1149': {
      id: 'dd-1149',
      name: 'DD Form 1149 (Requisition & Invoice)',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Transfer of Custody - DD1149 Sim</title>
          <style>
            html, body {
              height: 100%;
              margin: 0;
            }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-size: 12px;
              color: #333;
              padding: 40px;
              box-sizing: border-box;
              position: relative; /* Crucial for absolute signature block */
            }
            .header-title {
              text-align: center;
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 20px;
              text-transform: uppercase;
            }
            .form-grid {
              display: table;
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .grid-row {
              display: table-row;
            }
            .grid-cell {
              display: table-cell;
              border: 1px solid #000;
              padding: 8px;
              vertical-align: top;
              width: 50%;
            }
            .label {
              font-size: 10px;
              font-weight: bold;
              text-transform: uppercase;
              display: block;
              margin-bottom: 4px;
            }
            .table-items {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .table-items th, .table-items td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
            }
            .table-items th {
              font-size: 10px;
              background-color: #f3f4f6;
            }
            /* Hardcoded to the bottom for the e-sign backend */
            .signature-block {
              border: 1px solid #000;
              padding: 15px;
              position: absolute;
              bottom: 40px;
              left: 40px;
              right: 40px;
              box-sizing: border-box;
            }
            .sig-line {
              border-bottom: 1px solid #000;
              width: 250px;
              display: inline-block;
              margin-left: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header-title">
            Requisition and Invoice / Shipping Document<br>
            (Simulated Transfer of Custody)
          </div>
          
          <div class="form-grid">
            <div class="grid-row">
              <div class="grid-cell">
                <span class="label">1. From (Transferring Entity):</span>
                <strong>{{releasingEntityName}}</strong><br>
                {{releasingAddressLine1}}<br>
                {{releasingAddressLine2}}
              </div>
              <div class="grid-cell">
                <span class="label">2. To (Receiving Entity):</span>
                <strong>{{receivingEntityName}}</strong><br>
                {{receivingAddressLine1}}<br>
                {{receivingAddressLine2}}
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-cell">
                <span class="label">3. Authority / Requisition Number:</span>
                {{requisitionNumber}}
              </div>
              <div class="grid-cell">
                <span class="label">4. Date of Transfer (YYYYMMDD):</span>
                {{transferDate}}
              </div>
            </div>
          </div>

          <table class="table-items">
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Asset Description & Serial Number</th>
                <th>Unit of Issue</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {{#each items}}
              <tr>
                <td>{{this.itemNumber}}</td>
                <td>
                  <strong>{{this.nomenclature}}</strong><br>
                  S/N: {{this.serialNumber}}<br>
                  <em>{{this.additionalNotes}}</em>
                </td>
                <td>{{this.unit}}</td>
                <td>{{this.quantity}}</td>
              </tr>
              {{/each}}
            </tbody>
          </table>

          <div class="signature-block">
            <span class="label">Receipt Certification</span>
            <p>I certify that the assets listed above have been received and custody has been formally transferred.</p>
            <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <strong>Authorized Receiver:</strong> 
								<span class="sig-line"></span>
              </div>
              <div>
                <!-- Left blank so pdf-lib can stamp the execution timestamp securely -->
                <strong>Date:</strong> <span class="sig-line" style="width: 150px; display: inline-block;"></span>
              </div>
            </div>
          </div>
        </body>
        </html>`
  },  
  // A lightweight template ideal for contract and unit testing
  'contract-test-bare': {
    id: 'contract-test-bare',
    name: 'Minimal Test Template',
    html: `<!DOCTYPE html><html><body><h1>Minimal Contract Template</h1></body></html>`
  }
};

export const TemplateRepository = {
  findAll: (): ComplianceTemplate[] => {
    return Object.values(TEMPLATES_DB);
  },
  
  findById: (id: string): ComplianceTemplate | null => {
    return TEMPLATES_DB[id] || null;
  }
};