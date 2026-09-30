// File: services/core/compliance-service/server/src/db/documents.repository.ts
import { Pool } from 'pg';
import { z } from 'zod';
import {
  ComplianceDocument,
  ComplianceDocumentSchema,
  CreateComplianceDocument,
} from '@contracts/compliance';

export class ComplianceDocumentRepository {
  constructor(private readonly db: Pool) {}

  /**
   * Normalizes DB rows by converting Postgres timestamps/strings into valid ISO-8601 UTC strings for Zod validation.
   */
  private normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    if (!row) return row;

    let createdAt: unknown = row.created_at;

    if (createdAt instanceof Date) {
      createdAt = createdAt.toISOString();
    } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      const parsed = new Date(createdAt);
      if (!Number.isNaN(parsed.getTime())) {
        createdAt = parsed.toISOString();
      }
    }

    return {
      ...row,
      created_at: createdAt,
    };
  }

  /**
   * Persist a new compliance document record, or reconcile on primary key conflict.
   */
  async create(data: CreateComplianceDocument): Promise<ComplianceDocument> {
    const query = `
      INSERT INTO compliance_documents (id, document_type, s3_uri, status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        s3_uri = EXCLUDED.s3_uri,
        status = EXCLUDED.status,
        document_type = EXCLUDED.document_type
      RETURNING id, document_type, s3_uri, status, created_at;
    `;

    const values = [data.id, data.document_type, data.s3_uri, data.status];
    const { rows } = await this.db.query(query, values);

    return ComplianceDocumentSchema.parse(this.normalizeRow(rows[0]));
  }

  /**
   * Retrieve all compliance documents ordered by creation date.
   */
  async findAll(): Promise<ComplianceDocument[]> {
    const query = `
      SELECT id, document_type, s3_uri, status, created_at
      FROM compliance_documents
      ORDER BY created_at DESC;
    `;

    const { rows } = await this.db.query(query);
    const normalizedRows = rows.map((row) => this.normalizeRow(row));

    return z.array(ComplianceDocumentSchema).parse(normalizedRows);
  }

  /**
   * Retrieve a single compliance document by its UUID.
   */
  async findById(id: string): Promise<ComplianceDocument | null> {
    const query = `
      SELECT id, document_type, s3_uri, status, created_at
      FROM compliance_documents
      WHERE id = $1;
    `;

    const { rows } = await this.db.query(query, [id]);
    if (rows.length === 0) return null;

    return ComplianceDocumentSchema.parse(this.normalizeRow(rows[0]));
  }
}