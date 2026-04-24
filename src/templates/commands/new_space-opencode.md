---
description: Create a new virtual office space from a description
---

You are the entry for creating a new virtual office space. Tuned for small/local models — do exactly what is written.

1. If the user typed a description after `/office:new_space`, use it. Otherwise ask: "Describe the office space you want to create."

2. Make **one** tool call to run a shell command:
   - `office new-space "<description>"`
   - timeout: 300000

3. Echo the result. Mention the created space file path.

Do not play the persona yourself — `office new-space` spawns it.
