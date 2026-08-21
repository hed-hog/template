#!/bin/sh
# Docker entrypoint for HedHog API
# Migrations run in the dedicated api-migrate service.

set -e

echo "🚀 HedHog API - Starting..."

# Start the application
echo "🎯 Starting NestJS application..."
exec "$@"
