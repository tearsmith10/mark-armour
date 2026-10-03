# AGENTS.md — working in this repository

Instructions for coding agents (and humans) that change this codebase.

## What this repository is

Two independent things live side by side:

1. **The app** — "My Office", a React + Vite executive task manager with a local Ollama
   AI backend. Entry point: `index.html → src/main.jsx`.
2. **The self-coding agent** — a Node.js CLI subsystem under `src/` (`main.js`,
   `agent/`, `llm/`, `tools/`, `code/`, `config/`, `logging/`, `utils/`).

**They never import from each other.** Vite only bundles from `index.html →
src/main.jsx`, so the agent code is inert to the web build. Keep it that way: do not
import agent modules from app code, and do not import app code from the agent.

A third directory, `ironclad-armory/`, is a separate nested project — leave it alone
unless that is explicitly the task.

## Commands

```sh
npm run dev          # Vite dev server (app)
npm run build        # production build (app) — must stay green
npm run typecheck    # tsc --noEmit --checkJs over the agent subsystem + tests
npm test             # node --test tests/**/*.test.js (no test dependencies)
npm run verify       # typecheck && test && build — run this before declaring done
npm run agent -- "<task>"           # run the agent on a task
npm run agent -- --doctor           # diagnose the environment first
```

There is no formatter or linter configured — the repository had none and adding one
would reformat the whole app. Match the surrounding style instead.

## Conventions

- **Language**: plain JavaScript ESM with JSDoc types. New code must typecheck under
  `npm run typecheck` (strict `checkJs`).
- **No new runtime dependencies** for the agent — it runs on Node builtins
  (`fetch`, `node:test`, `node:http`, `node:child_process`). DevDeps are limited to
  `typescript` and `@types/node`.
- **Results over exceptions**: tools and subsystems return
  `{ ok, data, error, meta }` (`src/utils/result.js`) so failures stay structured.
- **Every user-visible string should say what to do next** — errors name the fix,
  diagnostics ship a `fix:` hint.
- **Tests are part of the deliverable**: put new suites in `tests/*.test.js`, use temp
  workspaces (`mkdtemp`) and clean up with `t.after(...)`.

## Safety rules

- Never commit or print secrets. `.env` is read for configuration; `.env.local` is
  deliberately **not** loaded (it holds deploy secrets). `.env.example` documents
  every variable and must contain no real values.
- Keep the path sandbox (`src/tools/safety.js`) and the command deny-list intact —
  other tests depend on them.
- Never run destructive commands (`rm -rf`, `git reset --hard`, `vercel --prod`, …)
  in this repository as an agent; `--allow-unsafe` exists but should stay off.
- `.agent/` holds run records and logs (gitignored). Don't delete it while a run is
  in progress.

## Running and reverting agent changes

```sh
npm run agent -- -i "<task>"     # plan first, ask before editing
npm run agent -- --list-runs     # history of past runs
npm run agent -- --undo latest   # revert the last run's file changes
```

Undo only covers `write_file`/`edit_file` mutations recorded in a run, and it refuses
to touch files that were modified after that run.

## Environment notes (this machine)

- **Git 2.55 is installed** at `C:\Program Files\Git\cmd` (may need `set PATH=...`
  in a shell started before the install). The repo was initialized on `main` with a
  local identity (`git config user.name/user.email` — repository-local, not global).
- **Ollama is installed and running**; `.env` sets `AGENT_LLM_PROVIDER=ollama` and
  `AGENT_LLM_MODEL` to a model that `ollama list` actually has (`qwen2.5-coder:3b`),
  so `--doctor` is green. Local CPU inference is slow (a planner call can take minutes).
- **`npm link` installs a global `office-agent` command** — it runs through a
  junction path, so entry-point detection in `src/main.js` compares realpaths.
- **This shell mangles double quotes** (they reach cmd as `\"…\"`): prefer no quotes
  (use the `workdir` parameter and `set PATH=...` unquoted) or write temp scripts and
  run them with `node <path>`.
- **Never put a space before `&` after `set PATH=...;%PATH%`** — the trailing space
  corrupts the *last* PATH entry (here: `%APPDATA%\npm`, i.e. the `office-agent`
  command vanishes while `where office-agent` still finds it). Write `…;%PATH%&`.

## When you are done

Run `npm run verify`. It must be green (typecheck, tests, build). Report honestly:
if something was not verified, say so.
