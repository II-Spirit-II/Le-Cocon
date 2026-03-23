// Dev seed — run with: npm run db:seed
// Creates default assistante and parent accounts (password: "password")
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcryptjs';
import * as schema from './schema';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://lecocon:lecocon_dev@localhost:5432/lecocon';

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  const passwordHash = await bcrypt.hash('password', 12);

  const [assistante] = await db.insert(schema.users).values({
    email: 'assistante@lecocon.fr',
    passwordHash,
    name: 'Marie Dupont',
    role: 'assistante',
    emailVerified: true,
  }).onConflictDoNothing({ target: schema.users.email }).returning();

  await db.insert(schema.users).values({
    email: 'parent@lecocon.fr',
    passwordHash,
    name: 'Jean Martin',
    role: 'parent',
    emailVerified: true,
  }).onConflictDoNothing({ target: schema.users.email });

  if (assistante) {
    console.log('Seed complete.');
    console.log('  assistante@lecocon.fr / password');
    console.log('  parent@lecocon.fr / password');
  } else {
    console.log('Seed skipped (users already exist).');
  }

  await pool.end();
}

seed().catch(console.error);
