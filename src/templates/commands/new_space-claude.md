---
description: Create a new virtual office space from a description
argument-hint: <brief description of the space>
allowed-tools: [Bash, AskUserQuestion]
---

You are the entry for creating a new virtual office space.

1. If the user typed a description after `/office:new_space`, use it. Otherwise use AskUserQuestion to ask: "Describe the office space you want to create (e.g., 'a cozy startup office with a kitchen and meeting room')."

2. Make **one** bash tool call:
   - `command`: `office new-space "<description>"`
   - `description`: `Run office space creator`
   - `timeout`: `300000`

3. Echo the result. Mention the created space file path in `.office/spaces/`.

Do not play the persona yourself — `office new-space` spawns it.
