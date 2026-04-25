# office

Virtual office simulation powered by LLM personas. Create spaces, characters, and run interactive turn-based sessions where AI characters interact with each other — and optionally with you.

## How it works

The tool makes direct API calls to an LLM provider (Ollama, Google AI Studio, Anthropic, OpenAI, or any OpenAI-compatible endpoint). Four persona types drive the simulation:

- **Space Creator** — generates a detailed office layout from a brief description
- **Character Creator** — generates a character profile with personality, speech patterns, and background
- **Stage Manager** — updates character states (location, mood, intents, memory, relationships) and narrates physical actions
- **Character Agent** — speaks as a specific character based on their personality and current state

## Prerequisites

- **Node.js >= 18**
- An LLM provider: **Ollama** running locally (default), or an API key for a cloud provider

## Quick start

```bash
npm install -g .

office init

office space create An open-plan startup office with a kitchen and a meeting room

office character create Dan, 31, Senior Engineer, introverted but friendly, loves coffee
office character create Boris, 26, Junior Developer, first day at the company, eager and nervous

office session start \
  --space open-plan-startup-office-with-a-kitchen-and-a-meeting-room \
  --characters dan,boris \
  --description "Dan is working at his desk when Boris enters for his first day" \
  --user dan
```

## CLI commands

### Setup

```bash
office init                              # Initialize .office/ directory and default config
```

### Spaces

```bash
office space create <description...>     # Generate a new space
office space list                        # List all spaces
```

### Characters

```bash
office character create <description...> # Generate a new character
office character list                    # List all characters
```

### Sessions

```bash
office session start [options]           # Create and run a new session
office session continue <session_name>   # Resume a paused session
office session list                      # List all sessions
```

#### session start options

| Option | Description |
|---|---|
| `--space <name>` | Name of a space (as shown by `office space list`) |
| `--characters <names>` | Comma-separated character names |
| `--description <text>` | Scene-setting description (default: "Office simulation") |
| `--user <name>` | Which character you control (omit for fully autonomous) |

## Providers

The tool supports multiple LLM providers. Set the active provider in `.office/config.json` and define provider details in the `providers` map.

### Ollama (default, local)

No API key needed. Install Ollama and pull a model:

```bash
ollama pull llama3.2
```

Config (this is the default):

```json
{
  "provider": "ollama",
  "providers": {
    "ollama": {
      "api": "openai",
      "baseUrl": "http://localhost:11434",
      "defaultModel": "llama3.2"
    }
  }
}
```

### Google AI Studio

```json
{
  "provider": "google",
  "providers": {
    "google": {
      "api": "openai",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai",
      "apiKeyEnv": "GOOGLE_API_KEY",
      "defaultModel": "gemini-2.0-flash"
    }
  }
}
```

Set `GOOGLE_API_KEY` in your environment or in `.office/.env`:

```
GOOGLE_API_KEY=your-key-here
```

### Anthropic

```json
{
  "provider": "anthropic",
  "providers": {
    "anthropic": {
      "api": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "defaultModel": "claude-sonnet-4-6"
    }
  }
}
```

### OpenAI

```json
{
  "provider": "openai",
  "providers": {
    "openai": {
      "api": "openai",
      "baseUrl": "https://api.openai.com",
      "apiKeyEnv": "OPENAI_API_KEY",
      "defaultModel": "gpt-4o-mini"
    }
  }
}
```

### Custom / OpenAI-compatible

Any endpoint that speaks the OpenAI chat completions API works:

```json
{
  "provider": "my-server",
  "providers": {
    "my-server": {
      "api": "openai",
      "baseUrl": "http://my-server:8080",
      "defaultModel": "my-model"
    }
  }
}
```

### Provider fields

| Field | Required | Description |
|---|---|---|
| `api` | no | `"openai"` (default) or `"anthropic"` — which HTTP API format to use |
| `baseUrl` | yes | Base URL of the provider API |
| `apiKeyEnv` | no | Name of the environment variable holding the API key |
| `defaultModel` | yes | Default model name for this provider |

## API keys and .env

API keys are read from environment variables. The variable name is configured per provider via `apiKeyEnv`.

The tool loads `.env` files automatically (does not overwrite existing env vars):
- `.office/.env` (checked first)
- `.env` in the project root

Example `.office/.env`:

```
GOOGLE_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## Configuration

Full `.office/config.json` reference:

```json
{
  "provider": "ollama",
  "providers": {
    "ollama": {
      "api": "openai",
      "baseUrl": "http://localhost:11434",
      "defaultModel": "llama3.2"
    }
  },
  "models": {
    "stage-manager": null,
    "character-agent": null,
    "character-creator": null,
    "space-creator": null
  },
  "logging": true,
  "maxRounds": 50,
  "retries": 3,
  "delayMs": 0,
  "timeoutMs": 300000
}
```

| Field | Default | Description |
|---|---|---|
| `provider` | `"ollama"` | Key into `providers` — which provider to use |
| `providers` | (ollama) | Map of provider name to provider config |
| `models` | all null | Per-role model overrides (falls back to provider's `defaultModel`) |
| `logging` | `true` | Print LLM call details to console, write full logs to `.office/logs/` |
| `maxRounds` | `50` | Safety limit for autonomous sessions |
| `retries` | `3` | Retry count per LLM call on failure |
| `delayMs` | `0` | Delay before each LLM call (ms), useful for rate limiting |
| `timeoutMs` | `300000` | Timeout per LLM call (ms) |

## Session structure

Each session is stored in `.office/sessions/<id>/`:

```
session.json          # Metadata, turn cursor, status
<space_name>.txt      # Cloned space description
<character>.txt       # Cloned character profiles
<character>.json      # Live character state (location, mood, intents, memory, relationships)
timeline.log          # Full log of speech and narration
logs.txt              # Session-specific operation log
```

### Turn loop

1. Each character takes a turn (in order):
   - **NPC**: Character Agent generates one line of speech
   - **You** (if `--user` is set): prompted for input
2. After each speech, the **Stage Manager** updates all character states and optionally narrates physical actions
3. Next round begins

### Timeline format

```
[Stage Manager] Dan is working at his desk when Boris enters for his first day
Boris => Dan: Hey, I'm Boris — just started today. Are you Dan?
[Stage Manager] Boris walks closer to Dan's desk. Dan looks up from his screen.
Dan => Boris: Hey Boris, welcome! Let me show you around.
```

### User input

When it's your turn:

```
[You as Dan] > Boris: Hey, welcome to the team!
```

- `Name: message` — address a specific character
- Just a message — addresses everyone in the room
- `/quit` — pause the session
- Empty line — skip your turn

## Logging

All LLM calls are logged to:
- **Console** — when `logging: true`, one-line summary per call (role, model, attempt, duration, status)
- **`.office/performance.txt`** — structured timing data for every call
- **`.office/logs/`** — full prompt + response per call, for debugging
- **`.office/logs.txt`** — operation-level log (timestamped events)

## Development

```bash
npm install
npm run build    # compile once
npm run dev      # watch mode
```
