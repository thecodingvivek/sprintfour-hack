# Prisma Database Workflow (Prisma v7)

When modifying the database or adding new models in this project, adhere to the following workflow:

## 1. Adding Models
Define new models inside `prisma/schema.prisma`.

**CRITICAL PRISMA v7 WARNING**: 
Do **NOT** add the `url` property inside the `datasource db` block in `schema.prisma`. In Prisma v7, the database connection URL is configured exclusively in `prisma.config.ts`. The datasource block must remain clean like this:
```prisma
datasource db {
  provider = "postgresql"
}
```

## 2. Syncing the Database
After modifying `schema.prisma`, you must apply those changes to the database and generate the updated client. Run the following command using Bun:
```bash
bunx prisma generate && bunx prisma db push
```
- `prisma generate`: Updates the Prisma Client with your new models based on the schema.
- `prisma db push`: Pushes the schema state directly to your Postgres database without creating migration files (ideal for rapid prototyping).

## 3. Importing the Prisma Client (Prisma v7 Driver Adapters)
Prisma v7 no longer uses the native rust engines and requires driver adapters. 
To connect, you must install `@prisma/adapter-pg` and `pg`.
Then, always use the singleton instance which is correctly set up with the driver adapter:
```javascript
import { prisma } from '@/lib/prisma'
```
*(If you need to edit the singleton in `src/lib/prisma.js`, you must pass the PG adapter to the `PrismaClient` constructor from `../generated/prisma/client`. Note the `/client` at the end to avoid Next.js Module Not Found errors!)*
