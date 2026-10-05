/**
 * DEPRECATED: InMemoryDatabase is strictly prohibited in the production API path.
 * Production persistence is owned by Supabase PostgreSQL via `backend/src/lib/repository.ts`.
 * This file is retained exclusively for test fixtures and simulator mock helpers.
 */

import { repository } from './lib/repository.js';
import { FareConfiguration } from './types.js';

export class FixtureDatabase {
  async getFareConfig(): Promise<FareConfiguration> {
    return repository.getFareConfig();
  }
}

export const db = new FixtureDatabase();
