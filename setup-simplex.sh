#!/bin/bash
# Setup script for NanoClaw SimpleX Channel
# This script initializes a SimpleX CLI container for use with NanoClaw

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIMPLEX_DIR="${HOME}/.simplex"

echo "🔧 Setting up SimpleX for NanoClaw..."

# Create SimpleX directory
mkdir -p "${SIMPLEX_DIR}"

# Copy docker-compose if not exists
if [ ! -f "${SIMPLEX_DIR}/docker-compose.yml" ]; then
    echo "📄 Copying docker-compose.yml..."
    cp "${SCRIPT_DIR}/docker/docker-compose.yml" "${SIMPLEX_DIR}/"
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Start SimpleX CLI
echo "🚀 Starting SimpleX CLI container..."
cd "${SIMPLEX_DIR}"
docker compose up -d

# Wait for container to be healthy
echo "⏳ Waiting for SimpleX CLI to be ready..."
sleep 5

# Check health
if docker compose ps | grep -q "healthy"; then
    echo "✅ SimpleX CLI is running and healthy"
else
    echo "⚠️  SimpleX CLI may still be starting. Check with: docker compose logs -f"
fi

# Get or create address
echo ""
echo "📇 Getting your SimpleX contact address..."
echo ""

# Try to get existing address
ADDRESS=$(docker exec simplex-cli simplex-chat -e '/address' 2>/dev/null || echo "")

if [ -z "$ADDRESS" ] || [ "$ADDRESS" == "No active address" ]; then
    echo "Creating new address..."
    docker exec -it simplex-cli simplex-chat -e '/address create'
    ADDRESS=$(docker exec simplex-cli simplex-chat -e '/address' 2>/dev/null)
fi

echo ""
echo "🔗 Your SimpleX contact address:"
echo "${ADDRESS}"
echo ""
echo "📱 Scan or share this link with your phone to connect."
echo ""
echo "📝 Next steps:"
echo "   1. Add the SimpleX channel to NanoClaw: git merge simplex/main"
echo "   2. Restart NanoClaw to load the channel"
echo "   3. Send a test message from your phone"
echo ""
