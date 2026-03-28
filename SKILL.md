---
name: add-simplex
description: Add SimpleX Chat integration to NanoClaw as a privacy-first messaging channel. SimpleX provides end-to-end encrypted messaging with no phone numbers, no user identifiers, and no metadata. This skill adds the SimpleX channel which connects to the simplex-chat CLI via WebSocket.
---

# Add SimpleX Chat Integration

This skill adds SimpleX Chat support to NanoClaw — a privacy-first, decentralized messaging channel with no phone numbers, no user identifiers, and full end-to-end encryption.

## Overview

SimpleX is uniquely suited for privacy-critical agent communication:
- **No user identifiers** — no phone or email required
- **End-to-end encrypted** by default with perfect forward secrecy
- **Decentralized** relay architecture — no central servers
- **Self-hostable** — fully supports local-first operation
- **No metadata exposure** — unlike typical bot-platform channels

## Architecture

```
┌─────────────────┐      WebSocket       ┌─────────────────┐
│  SimpleX CLI    │ ◄──────────────────► │  NanoClaw       │
│  (simplex-chat  │    ws://localhost    │  SimpleXChannel │
│   -p 5225)      │       :5225          │                 │
└────────┬────────┘                      └────────┬────────┘
         │                                         │
         │  SimpleX Network                        │  Agent
         │  (E2E encrypted)                        │  Pipeline
         ▼                                         ▼
┌─────────────────┐                      ┌─────────────────┐
│  SimpleX App    │                      │  LLM/Claude     │
│  (Your Phone)   │                      │  (Container)    │
└─────────────────┘                      └─────────────────┘
```

## Phase 1: Pre-flight

### Check if already applied

Check if `src/channels/simplex.ts` exists. If it does, skip to Phase 3 (Setup).

### Prerequisites

Ensure Docker is available (for running the SimpleX CLI container):

```bash
docker --version
```

## Phase 2: Apply Code Changes

### Ensure simplex remote

```bash
git remote -v
```

If `simplex` is missing, add it:

```bash
git remote add simplex https://github.com/YOUR_USERNAME/nanoclaw-simplex.git
```

### Merge the skill branch

```bash
git fetch simplex main
git merge simplex/main || {
  git checkout --theirs package-lock.json
  git add package-lock.json
  git merge --continue
}
```

This merges in:
- `src/channels/simplex.ts` — SimpleXChannel class with WebSocket client
- `src/channels/simplex.test.ts` — unit tests
- `import './simplex.js'` appended to `src/channels/index.ts`
- `ws` npm dependency in `package.json`

### Validate code changes

```bash
npm install
npm run build
npx vitest run src/channels/simplex.test.ts
```

All tests must pass and build must be clean before proceeding.

## Phase 3: Setup

### Create SimpleX data directory

```bash
mkdir -p ~/.simplex
```

### Start the SimpleX CLI

You have two options: Docker (recommended) or bare-metal.

#### Option A: Docker (Recommended)

Create a docker-compose file at `~/.simplex/docker-compose.yml`:

```yaml
version: "3.8"

services:
  simplex-cli:
    image: simplexchat/simplex-cli:latest
    container_name: simplex-cli
    ports:
      - "127.0.0.1:5225:5225"
    volumes:
      - simplex-data:/root/.simplex
    environment:
      - SIMPLEX_DISPLAY_NAME=${SIMPLEX_DISPLAY_NAME:-nanoclaw}
    command: ["-p", "5225"]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "simplex-chat", "-e", "/help"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  simplex-data:
```

Start the container:

```bash
cd ~/.simplex
docker compose up -d
```

Verify it's running:

```bash
docker compose ps
# Should show: simplex-cli Up (healthy)
```

#### Option B: Bare-metal

Install the SimpleX CLI:

```bash
# Linux x86_64
curl -fsSL "https://github.com/simplex-chat/simplex-chat/releases/latest/download/simplex-chat-ubuntu-24_04-x86-64" \
  -o ~/.local/bin/simplex-chat
chmod +x ~/.local/bin/simplex-chat

# Or use the install script
curl -o- https://raw.githubusercontent.com/simplex-chat/simplex-chat/stable/install.sh | bash
```

First run — create your profile:

```bash
simplex-chat
# Enter display name when prompted (e.g., "nanoclaw")
# Type: /address create
# Copy the simplex:// link
# Press Ctrl+C to exit
```

Create a systemd service:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/simplex-chat.service << 'EOF'
[Unit]
Description=SimpleX Chat CLI (WebSocket mode)
After=network.target

