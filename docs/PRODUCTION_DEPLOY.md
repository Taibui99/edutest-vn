# Production deploy

EduTest production builds must not mutate the database schema.

The Vercel build runs `prisma generate && next build` only. Apply Prisma migrations separately with:

```bash
npx prisma migrate deploy
```

For local development, use:

```bash
npx prisma migrate dev
```

Use `prisma db push` only for intentional local/prototyping schema synchronization. Do not use `--accept-data-loss` in the production build command.
