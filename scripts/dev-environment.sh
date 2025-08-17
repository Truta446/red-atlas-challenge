#!/usr/bin/env bash
set -euo pipefail

# Start docker compose services in background
export API_PORT=${API_PORT:-3000}
export POSTGRES_PORT=${POSTGRES_PORT:-5449}
export REDIS_PORT=${REDIS_PORT:-6381}
export RABBITMQ_PORT=${RABBITMQ_PORT:-5674}
export RABBITMQ_MGMT_PORT=${RABBITMQ_MGMT_PORT:-15674}

if [ ! -f .env ]; then
  echo "No .env found. Copying defaults from .env.example..."
  cp .env.example .env
fi

echo "Starting Docker services..."
docker compose up -d postgres redis rabbitmq

# Wait for Postgres to be healthy
printf "Waiting for Postgres to be healthy"
for i in {1..30}; do
  if docker inspect --format='{{.State.Health.Status}}' ra_postgres 2>/dev/null | grep -q healthy; then
    echo " - OK"; break
  fi
  printf "."; sleep 2
  if [ "$i" -eq 30 ]; then echo "\nPostgres did not become healthy in time"; exit 1; fi
done

# Run pending migrations if any
if npm run -s migration:run; then
  echo "Migrations applied"
else
  echo "No migrations to run or TypeORM not configured yet"
fi
