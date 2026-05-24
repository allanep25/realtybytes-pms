#!/bin/sh
set -e
echo "Applying database schema..."
npm run db:deploy
echo "Starting Amar Residence..."
exec npm run start
