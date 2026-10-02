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
5. Write `prompts/promptN-response.md` (see Response files below).
6. Mark the prompt DONE in `prompts/PROGRESS.md` (keep the file's format).
7. Commit your work, including the response file,
   e.g. `prompt2: into-the-horizon valley view`.

## Response files

`prompts/promptN-response.md` is the project's memory of *why*, not just
*what*. Finch reads it when reviewing and writing the next prompt. Write it
honestly — a claimed verification you didn't perform is worse than an
admitted gap. Include:

- What changed: files created/modified and the key decisions you made.
- Verification: for each acceptance criterion, the exact commands you ran
  and what you observed (not just "it works").
- Deferred or skipped: what you deliberately left out and why.
- Notes for the next prompt: surprises, tech debt, open questions.

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
