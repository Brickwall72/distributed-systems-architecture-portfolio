import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();

// Secure, hardcoded path boundary to prevent arbitrary file system traversal attacks
const STORAGE_ROOT = path.resolve('storage/documents');

router.get('/', (req, res, next) => {
  try {
    const documentId = req.query.documentId;

    // Boundary Gate 1: Ensure the parameter exists and is a flat string
    if (!documentId || typeof documentId !== 'string') {
      res.status(400).json({ 
        error: 'INVALID_PARAMETER', 
        message: 'Query parameter documentId must be a valid string.' 
      });
      return;
    }

    // Boundary Gate 2: Sanitize file inputs to prevent path traversal injection attacks
    const sanitizedFilename = path.basename(documentId);
    const targetFilePath = path.join(STORAGE_ROOT, sanitizedFilename);

    // Boundary Gate 3: Physically audit that the target asset exists on disk storage
    if (!fs.existsSync(targetFilePath)) {
      res.status(404).json({ 
        error: 'DOCUMENT_NOT_FOUND', 
        message: 'The requested document asset could not be located.' 
      });
      return;
    }

    // Boundary Gate 4: Audit system metadata properties to confirm it is a flat file
    const fileStats = fs.statSync(targetFilePath);
    if (!fileStats.isFile()) {
      res.status(400).json({ error: 'INVALID_TARGET', message: 'Target path is not a file.' });
      return;
    }

    // Configure HTTP Response Header Matrix for Node streaming output
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff'
    });

    // Initialize the non-blocking low-level system hardware read stream
    const fileStream = fs.createReadStream(targetFilePath);

    // Securely pipe the raw byte chunks directly into the outbound HTTP socket
    fileStream.pipe(res);

    // Handle unexpected data loss or hardware tracking errors mid-stream
    fileStream.on('error', (streamError) => {
      console.error('[pdf-viewer] Active pipeline transfer error:', streamError);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

  } catch (caughtError) {
    // Pass unexpected execution errors safely to your global catch-all boundary handler
    next(caughtError);
  }
});

export { router as streamRouter };
