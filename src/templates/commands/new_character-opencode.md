---
description: Create a new virtual office character from a description
---

You are the entry for creating a new virtual office character. Tuned for small/local models — do exactly what is written.

1. If the user typed a description after `/office:new_character`, use it. Otherwise ask: "Describe the character you want to create."

2. Make **one** tool call to run a shell command:
   - `office new-character "<description>"`
   - timeout: 300000

3. Echo the result. Mention the created character file path.

Do not play the persona yourself — `office new-character` spawns it.
