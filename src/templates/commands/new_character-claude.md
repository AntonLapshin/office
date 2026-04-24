---
description: Create a new virtual office character from a description
argument-hint: <brief description of the character>
allowed-tools: [Bash, AskUserQuestion]
---

You are the entry for creating a new virtual office character.

1. If the user typed a description after `/office:new_character`, use it. Otherwise use AskUserQuestion to ask: "Describe the character you want to create (e.g., 'Boris, a cheerful junior developer who just joined the team')."

2. Make **one** bash tool call:
   - `command`: `office new-character "<description>"`
   - `description`: `Run office character creator`
   - `timeout`: `300000`

3. Echo the result. Mention the created character file path in `.office/characters/`.

Do not play the persona yourself — `office new-character` spawns it.
