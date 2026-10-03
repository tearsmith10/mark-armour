# My Office — Executive Task Manager with Local Ollama AI

Fast, modern, premium executive to-do app (Trello-style Kanban). React + Vite. Data stays in `localStorage`. AI runs **100% locally via Ollama** — no cloud calls.

## Features

### Navigation & views
- 📑 **Left navigation**: **Today · Board · Calendar · Projects · Inbox** (bottom bar on mobile)
- ➕ Clear **"+ New Task"** button in the top bar (shortcut `N`)
- 📅 **Today dashboard**: Today's tasks, High priority, **Overdue**, Upcoming, Completed — deduplicated, one click opens the task
- 📆 **Calendar**: month grid built from existing task dates, today highlighted, click a task to open it
- 🏷 **Projects**: tasks grouped by label/tag with open/total counts
- 📥 **Inbox**: unscheduled tasks (no due date) — capture now, schedule later

### Cards & task management
- ✅ Add tasks, toggle completion, delete tasks
- 📋 Multiple lists (To Do / In Progress / Done), add/delete lists (+ any custom list)
- 🖱️ Drag & drop between lists (HTML5, no dependency) with a highlighted drop target — plus a **⇄ Move to…** select on every card (touch-friendly)
- 🃏 **Title-first cards**: neat pill row for date, priority, status, type, tags and subtask progress
- 🚨 **Overdue indicator**: red date pill + red accent when a due date passes
- 📝 **Task details panel** (click a card): description, due date, priority, status, type, tags, subtasks, notes and **activity/history** (created, completed, moved, edited…)
- 🔍 Search + filters (status, type) + **sort by due date** + clear button
- 💾 Persistence in `localStorage`, **export / import JSON** backup (sidebar footer)
- 🌙 Dark **and** light theme (top bar + login page), persisted

### Local AI (Ollama)
- 💬 **Command understanding** (chat panel or the quick chips):
  - `"Plan my day"` / `"Executive briefing"` → deals to close, top-3 priorities, conference prep
  - `"What should I do first?"` → single prioritized next action
  - `"Show my overdue tasks"` → instant local answer (no model call)
  - `"Create a high-priority task to call the supplier tomorrow"` → creates the task
- ✨ **Natural-language task creation** in the New Task modal: extracts **task name, date, priority and type** (plus tags) with local AI — manual fields stay editable
- ✂️ **Break into subtasks** (✨ on any card)
- 💡 AI panel has a model dropdown; status pill in the top bar

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| `N` | New task |
| `/` | Search |
| `T` | Today view |
| `B` | Board view |
| `A` | Toggle AI panel |
| `Esc` | Close panel / modal |

(Shortcuts are ignored while typing in a field.)

## Prerequisites
1. **Node.js 18+** — https://nodejs.org/ (`node -v`)
2. **Ollama** — https://ollama.com/download
   ```sh
   ollama pull llama3.1
   ollama serve
   ```
   Default model is `llama3.1` (override via `.env` or the AI panel dropdown).
   Note: on CPU-only machines a model call can take 1–3 minutes — the chat shows "…thinking locally".

## Run
```sh
npm install
cp .env.example .env   # optional
npm run dev            # → http://localhost:5173
```

## Ollama connection notes
- **Dev (`npm run dev`)**: Vite proxies `/ollama/*` → `http://localhost:11434/*` (`vite.config.js`), so no CORS setup is needed.
- **Direct calls**: allow the origin —
  - Windows (PowerShell): `$env:OLLAMA_ORIGINS="*"; ollama serve`
  - macOS/Linux: `OLLAMA_ORIGINS=* ollama serve`
- Status pill in the top bar: `connected`, `running, no models pulled`, or `unreachable`.
- List models: `ollama list` (the dropdown reads `GET /api/tags`).

## Seed board (30 CEO tasks)
- First run for a new account loads `src/lib/seed.js` → `executiveBoard()`: 30 dated tasks for **Oct–Dec 2026** (meetings, deals to close, conferences), tagged by month + type, with active negotiations pre-placed in **InProgress**.
- Sidebar → **↺ CEO board** reseeds after confirmation.
- **Existing boards are never touched**: keys are per account (`ceo-office-board-<email>-v1`), so upgrading the app keeps all data.

