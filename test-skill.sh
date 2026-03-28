#!/bin/bash
# Test the SimpleX skill by copying files into a local NanoClaw repo

set -e

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NANOCLAW_DIR="${1:-}"

if [ -z "$NANOCLAW_DIR" ]; then
    echo "Usage: $0 /path/to/nanoclaw/repo"
    exit 1
fi

echo "🧪 Testing SimpleX skill in: $NANOCLAW_DIR"

# Copy channel files
mkdir -p "$NANOCLAW_DIR/src/channels"
cp "$SKILL_DIR/src/channels/simplex.ts" "$NANOCLAW_DIR/src/channels/"
cp "$SKILL_DIR/src/channels/simplex.test.ts" "$NANOCLAW_DIR/src/channels/"

# Update channels/index.ts
if ! grep -q "simplex" "$NANOCLAW_DIR/src/channels/index.ts"; then
    echo "import './simplex.js'" >> "$NANOCLAW_DIR/src/channels/index.ts"
fi

# Update package.json
cd "$NANOCLAW_DIR"
if ! grep -q '"ws"' package.json; then
    node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.dependencies.ws='^8.18.0';pkg.devDependencies['@types/ws']='^8.5.0';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2));"
fi

# Install, build, test
npm install
npm run build
npx vitest run src/channels/simplex.test.ts

echo "✅ Skill test complete!"
