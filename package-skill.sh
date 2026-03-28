#!/bin/bash
# Package this skill as a git branch that can be merged into NanoClaw
# Usage: ./package-skill.sh /path/to/nanoclaw/repo

set -e

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NANOCLAW_DIR="${1:-}"

if [ -z "$NANOCLAW_DIR" ]; then
    echo "Usage: $0 /path/to/nanoclaw/repo"
    echo ""
    echo "This script packages the SimpleX skill as a git branch"
    echo "that can be merged into a NanoClaw repository."
    exit 1
fi

if [ ! -d "$NANOCLAW_DIR/.git" ]; then
    echo "❌ Error: $NANOCLAW_DIR is not a git repository"
    exit 1
fi

echo "📦 Packaging SimpleX skill for NanoClaw..."
echo "   Source: $SKILL_DIR"
echo "   Target: $NANOCLAW_DIR"
echo ""

cd "$NANOCLAW_DIR"

# Create a new branch for the skill
BRANCH_NAME="skill/simplex"
echo "🌿 Creating branch: $BRANCH_NAME"

# Checkout from main
git checkout -b "$BRANCH_NAME" main 2>/dev/null || git checkout "$BRANCH_NAME"

# Copy channel files
echo "📁 Copying channel files..."
mkdir -p src/channels
cp "$SKILL_DIR/src/channels/simplex.ts" src/channels/
cp "$SKILL_DIR/src/channels/simplex.test.ts" src/channels/

# Update channels/index.ts to import simplex
echo "📝 Updating src/channels/index.ts..."
if ! grep -q "simplex" src/channels/index.ts; then
    echo "import './simplex.js'" >> src/channels/index.ts
fi

# Update package.json to add ws dependency
echo "📦 Updating package.json..."
if ! grep -q '"ws"' package.json; then
    # Use node to properly modify package.json
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.dependencies = pkg.dependencies || {};
        pkg.dependencies.ws = '^8.18.0';
        pkg.devDependencies = pkg.devDependencies || {};
        pkg.devDependencies['@types/ws'] = '^8.5.0';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
    "
fi

# Commit the changes
echo "💾 Committing changes..."
git add -A
git commit -m "Add SimpleX Chat channel skill

Features:
- WebSocket connection to simplex-chat CLI
- Auto-accept contact requests
- Message chunking for long messages
- Automatic reconnection handling

Usage:
1. Run simplex-chat CLI: docker compose up -d
2. Merge this branch into your nanoclaw repo
3. Restart nanoclaw

See SKILL.md for full documentation." || echo "No changes to commit"

echo ""
echo "✅ Skill packaged successfully!"
echo ""
echo "To use in your NanoClaw repo:"
echo "   cd /path/to/your/nanoclaw"
echo "   git remote add simplex $NANOCLAW_DIR"
echo "   git fetch simplex"
echo "   git merge simplex/$BRANCH_NAME"
echo ""
