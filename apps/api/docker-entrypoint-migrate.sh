#!/bin/sh
set -eu

# Resolve any previously-failed migrations so they are eligible to be re-applied.
# In Prisma 6, failed migrations are identified by non-empty logs (error message),
# NOT by applied_steps_count=0 (which counts individual SQL statements and can be >0
# for large migrations that failed partway through).
# Setting rolled_back_at makes migrate deploy treat the migration as "not applied"
# and re-run it with the corrected SQL.
cat > /tmp/resolve-failed.sql <<'SQL'
UPDATE "_prisma_migrations"
SET rolled_back_at = NOW()
WHERE rolled_back_at IS NULL
  AND finished_at IS NULL
  AND logs IS NOT NULL
  AND logs <> '';
SQL

prisma db execute --schema=./prisma/schema.prisma --file=/tmp/resolve-failed.sql

exec prisma migrate deploy --schema=./prisma/schema.prisma
