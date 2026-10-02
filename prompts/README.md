# Prompt workflow

Finch (Kevin's assistant) authors numbered build prompts. Claude Code executes
them one at a time. Kevin drives with a single command.

## The command

Kevin types: **do the next prompt**

When you (Claude Code) see that, do exactly this:

1. Read `prompts/PROGRESS.md`.
2. Find the first prompt marked PENDING (lowest number wins).
3. Execute that prompt file completely — including its acceptance criteria.
4. Verify the acceptance criteria yourself before finishing.
5. Mark the prompt DONE in `prompts/PROGRESS.md` (keep the file's format).
6. Commit your work, e.g. `prompt2: into-the-horizon valley view`.

## Rules

- Never invent the next prompt. If every prompt in PROGRESS.md is DONE, say
  "No pending prompts — ask Finch for the next one." and stop.
- Never skip a prompt or do two at once. One prompt per command.
- If a prompt's acceptance criteria can't be met, stop, explain what's
  blocking, and leave the prompt marked PENDING.
- Finch adds new prompts as `prompts/promptN.md` (next free number) and marks
  them PENDING in PROGRESS.md. You don't renumber anything, ever.
- The design source of truth is `DESIGN.md`. Prompts refine it; they never
  contradict it. If a prompt conflicts with DESIGN.md, flag it and wait.