## Auth notes (local-first)
- Accounts/sessions live only in this browser (`ceo-office-users-v1`, `ceo-office-session-v1`); boards are namespaced `ceo-office-board-<email>-v1`; theme is `ceo-office-theme`.
- Passwords are hashed with salted SHA-256 (Web Crypto) — never stored in plaintext. Demo-grade local auth, **not** a production identity system.
- **Google button**: creates a local demo session (`src/lib/auth.js → googleContinue()`). For real Google Sign-In, create an OAuth Client ID in Google Cloud Console, set `VITE_GOOGLE_CLIENT_ID` in `.env`, and swap in Google Identity Services — button and session plumbing are already in place.

## Share a test URL (Cloudflare quick tunnel)
```sh
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173
# → prints a public https://…trycloudflare.com URL you can send to testers
```
- Keep `npm run dev` (and Ollama, for AI features) running; the URL dies when the tunnel stops and **changes on every restart** — send the fresh URL each time.
- Alternative: `npx -y localtunnel --port 5173` (first visit asks for this machine's public IP as the password).

## Project structure
```
src/
  App.jsx                  # state, views, shortcuts, move/delete/update, AI wiring
  components/Sidebar.jsx   # left navigation + export/import/reseed
  components/CardItem.jsx  # title-first card, pills, move select, drag handle
  components/TaskDetail.jsx# details panel: desc/dates/priority/subtasks/notes/activity
  components/NewTaskModal.jsx # natural-language + manual task creation
  components/AiPanel.jsx   # chat, command routing, chips, model picker
  components/Login.jsx     # sign in / sign up / Google / theme toggle
  views/TodayView.jsx      # dashboard sections
  views/CalendarView.jsx   # month grid from task dates
  views/OtherViews.jsx     # Projects (by tag) + Inbox (no due date)
  lib/dates.js             # due labels, overdue check, formatting
  lib/storage.js           # per-account load/save/export/import
  lib/ai.js                # Ollama client + parse/breakdown/briefing/prioritize
  lib/seed.js              # 30-task CEO board
  lib/auth.js              # local accounts + Google demo session
  index.css                # dark/light tokens, layout, responsive (mobile bottom nav)
```

## API used (Ollama, all localhost)
- `GET /api/tags` → list local models
- `POST /api/generate` with `{model, prompt, stream:false}` → parse / breakdown / briefing
- `POST /api/chat` with `{model, messages, stream:false}` → assistant chat
- `GET /api/ps` → check what is loaded (optional)

---

# Self-coding agent

A modular agent subsystem that inspects this repository, plans a change, executes it with
tools, validates the result, repairs failures and reports honestly. It is **inert to the web
app build** — Vite only bundles from `index.html → src/main.jsx`, so nothing under
`src/agent`, `src/llm`, `src/tools`, `src/code`, `src/config`, `src/logging` or `src/utils`
is ever pulled into the shipped bundle.

Design and file-by-file detail: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Start here

```sh
npm run agent -- --doctor     # 10 checks: provider, git, validation, workspace … + fixes
npm link                      # optional: installs a global `office-agent` command
office-agent --doctor         # then run it from any directory
```

## Run it

```sh
npm run agent -- "add input validation to the task form"   # full run
npm run agent -- -i "refactor the date helpers"            # shows the plan, asks before editing
npm run agent -- --dry-run "refactor the date helpers"     # plan only, touches nothing
npm run agent -- --list-runs                               # run history (newest first)
npm run agent -- --undo latest                             # revert the last run's file changes
npm run agent -- --list-tools                              # show the tool registry
npm run agent -- --list-providers                          # show LLM provider options
npm run agent -- -j --provider mock "inspect this project" # JSON run record on stdout
```

After `npm link` every command above also works as `office-agent …` from anywhere
(pass the target repo with `--workspace <dir>`).

Argument handling: flags go before the task; unknown dashed words inside the task
text (e.g. `add a --version flag`) are kept as task text, wrapping quotes are
stripped, and `--` forces everything after it to be literal.

Exit codes: `0` success/dry-run/rejection · `1` failed or partial · `2` usage/config error.

Useful flags (all have env equivalents in `.env.example`):

| Flag | Env | Default | Meaning |
|------|-----|---------|---------|
| `--provider <id>` | `AGENT_LLM_PROVIDER` | `ollama` | `ollama` \| `openai` \| `anthropic` \| `mock` |
| `--model <name>` | `AGENT_LLM_MODEL` | per provider | model override |
| `--dry-run` / `-n` | — | off | stop after the PLAN stage |
| `--interactive` / `-i` | — | off | print the plan and ask before executing (EOF ⇒ no) |
| `--max-steps <n>` | `AGENT_MAX_STEPS` | 24 | total tool actions per run |
| `--max-repairs <n>` | `AGENT_MAX_REPAIRS` | 3 | verify→fix attempts |
| `--no-verify` | `AGENT_NO_VERIFY` | off | skip validation (not recommended) |
| `--allow-unsafe` | `AGENT_ALLOW_UNSAFE` | off | permit destructive commands for this run |
| `--undo <id\|latest>` | — | — | revert a run's file changes (`--list-runs` for ids) |
| `--list-runs` | — | — | run history, including undo records |
| `--doctor` | — | — | environment diagnosis with concrete fixes |
| `--verbose` / `-v` | — | off | debug logging on stderr |
| `--quiet` / `-q` | — | off | warnings and errors only |
| `--json` / `-j` | — | off | print the run record / doctor / undo result as JSON |
| `--workspace <dir>` | — | repo root | run against another workspace |

## Providers

- **ollama** (default) — local model, no key, matches the app's existing `/ollama` proxy usage.
- **openai** — OpenAI or any OpenAI-compatible gateway (`OPENAI_BASE_URL`).
- **anthropic** — Anthropic Messages API.
- **mock** — deterministic offline model (tests, CI, demos). Script individual turns with
  `AGENT_MOCK_SCRIPT`.

Keys come from the environment only (`.env.example` documents them; `.env` is gitignored).
`.env.local` is deliberately **not** loaded by the agent — it holds deploy secrets.

## Safety rails

- Path sandbox: every read/write is resolved against the workspace root; `../` escapes,
  absolute paths outside the repo, `.env*` (except `.env.example`), key files (`.pem`,
  `id_rsa`, …) and `.git/*` writes are rejected with structured errors.
- Command deny-list: `rm -rf`, `git reset --hard`, `drop table`, `| bash`, `vercel --prod`
  … are blocked unless you explicitly pass `--allow-unsafe`.
- Redaction: credential-shaped strings (`sk-…`, `Bearer …`, JWTs, `password=…`) are masked
  in logs, tool output and reports.
- Budgets: max actions per run, max actions per model turn, max repair attempts, hard
  command timeouts with full process-tree kill (so no orphaned children lock directories).
- Loop guard: three identical consecutive tool calls stop the run (a model that keeps
  re-issuing the same write cannot burn the budget), and the prompt forbids repeats.
- Every run is recorded to `.agent/runs/<id>.json` (task, plan, actions, errors, validation,
  review, status) and logged to `.agent/logs/agent.log`.
- Approval gate (`-i`): the plan is printed and execution waits for an explicit yes; EOF or
  anything but `y`/`yes` runs nothing and records a `dry-run`.
- Undo: every file mutation stores the previous version plus a hash of what the run left
  behind, so `--undo latest` reverts it — and refuses to touch files that were changed
  after that run (undo never clobbers newer work). Successful undos are audited too.

## Verification

```sh
npm run verify      # typecheck (tsc --checkJs) && 97 tests && vite build
npm run typecheck   # JSDoc types across the agent subsystem + tests
npm test            # node --test, no extra dependencies
npm run build       # the existing React app must keep building
```

The agent validates with the same chain: it auto-detects `test|lint|typecheck|check|build`
scripts from `package.json`, honours `AGENT_VERIFY_COMMANDS`, and falls back to `node --check`
over the sources when the project defines none.

## Layout added by the agent

```
src/
  main.js            CLI entry (flags, exit codes, report output)
  agent/             orchestrator: context → plan → approve → execute → verify → fix → report
    doctor/          environment diagnosis (10 checks, each with a fix)
    undo/            run history + reverting a run's file changes
  llm/               provider adapters (ollama/openai/anthropic/mock) + model catalog
  tools/             registry + the 9 required tools (fs, search, terminal, tests, git)
  code/              project analyzer, targeted search, recent-file parser
  config/            settings loader (env + overrides, precedence rules)
  logging/           leveled logger with redaction + file sink
  utils/             Result type, text/redaction helpers, shared JSDoc typedefs
tests/               node:test suites for the agent subsystem (incl. adapter contract tests)
tsconfig.json        scoped typecheck (agent code only; the React app is untouched)
ARCHITECTURE.md      full architecture documentation
AGENTS.md            instructions for coding agents working in this repository
```
