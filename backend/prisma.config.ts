import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const pg = await import('pg');
      const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/studysync?schema=public';
      const pool = new pg.Pool({ connectionString: url });
      return new PrismaPg(pool);
    },
  },
});
