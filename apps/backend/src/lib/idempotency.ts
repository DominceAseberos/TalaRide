/**
 * Idempotency registry for mobile offline synchronization & retry resilience.
 * Stores operations by client_operation_id to prevent duplicate processing.
 */

export interface IdempotencyRecord<T = any> {
  clientOperationId: string;
  endpoint: string;
  statusCode: number;
  responseBody: T;
  createdAt: string;
}

export class IdempotencyStore {
  private records: Map<string, IdempotencyRecord> = new Map();

  get(clientOperationId: string): IdempotencyRecord | undefined {
    return this.records.get(clientOperationId);
  }

  set(clientOperationId: string, endpoint: string, statusCode: number, responseBody: any): void {
    this.records.set(clientOperationId, {
      clientOperationId,
      endpoint,
      statusCode,
      responseBody,
      createdAt: new Date().toISOString()
    });
  }

  clear(): void {
    this.records.clear();
  }
}

export const idempotencyStore = new IdempotencyStore();
