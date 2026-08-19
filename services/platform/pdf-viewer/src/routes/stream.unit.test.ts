import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { streamRouter } from './stream.js';

// Deep System Stubbing: Redirect all node:fs queries away from your real disk drive
const mockFs = vi.hoisted(() => ({
	existsSync: vi.fn(),
	statSync: vi.fn(),
	createReadStream: vi.fn()
}));

vi.mock('node:fs', () => ({
  default: mockFs
}));

describe('Unit Test: Asset Streaming Routing Engine (stream)', () => {
  let app: express.Application;

  beforeEach(() => {
		vi.resetAllMocks();
    
    app = express();
    app.disable('x-powered-by');
    app.use(express.json());
    app.use('/v1/stream', streamRouter);
  });

  it('should intercept missing or empty documentId query strings with a 400 Bad Request', async () => {
    const response = await request(app)
      .get('/v1/stream')
      .query({ documentId: '' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'INVALID_PARAMETER',
      message: 'Query parameter documentId must be a valid string.'
    });
  });

	it('should intercept and block malformed filenames or non-pdf extensions with a 400 Bad Request', async () => {
    const response = await request(app)
      .get('/v1/stream')
      .query({ documentId: 'malicious-script.sh' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('MALFORMED_PARAMETER');
  });


  it('should respond with a 404 when the filesystem stub indicates the file is missing', async () => {
    // Stubbing a false inbound state for file existence
    mockFs.existsSync.mockReturnValue(false);

    const response = await request(app)
      .get('/v1/stream')
      .query({ documentId: 'missing-flight-plan.pdf' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('DOCUMENT_NOT_FOUND');
    expect(mockFs.existsSync).toHaveBeenCalledWith(expect.stringContaining('missing-flight-plan.pdf'));
  });

  it('should pipe raw binary file chunks with proper chunked response headers under a valid execution path', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ isFile: () => true, size: 50000 });

    // Mock a clean readable stream emitter object block
    const mockStream = {
      pipe: vi.fn((res) => {
        // 1. Write the payload data into the response memory buffer
        res.write('mock-pdf-binary-chunk-payload');
        // 2. CRITICAL PROTOCOL FIX: Terminate the open HTTP socket network lane
        res.end();
        return res;
      }),
      on: vi.fn()
    };
    mockFs.createReadStream.mockReturnValue(mockStream);
		const response = await request(app)
			.get('/v1/stream')
			.query({ documentId: 'legit-flight-handover.pdf' });

    // Verify response integrity metrics
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['transfer-encoding']).toBe('chunked');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    
    // REMEDIATION: Convert the raw chunk buffer back to a readable string format
    const receivedPayload = response.body.toString();
    expect(receivedPayload).toBe('mock-pdf-binary-chunk-payload');
    
    // Confirm stream was piped cleanly
    expect(mockStream.pipe).toHaveBeenCalled();

  });
});