[Service]
Type=simple
ExecStart=%h/.local/bin/simplex-chat -p 5225
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now simplex-chat
```

### Configure NanoClaw

Add to your `~/.nanoclaw/config.json` (or wherever your config is):

```json
{
  "channels": {
    "simplex": {
      "enabled": true,
      "wsUrl": "ws://127.0.0.1:5225",
      "autoAccept": true,
      "displayName": "nanoclaw"
    }
  }
}
```

Configuration options:

| Option | Default | Description |
|--------|---------|-------------|
| `wsUrl` | `ws://127.0.0.1:5225` | WebSocket URL of simplex-chat CLI |
| `autoAccept` | `true` | Auto-accept incoming contact requests |
| `displayName` | `nanoclaw` | Bot display name in SimpleX |

### Build and restart

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
# Linux: systemctl --user restart nanoclaw
```

## Phase 4: Verify

### Get your SimpleX address

**Docker:**
```bash
docker exec simplex-cli simplex-chat -e '/address'
```

**Bare-metal:**
```bash
simplex-chat -e '/address'
```

If no address exists, create one:
```bash
# Docker
docker exec -it simplex-cli simplex-chat -e '/address create'

# Bare-metal
simplex-chat
/address create
```

Copy the `simplex://` link — you'll paste this into the SimpleX app on your phone.

### Connect from your phone

1. Open SimpleX Chat app on your phone
2. Tap **+** → **Connect via link**
3. Paste the `simplex://` address
4. Send a message — the agent should reply within seconds

### Test commands

All standard NanoClaw commands work via SimpleX:

| Command | Action |
|---------|--------|
| `@Andy status` | Show model, tokens, cost |
| `@Andy /compact` | Manually compact context |
| `@Andy /think high` | Set thinking level |

### Check logs if needed

```bash
tail -f logs/nanoclaw.log | grep -i simplex
```

## How It Works

### Message Flow

1. **Inbound:** SimpleX CLI receives encrypted message → emits WebSocket event → `SimplexChannel` parses and calls `onMessage` callback → message stored in SQLite → agent invoked
2. **Outbound:** Agent response → `sendMessage()` called → WebSocket command sent to CLI → CLI sends via SimpleX protocol

### Session Format

SimpleX sessions follow the pattern: `agent:main:simplex:dm:<contact_name>`

Each SimpleX contact gets their own isolated session with independent memory and context.

### JID Format

SimpleX JIDs use the contact's display name: `simplex:<contact_name>`

Example: `simplex:alice_123`

## Troubleshooting

### SimpleX CLI not connecting

Check if the CLI is listening on port 5225:
```bash
ss -tlnp | grep 5225
# or
lsof -i :5225
```

Check CLI logs:
```bash
# Docker
docker compose logs -f simplex-cli

# Bare-metal
journalctl --user -u simplex-chat -f
```

### Channel not starting

Verify config is loaded:
```bash
grep -A5 '"simplex"' ~/.nanoclaw/config.json
```

Check NanoClaw logs:
```bash
tail -f logs/nanoclaw.log | grep -iE "(simplex|channel)"
```

### Messages not being received

1. Verify contact is established (check `/contacts` in simplex-chat)
2. Check if `autoAccept` is enabled or manually accept contact requests
3. Ensure WebSocket connection is active (check logs)

### Permission denied on ~/.simplex

```bash
chmod 700 ~/.simplex
```

## Security Considerations

- **Backup `~/.simplex/`** — This directory contains your identity keys and contacts. Loss = loss of all SimpleX contacts.
- **Auto-accept risks** — With `autoAccept: true`, anyone with your address can connect. Disable for manual approval.
- **Network isolation** — The WebSocket binds to `127.0.0.1` by default. Don't expose it to the network without authentication.

## Removal

1. Stop the SimpleX CLI:
   ```bash
   # Docker
   cd ~/.simplex && docker compose down
   
   # Bare-metal
   systemctl --user stop simplex-chat
   systemctl --user disable simplex-chat
   ```

2. Remove channel files:
   ```bash
   rm src/channels/simplex.ts src/channels/simplex.test.ts
   ```

3. Remove import from `src/channels/index.ts`:
   ```bash
   sed -i "/import '\./simplex.js'/d" src/channels/index.ts
   ```

4. Uninstall dependency:
   ```bash
   npm uninstall ws @types/ws
   ```

5. Rebuild and restart:
   ```bash
   npm run build
   launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
   # Linux: systemctl --user restart nanoclaw
   ```

## References

- [SimpleX Chat Website](https://simplex.chat)
- [SimpleX CLI Documentation](https://github.com/simplex-chat/simplex-chat/blob/stable/docs/CLI.md)
- [SimpleX Protocol](https://github.com/simplex-chat/simplexmq/blob/master/protocol/overview-tjr.md)
