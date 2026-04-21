/**
 * Global Setup for Playwright E2E Tests
 * Runs before any test to seed fresh database and ensure clean state
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  console.log('\n=== Playwright Global Setup ===');
  console.log('Seeding database with test data...\n');

  try {
    const serverDir = path.resolve(__dirname, '../../../../server');
    execSync('node prisma/seed.js', { cwd: serverDir, stdio: 'inherit' });
    console.log('\n✅ Database seeded successfully');
  } catch (error) {
    console.error('❌ Database seed failed:', error.message);
    throw error;
  }

  console.log('=== Setup Complete ===\n');
}
