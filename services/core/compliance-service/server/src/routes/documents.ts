// File: services/core/compliance-service/server/src/routes/documents.ts
import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { uploadComplianceDocument } from '../services/storage.js';
import { pool } from '../db/database.js';
import { createLogger } from '@shared/telemetry';

const router = Router();
const logger = createLogger('compliance-server:documents');

router.post('/', async (req: Request, res: Response) => {
  try {
    const { pdfBase64, documentType = 'transfer-approval' } = req.body;

    if (!pdfBase64) {
      logger.warn('Validation failed: Missing pdfBase64 payload.');
      res.status(400).json({ error: 'Missing required field: pdfBase64.' });
      return;
    }

    // Generate a unique identifier for storage and record tracking
    const documentId = crypto.randomUUID();

    // 1. Convert base64 PDF into a Buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // 2. Upload to MinIO object storage
    logger.debug('Uploading compliance document to MinIO...');
    const s3Uri = await uploadComplianceDocument(documentId, pdfBuffer, documentType);

    // 3. Record metadata in PostgreSQL
    logger.debug('Recording document metadata in PostgreSQL...');
    const query = `
      INSERT INTO compliance_documents (id, document_type, s3_uri)
      VALUES ($1, $2, $3)
      RETURNING id, created_at;
    `;
    
    const dbResult = await pool.query(query, [documentId, documentType, s3Uri]);
    const record = dbResult.rows[0];

    logger.info(`Compliance document successfully saved and indexed. Record ID: ${record.id}`);

    res.status(201).json({
      success: true,
      data: {
        id: record.id,
        documentId,
        documentType,
        s3Uri,
        createdAt: record.created_at,
      },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown storage error';
    logger.error(`Failed to process compliance document persistence: ${message}`);
    res.status(500).json({ error: `Internal storage failure: ${message}` });
  }
});

router.get('/', async (_req, res) => {
  try {
    logger.debug('Retrieving Compliance documents from compliance-db.');
    const { rows } = await pool.query('SELECT * FROM compliance_documents ORDER BY created_at DESC');
    
    // Map database columns to match the client contract schema
    const mappedRows = rows.map((row) => ({
      id: row.id,
      // Map your storage URI or document_type to the expected client field
      document_type: row.document_type || row.s3_uri?.split('/').pop() || 'DD1149-asset-transfer.pdf',
      s3_uri: row.s3_uri,
      status: row.status || 'Pending', // Fallback status if not stored yet
      created_at: row.created_at,
    }));

    res.json(mappedRows);
  } catch (error) {
    logger.error(`Database query failed: ${error}`);
    res.status(500).json({ error: 'Failed to retrieve compliance_documents dataset' });
  }
});

export default router;