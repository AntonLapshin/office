# office

Virtual office simulation powered by LLM personas. Create spaces, characters, and run interactive turn-based sessions where AI characters interact with each other — and optionally with you.

## How it works

The tool uses Claude Code or OpenCode as LLM runners. Four persona types drive the simulation:

- **Space Creator** — generates a detailed office layout from a brief description
- **Character Creator** — generates a character profile with personality, speech patterns, and background
- **Stage Manager** — narrates physical actions, enforces spatial rules, updates character states each turn
- **Character Agent** — speaks as a specific character based on their personality and current state

## Quick start

```bash
# Install globally
npm install -g .

# Bootstrap in your project
office install

# Create a space
office new-space "An open-plan startup office with a kitchen, two phone booths, and a meeting room"

# Create characters
office new-character "Dan, 31, Senior Engineer, introverted but friendly, loves coffee"
office new-character "Boris, 26, Junior Developer, first day at the company, eager and nervous"

# Start a session (you play as Dan)
office start \
  --space open-plan-startup-office \
  --characters dan,boris \
  --description "Dan is working at his desk when Boris enters for his first day" \
  --user dan
```

## CLI commands

### `office install`

Bootstraps the `.office/` directory structure and installs `/office:new_space` and `/office:new_character` slash commands for Claude Code and OpenCode.

```bash
office install [--project-root <path>]
```

Creates:
```
.office/
├── config.json
├── spaces/
├── characters/
└── sessions/
```

### `office new-space <description>`

Spawns the Space Creator persona to generate a detailed space file.

```bash
office new-space "A cozy office with an open area and two meeting rooms"
# -> .office/spaces/a-cozy-office-with-an-open-area-and-two-meeting-rooms.md
```

The generated file includes room descriptions, an ASCII floor plan, and physical rules (adjacency, movement constraints) that the Stage Manager uses to enforce realism.

### `office new-character <description>`

Spawns the Character Creator persona to generate a detailed character profile.

```bash
office new-character "Jessica, 28, Product Designer, outgoing and opinionated"
# -> .office/characters/jessica.md
```

The generated file includes background, personality, speech patterns, and relationship defaults.

### `office start`

Creates a new session and enters the turn-based simulation loop.

```bash
office start \
  --space <name> \
  --characters <name1>,<name2>[,...] \
  [--description <text>] \
  [--user <name>] \
  [--runner claude|opencode]
```

| Option | Description |
|---|---|
| `--space` | Name of a space file in `.office/spaces/` (without `.md`) |
| `--characters` | Comma-separated character names from `.office/characters/` |
| `--description` | Scene-setting description for the session |
| `--user` | Which character you control (omit for fully autonomous simulation) |
| `--runner` | Force `claude` or `opencode` (auto-detected by default) |

### `office continue <session_name>`

Resumes a paused session from where it left off.

```bash
office continue 2026-04-24-dan-is-working-at-his-desk
```

## Opencode / Claude Code commands

After `office install`, two slash commands are available:

- `/office:new_space <description>` — create a new space
- `/office:new_character <description>` — create a new character

## Session structure

Each session lives in `.office/sessions/<id>/` and contains:

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
- `/quit` — pause the session (resume later with `office continue`)
- Empty line — skip your turn

## Configuration

`.office/config.json`:

```json
{
  "runner": null,
  "timeouts": {
    "personaRunMs": 600000
  },
  "maxRounds": 50
}
```

| Field | Default | Description |
|---|---|---|
| `runner` | `null` | Force `"claude"` or `"opencode"` (null = auto-detect) |
| `timeouts.personaRunMs` | `600000` | Max time per persona invocation (ms) |
| `maxRounds` | `50` | Safety limit for autonomous sessions |

## Development

```bash
npm install
npm run build    # compile once
npm run dev      # watch mode
```

Requires Node.js >= 18 and either `claude` or `opencode` on PATH.
