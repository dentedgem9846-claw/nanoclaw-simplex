# NanoClaw SimpleX Channel Skill

A privacy-first messaging channel for NanoClaw using SimpleX Chat.

## Features

- **No phone numbers or user IDs** — Connect via one-time invitation links
- **End-to-end encryption** — Full E2EE with perfect forward secrecy
- **Decentralized** — No central servers, direct peer-to-peer relay
- **Auto-accept contacts** — Optional automatic contact request acceptance
- **Message chunking** — Automatic splitting of long messages
- **Reconnection handling** — Automatic reconnect on connection loss

## Quick Start

```bash
# In your NanoClaw repository
git remote add simplex https://github.com/YOUR_USERNAME/nanoclaw-simplex.git
git fetch simplex main
git merge simplex/main
npm install
npm run build

# Start SimpleX CLI
cd ~/.simplex
docker compose up -d

# Restart NanoClaw
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
# or: systemctl --user restart nanoclaw            # Linux
```

## File Structure

```
.
├── SKILL.md                      # Skill documentation for Claude
├── src/
│   └── channels/
│       ├── simplex.ts            # Main channel implementation
│       └── simplex.test.ts       # Unit tests
├── docker/
│   └── docker-compose.yml        # Docker setup for simplex-chat CLI
└── patches/
    ├── channels-index.patch      # Patch for src/channels/index.ts
    └── package-json.patch        # Patch for package.json
```

## Channel Implementation

The `SimplexChannel` class implements the NanoClaw `Channel` interface:

- `connect()` — Establishes WebSocket connection to simplex-chat CLI
- `sendMessage(jid, text)` — Sends messages to SimpleX contacts
- `isConnected()` — Returns WebSocket connection status
- `ownsJid(jid)` — Checks if JID belongs to this channel (simplex:*)
- `disconnect()` — Closes WebSocket connection

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SIMPLEX_ENABLED` | `true` | Enable/disable the channel |
| `SIMPLEX_WS_URL` | `ws://127.0.0.1:5225` | WebSocket URL |
| `SIMPLEX_AUTO_ACCEPT` | `true` | Auto-accept contact requests |
| `SIMPLEX_DISPLAY_NAME` | `nanoclaw` | Bot display name |

## WebSocket Events

The channel handles these SimpleX CLI events:

- `contactRequest` — New contact request (auto-accepted if enabled)
- `newChatItem` — New message received
- `contactConnected` — Contact established connection

## Testing

```bash
npm run test -- src/channels/simplex.test.ts
```

## License

MIT
