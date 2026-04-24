# office

Virtual office simulation powered by LLM personas. Create spaces, characters, and run interactive turn-based sessions where AI characters interact with each other — and optionally with you.

Runs inside a Docker container so agents have full filesystem permissions and nothing touches your local project.

## How it works

The tool uses Claude Code or OpenCode as LLM runners. Four persona types drive the simulation:

- **Space Creator** — generates a detailed office layout from a brief description
- **Character Creator** — generates a character profile with personality, speech patterns, and background
- **Stage Manager** — narrates physical actions, enforces spatial rules, updates character states each turn
- **Character Agent** — speaks as a specific character based on their personality and current state

## Prerequisites

- **Node.js >= 18**
- **Docker** — the simulation runs inside a container

## Quick start

```bash
# Install globally
npm install -g .

# Start the office container (builds the image on first run)
office start

# Create a space
office space create An open-plan startup office with a kitchen and a meeting room

# Create characters
office character create Dan, 31, Senior Engineer, introverted but friendly, loves coffee
office character create Boris, 26, Junior Developer, first day at the company, eager and nervous

# Start a session (you play as Dan)
office session start \
  --space open-plan-startup-office-with-a-kitchen-and-a-meeting-room \
  --characters dan,boris \
  --description "Dan is working at his desk when Boris enters for his first day" \
  --user dan

# When done
office stop
```

## CLI commands

### Container lifecycle

```bash
office start       # Start container (builds image on first run, inits data on first start)
office stop        # Stop container (data is preserved)
office restart     # Rebuild image and recreate container from scratch
office status      # Show whether the container is running
```

### Spaces

```bash
office space create <description...>     # Generate a new space
office space list                        # List all spaces
```

The generated space file includes room descriptions, an ASCII floor plan, and physical rules (adjacency, movement constraints) that the Stage Manager uses to enforce realism.

### Characters

```bash
office character create <description...>  # Generate a new character
office character list                     # List all characters
```

The generated character file includes background, personality, speech patterns, and relationship defaults.

### Sessions

```bash
office session start [options]           # Create and run a new session
office session continue <session_name>   # Resume a paused session
office session list                      # List all sessions
```

#### `office session start` options

| Option | Description |
|---|---|
| `--space <name>` | Name of a space (as shown by `office space list`) |
| `--characters <names>` | Comma-separated character names |
| `--description <text>` | Scene-setting description (default: "Office simulation") |
| `--user <name>` | Which character you control (omit for fully autonomous) |

## Configuration

Place a `config.json` in the directory where you run `office start`. It will be mounted into the container automatically.

```json
{
  "runner": "opencode",
  "logging": true,
  "timeouts": {
    "personaRunMs": 600000
  },
  "maxRounds": 50
}
```

| Field | Default | Description |
|---|---|---|
| `runner` | `"opencode"` | Force `"claude"` or `"opencode"` (null = auto-detect) |
| `logging` | `true` | Print runner commands, keep prompt files for inspection |
| `timeouts.personaRunMs` | `600000` | Max time per persona invocation (ms) |
| `maxRounds` | `50` | Safety limit for autonomous sessions |

When `logging` is enabled you will see the full agent output (tool calls, reasoning, errors) and the prompt files are kept in `.office/` inside the container for inspection.

## Using OpenCode with local models

Place an `opencode.json` next to your `config.json`. It will be mounted into the container automatically.

Use `host.docker.internal` instead of `localhost` to reach Ollama running on the host:

```json
{
  "provider": {
    "ollama": {
      "apiBase": "http://host.docker.internal:11434"
    }
  }
}
```

## Session structure

Each session is stored inside the container and contains:

```
session.json          # Metadata, turn cursor, status
<space_name>.md       # Cloned space description
<character>.md        # Cloned character profiles
<character>.json      # Live character state (location, mood, intents, memory, relationships)
timeline.log          # Full log of speech and narration
```

### Turn loop

1. **Stage Manager** narrates the current scene
2. Each character takes a turn (in order):
   - **NPC**: Character Agent generates speech based on personality and state
   - **You** (if `--user` is set): prompted for input
3. After each speech, the **Stage Manager** updates character states and narrates physical actions
4. Next round begins

### Timeline format

```
[Stage Manager] The morning sun streams through the office windows. Dan is at his desk.
Boris => Dan: Hey, I'm Boris — just started today. Are you Dan?
[Stage Manager] Boris walks closer to Dan's desk. Dan looks up from his screen.
Dan => Boris: Hey Boris, welcome! Let me show you around.
```

### User input

When it's your turn, type your speech at the prompt:

```
[You as Dan] > Boris: Hey, welcome to the team!
```

- `Name: message` — address a specific character
- Just a message — addresses everyone in the room
- `/quit` — pause the session (resume later with `office session continue`)
- Empty line — skip your turn

## Data persistence

All data (spaces, characters, sessions) is stored in a Docker named volume called `office-data`. It persists across `office stop` / `office start` cycles and even if the container is removed.

## Authentication

**Claude Code**: Your `~/.claude` directory is mounted read-only into the container. If you're already logged in on the host, it works automatically. Alternatively, set `ANTHROPIC_API_KEY` in your environment before running `office start`.

**OpenCode**: Place an `opencode.json` in your working directory (see above).

## Development

```bash
npm install
npm run build    # compile once
npm run dev      # watch mode
```

After code changes, rebuild everything with a single command:

```bash
office restart
```
