# NanoClaw SimpleX Channel Skill - Summary

## Overview

This skill adds SimpleX Chat as a messaging channel for NanoClaw, providing privacy-first, end-to-end encrypted messaging without phone numbers or user identifiers.

## Files Created

```
nanoclaw-simplex-skill/
├── SKILL.md                          # Skill documentation for Claude Code
├── README.md                         # General documentation
├── tsconfig.json                     # TypeScript config for validation
├── .gitignore                        # Git ignore rules
├── setup-simplex.sh                  # Setup script for SimpleX CLI
├── package-skill.sh                  # Package skill as git branch
├── test-skill.sh                     # Test skill in local nanoclaw repo
├── docker/
│   └── docker-compose.yml            # Docker setup for simplex-chat CLI
├── patches/
│   ├── channels-index.patch          # Patch for src/channels/index.ts
│   └── package-json.patch            # Patch for package.json
└── src/
    └── channels/
        ├── simplex.ts                # Main channel implementation (~280 lines)
        └── simplex.test.ts           # Unit tests (~280 lines)
```

## Key Features

### Channel Implementation (`simplex.ts`)

- **WebSocket Client**: Connects to simplex-chat CLI on port 5225
- **Auto-reconnection**: Automatically reconnects on connection loss
- **Message Chunking**: Splits long messages at 4000 chars
- **Event Handling**:
  - `contactRequest` → Auto-accept (if enabled)
  - `newChatItem` → Process incoming messages
  - `contactConnected` → Report chat metadata
- **JID Format**: `simplex:<contact_name>`
- **Session Format**: `agent:main:simplex:dm:<contact_name>`

### Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SIMPLEX_ENABLED` | `true` | Enable/disable channel |
| `SIMPLEX_WS_URL` | `ws://127.0.0.1:5225` | WebSocket URL |
| `SIMPLEX_AUTO_ACCEPT` | `true` | Auto-accept contact requests |
| `SIMPLEX_DISPLAY_NAME` | `nanoclaw` | Bot display name |

## Usage

### Method 1: Direct Test in NanoClaw Repo

```bash
cd /root/.openclaw/workspace/nanoclaw-simplex-skill
./test-skill.sh /path/to/your/nanoclaw
```

### Method 2: Package as Git Branch

```bash
cd /root/.openclaw/workspace/nanoclaw-simplex-skill
./package-skill.sh /path/to/nanoclaw/repo
```

Then in your nanoclaw repo:
```bash
git remote add simplex /path/to/nanoclaw/repo
git fetch simplex
git merge simplex/skill/simplex
npm install
npm run build
```

### Method 3: Manual Copy

Copy files and apply patches manually as described in SKILL.md.

## SimpleX CLI Setup

### Using Docker (Recommended)

```bash
# Run setup script
./setup-simplex.sh

# Or manually:
mkdir -p ~/.simplex
cp docker/docker-compose.yml ~/.simplex/
cd ~/.simplex
docker compose up -d

# Get your contact address
docker exec simplex-cli simplex-chat -e '/address'
```

### Using Bare-metal

```bash
# Install simplex-chat
curl -o- https://raw.githubusercontent.com/simplex-chat/simplex-chat/stable/install.sh | bash

# First run - create profile
simplex-chat
# Enter display name
# Type: /address create

# Run as service
simplex-chat -p 5225
```

## Testing

Run unit tests:
```bash
cd /path/to/nanoclaw
npx vitest run src/channels/simplex.test.ts
```

Integration test:
1. Start SimpleX CLI
2. Get your `simplex://` address
3. Connect from phone app
4. Send message - agent should reply

## Architecture Comparison

### OpenClaw SimpleX (Existing)
- Plugin-based: `api.registerChannel()`
- Uses plugin config from `openclaw.json`
- Dispatch via `api.runtime.channel.reply`

### NanoClaw SimpleX (This Skill)
- Channel interface: `registerChannel()`
- Uses NanoClaw's polling architecture
- Callback-based: `onMessage`, `onChatMetadata`

Both connect to the same SimpleX CLI WebSocket API.

## Next Steps

1. **Push to GitHub**: Create a repo and push this skill
   ```bash
   cd /root/.openclaw/workspace/nanoclaw-simplex-skill
   git init
   git add .
   git commit -m "Initial SimpleX channel skill"
   git remote add origin https://github.com/YOUR_USERNAME/nanoclaw-simplex.git
   git push -u origin main
   ```

2. **Submit to NanoClaw**: Follow the contributing guide at docs.nanoclaw.dev

3. **Test thoroughly**: Run through the full setup in a clean NanoClaw clone

## References

- [NanoClaw Contributing Guide](https://docs.nanoclaw.dev/advanced/contributing)
- [SimpleX CLI Docs](https://github.com/simplex-chat/simplex-chat/blob/stable/docs/CLI.md)
- [OpenClaw SimpleX Plugin](https://github.com/dangoldbj/openclaw-simplex) (reference implementation)
- [SimpleX Channel](https://github.com/drgoodnight/simplex-channel) (another reference)

## License

MIT (match NanoClaw's license)
