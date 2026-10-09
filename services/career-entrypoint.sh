#!/bin/sh
set -eu
mkdir -p /data/files/resumes
if [ ! -e /data/career.db ]; then touch /data/career.db; fi
node node_modules/prisma/build/index.js migrate deploy
exec node server.js
