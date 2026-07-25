import 'dotenv/config';

import { readServerConfig } from '../config';
import { createDatabase } from './client';
import { seedDatabase } from './seed';

const config = readServerConfig();
const database = createDatabase(config.DATABASE_URL);

async function main() {
  try {
    await seedDatabase(database.db);
    console.log('Seeded demo merchant and products');
  } finally {
    await database.close();
  }
}

void main();
