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
git remote add simplex https://github.com/dentedgem9846-claw/nanoclaw.git
git fetch simplex
git merge simplex/skill/simplex
npm install
npm run build

# Install SimpleX CLI (see SimpleX docs)
# Start SimpleX CLI
simplex-chat -p 5225

# Restart NanoClaw
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
```

## File Structure

```
src/channels/
├── simplex.ts            # Main channel implementation
├── simplex.test.ts       # Unit tests
└── index.ts              # Updated with simplex import

.claude/skills/add-simplex/
└── SKILL.md              # Skill documentation
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SIMPLEX_ENABLED` | `true` | Enable/disable the channel |
| `SIMPLEX_WS_URL` | `ws://127.0.0.1:5225` | WebSocket URL |
| `SIMPLEX_AUTO_ACCEPT` | `true` | Auto-accept contact requests |
| `SIMPLEX_DISPLAY_NAME` | `nanoclaw` | Bot display name |

## Testing

```bash
npm run test -- src/channels/simplex.test.ts
```

## Usage

1. **Install SimpleX CLI** following the official SimpleX documentation

2. **Create profile and get address:**
   ```bash
   simplex-chat
   # Enter display name
   /address create
   # Copy the simplex:// link
   Ctrl+C to exit
   ```

3. **Run CLI in WebSocket mode:**
   ```bash
   simplex-chat -p 5225
   ```

4. **Connect from phone:**
   - Open SimpleX app
   - Tap **+** → **Connect via link**
   - Paste your `simplex://` address
   - Send a message

## License

MIT
