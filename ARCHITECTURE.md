# Architecture — Self-Coding Agent

This document describes the agent subsystem added to the `trello-todo-ai` repository: its
layout, the lifecycle it runs, how each subsystem is wired, and where its limits are.

The existing React + Vite app is **unchanged in behaviour**. Vite bundles exclusively from
`index.html → /src/main.jsx`; no app file imports an agent module, so all agent code is
inert to the web build (verified: `npm run build` produces the same 45-module graph).

---

## 1. Design constraints

| Constraint | How it is met |
|---|---|
| Match the existing stack | Plain ESM JavaScript + JSDoc types (the repo has no TypeScript, no JSX in these dirs). `type: module` already set in `package.json`. |
| No invented dependencies | Zero runtime dependencies: built-in `fetch`, `node:test`, `node:util`, `process.loadEnvFile`. Only dev-deps added: `typescript` (type checking) + `@types/node`. |
| Adapt, don't replace | New code lives in new directories under `src/`; the app's own scripts (`dev`, `build`, `preview`) are untouched, new scripts were added alongside. |
| Not a placeholder | Every module is exercised by `tests/` and by a real CLI run; no stubs, no TODO bodies. |

## 2. Directory map

```
src/
├── main.js              CLI: parses flags, loads settings, runs the Agent, prints report
├── agent/               the lifecycle itself
│   ├── Agent.js         orchestrator (single entry point: Agent.run)
│   ├── prompts.js       prompt contract shared by every stage + system policy
│   ├── context/         buildContext — targeted, budgeted context gathering
│   ├── planner/         createPlan — LLM plan with heuristic fallback
│   ├── executor/        executePlan, parseDecision, runSingleAction (action budget)
│   ├── verifier/        runValidation + verifyAndRepair (bounded self-correction)
│   ├── report/          buildReport — LLM summary with deterministic fallback
│   ├── doctor/          runDoctor — environment/provider/workspace diagnostics
│   ├── undo/            listRuns, loadRun, undoRun — revert a run's file changes
│   └── memory/          Memory — run record, action log, persistence to .agent/runs
├── llm/                 provider abstraction
│   ├── models.js        catalog of providers/models (ids, defaults, key requirements)
│   ├── provider.js      createProvider / describeProvider (env-driven selection)
│   └── adapters/        http.js (fetch + timeout), ollama.js, openai.js, anthropic.js, mock.js
├── tools/               modular tool registry
│   ├── registry.js      ToolRegistry: register/list/manifest/execute, structured results
│   ├── safety.js        path sandbox (resolveSafe), command deny-list (checkCommand)
│   ├── index.js         DEFAULT_TOOLS + createRegistry (wires all 9 required tools)
│   ├── filesystem/      read_file, write_file, edit_file, list_files
│   ├── repository/      search_files
│   ├── terminal/        run_command (runShell: timeout + process-tree kill)
│   ├── testing/         run_tests (script detection, node --check fallback)
│   └── git/             git_status, git_diff (graceful when git is absent)
├── code/                repo awareness
│   ├── analyzer/        analyzeProject — package manifests, languages, validation candidates
│   ├── search/          tokenize + searchRelevant / searchByFileName (targeted retrieval)
│   └── parser/          recentFiles — mtime-ranked recent sources
├── config/index.js      loadSettings: defaults < env < explicit overrides
├── logging/logger.js    leveled, redacted, file-sink logger with child loggers
└── utils/               result.js (ok/err), text.js (truncate/redact/safeJsonParse), types.js

tests/                   node:test suites (registry, safety, filesystem, terminal,
                         llm/planner, adapters, doctor, undo, cli, full agent lifecycle)
tsconfig.json            scoped to the agent dirs + tests (checkJs, noEmit, strict)
```

## 3. Lifecycle

```
                ┌──────────────────────────────────────────────────────────┐
 task (argv) ──►│ 1 CONTEXT    buildContext: project analysis + targeted    │
                │              search + tree + recent files + git summary  │
                │              (budgeted, never the whole repo)            │
                ├──────────────────────────────────────────────────────────┤
                │ 2 PLAN       createPlan: LLM → validated Plan            │
                │              ↳ any failure ⇒ heuristicPlan (always runs) │
                ├──────────────────────────────────────────────────────────┤
                │ 3 APPROVE   optional gate (-i): print the plan, ask the   │
                │              human. "No"/EOF ⇒ status dry-run, 0 actions  │
                ├──────────────────────────────────────────────────────────┤
                │ 4 EXECUTE    executePlan: plan steps, then model turns   │
                │              ↳ action budget (maxSteps / maxActions)     │
                │              ↳ every action recorded to Memory           │
                ├──────────────────────────────────────────────────────────┤
                │ 5 VERIFY     runValidation: detected script, else        │
                │              AGENT_VERIFY_COMMANDS, else `node --check`  │
                ├──────────────────────────────────────────────────────────┤
                │ 6 FIX        verifyAndRepair: model repairs ⇄ re-verify  │
                │              ↳ bounded by maxRepairs, stops on no progress│
                ├──────────────────────────────────────────────────────────┤
                │ 7 REVIEW     git diff when available, else the action    │
                │              log of files this run wrote/edited          │
                ├──────────────────────────────────────────────────────────┤
                │ 8 REPORT     status decided from reality, then LLM       │
                │              summary ⇄ deterministic fallback            │
                └──────────────────────────────────────────────────────────┘
                        │
                        ▼
        .agent/runs/<id>.json   +   .agent/logs/agent.log   +   report on stdout
```

### Status semantics (decided from verification, before the report is rendered)

| Status | Meaning | Exit code |
|---|---|---|
| `success` | executor finished **and** validation is green — including the auto-finish case below | 0 |
| `partial` | validation is green but autonomy stopped early **without** the auto-finish conditions (LLM unreachable, plan incomplete, validation never ran, or the planned mutation never succeeded) — honest "inspected, not fully executed" | 1 |
| `failed` | validation is red, or a fatal error occurred | 1 |
| `dry-run` | `--dry-run`: plan only, nothing executed | 0 |

A `dry-run` can never be reported as `success`: the reporter is forced to the dry-run
status and its "changes"/"validation" sections are blanked.

**Auto-finish**: small models often never emit `{"done": true}`. When the loop guard or
the action budget stops a stuck model, the executor finishes on its own **only if** every
planned step executed, project validation passed, and (for plans meant to change files) a
`write_file`/`edit_file` succeeded. It records `Auto-finish (loop|budget): …` in
`record.errors` so the report always says it happened. LLM/infrastructure failures never
auto-finish — those stay `partial`.

### Loop guards (executor)

Small local models can fail to finish: a real run against `llama3.2:latest` re-issued the
same `write_file` 22 times and never returned `{"done": true}`, burning the whole action
budget (6 minutes of inference for a one-line file). The executor now has two independent
stoppers, and the prompt forbids repeats outright:

1. **Loop guard** — three consecutive *identical* tool calls (same tool + same args) stop
   the run before the repeat executes, with `Loop detected: …` in `record.errors`.
   Distinct calls (real exploration) never trip it; the counter resets on any change.
2. **Action budget** — `maxSteps` remains the hard backstop for models that vary their
   calls while still going nowhere.

## 4. Subsystems in detail

### 4.1 Tool registry (`src/tools/`)

Every tool is a plain object:

```js
{
  name: 'edit_file',            // unique, validated at registration
  description: '…',             // >20 chars, shown to the model
  inputSchema: { … },           // JSON Schema, surfaced in the prompt manifest
  dangerous: true,              // flagged for the model, gated by checkCommand
  async execute(args, ctx): Result
}
```

- `ToolRegistry.execute()` is the **only** call path: it catches throws, converts them to
  structured `err()` results, normalizes shape, caps output size, and logs `tool:start` /
  `tool:done`. The model therefore never sees an exception — only a `Result`
  (`{ ok, data, error, meta }`).
- Unknown tool names return a structured error listing the available tools (self-healing
  for hallucinated tool names).
- The nine required tools are registered in `src/tools/index.js`: `read_file`,
  `write_file`, `edit_file`, `search_files`, `list_files`, `run_command`, `run_tests`,
  `git_status`, `git_diff`.

### 4.2 Safety (`src/tools/safety.js`)

- `resolveSafe(root, path, opts)` — resolves the path, rejects traversal escapes,
  absolute paths outside the root, secret basenames (`.env*` except `.env.example`,
  `*.pem`, `id_rsa`, …), and writes into `.git/`.
- `checkCommand(cmd, allowUnsafe)` — deny-list of destructive patterns (`rm -rf`,
  `git reset --hard`, `drop table`, `| bash`, `shutdown`, `vercel --prod`, …). Blocked
  errors explain how to authorize (`--allow-unsafe` / `AGENT_ALLOW_UNSAFE`).
- `redact()` (in `src/utils/text.js`) — masks `sk-…`, `gh…_…`, `AKIA…`, JWTs, and
  `key=value` credential shapes. Applied at the logger and at every tool-output boundary,
  so secrets never reach logs, prompts or the report.

### 4.3 LLM layer (`src/llm/`)

- `createProvider(settings.llm)` picks an adapter from `AGENT_LLM_PROVIDER` (default
  `ollama`, mirroring the app's existing `src/lib/ai.js` usage).
- Adapters share one contract: `complete(messages, opts) → string`. HTTP details (timeouts,
  non-2xx handling, provider-specific payload/response shapes) are isolated per adapter.
- `mock` is a deterministic offline double used by the test suite and demos; it answers by
  stage (`STAGE: PLANNER/EXECUTOR/REPAIR/REPORTER`) and can be scripted with
  `AGENT_MOCK_SCRIPT`.
- **Every LLM call site degrades, never crashes**: planner → heuristic plan, executor →
  recorded error + stop, repair → recorded error + stop, reporter → deterministic report.

### 4.4 Context gathering (`src/agent/context/`)

Context is assembled from signals, not dumps: project analysis (manifest, languages,
scripts), token-matched file/content hits, a depth-limited file tree (node_modules, `.git`,
build dirs and the nested `ironclad-armory/` project excluded), the most recently modified
sources, and a git summary. The result is capped at `AGENT_CONTEXT_BUDGET` characters.

### 4.5 Verification & self-repair (`src/agent/verifier/`)

- `detectTestCommand()` prefers `AGENT_VERIFY_COMMANDS`, else the first existing
  `package.json` script among `test → lint → typecheck → check → build`, else
  `nodeCheckAll()` — an in-process `node --check` sweep over all JS sources (spawned
  without a shell, so no quoting hazards).
- `verifyAndRepair()` runs `maxRepairs` attempts; each attempt lets the model act up to
  `maxActionsPerStep` times, then re-validates. It stops early when the model declares done,
  when it re-runs validation itself, when the LLM is unreachable, or when an attempt makes
  no progress. Validation is re-checked after every attempt — "done" is never trusted, only
  verified.

### 4.6 Persistence (`src/agent/memory/`)

Each run writes `.agent/runs/<id>.json`: task, status, provider/model, context, plan,
every action (tool, args, ok/error, output excerpt, file snapshot), errors, validation
commands + output, review, report and timestamps. This is the audit trail referenced by
the CLI report.

### 4.7 Doctor (`src/agent/doctor/`)

`runDoctor({ settings, logger })` runs ten read-only diagnostics and returns
`{ checks, ok }`; the CLI renders them as aligned `✓ / ⚠ / ✗` lines with a concrete fix
per non-`ok` check (exit `0` when nothing is `fail`, `1` otherwise, JSON via `-j`):

`node` version · `workspace` exists/writable · provider `constructible` (fails fast on a
key-less cloud provider) · endpoint `reachability` (probes only the *configured*
provider: `GET /api/tags` for Ollama, `/models` for OpenAI/Anthropic — `mock` is
offline by design) · `git` availability · detected `validation` command · `.agent/`
`storage` writability · `safety` rails state (warns when `AGENT_ALLOW_UNSAFE` is on) ·
`tools` registry integrity (all nine required tools registered) · `env` summary.

A reachability failure on a cloud provider is a **warning** (networks get blocked) while
a missing key or an unreachable local Ollama is a **failure** — the distinction matches
what would actually stop a run.

### 4.8 Undo (`src/agent/undo/`)

`write_file`/`edit_file` store a `FileSnapshot` on every successful action record:
`before` (previous content, ≤ 256 KiB), `existed`, and `afterHash` (sha256 of what the
run left behind). `undoRun()` replays snapshots newest-first:

| Situation | Result |
|-----------|--------|
| file created by the run | deleted (only if it still matches `afterHash`) |
| file overwritten | previous content restored |
| file changed since the run | **skipped** — undo never clobbers newer work |
| file already gone / already undone | skipped, reported honestly |
| snapshot too large | skipped, reported honestly |

If every recorded change conflicts with the current files, `undoRun` returns a structured
**error** (exit 1) instead of pretending success, and no audit record is written. Each
successful undo appends its own record (`undo-<run>-<ts>.json`, `kind: "undo"`) so the
modification chain stays inspectable; `--list-runs` shows both kinds, and `latest` always
resolves to a real run, never to an undo record.

## 5. Configuration

Precedence: **explicit overrides (CLI flags) > environment (`.env`) > defaults**.

`.env.example` documents every variable. The loader reads `.env` but deliberately skips
`.env.local` (it holds deploy secrets such as `VERCEL_OIDC_TOKEN`), and secrets are never
written into source.

CLI parsing notes (`src/main.js`): flags are parsed strictly, but a task is free text —
when an unknown dashed word would abort parsing, `withTaskTerminator()` re-runs the parse
with everything from the first task word on treated as literal (`--` terminator), so
`add a --version flag` survives even when `cmd` strips the quotes. Wrapping quotes are
removed from the joined task. The entry-point guard compares **realpaths**, because
`npm link` invokes `src/main.js` through a junction.

## 6. Verification strategy

`npm run verify` = `typecheck && test && build`:

1. **Typecheck** — `tsc -p tsconfig.json` with `allowJs`/`checkJs`/`strict` over the agent
   subsystem and tests (the React app is out of scope: it has no type setup and adding one
   would mean touching app files).
2. **Tests** — `node --test tests/**/*.test.js` (101 tests): registry contract, path/command
   safety, filesystem tool round-trips, command runner + timeouts, planner fallback, budget
   enforcement, repair loop (fix, give-up, offline), full lifecycle in a temp workspace,
   dry-run, approval gate (approve / reject / non-interactive), crash-record invariants,
   redaction, **executor loop guard** (identical repeats stop early, distinct calls don't),
   **auto-finish rules** (stuck model + completed plan + green validation + successful
   mutation → success; any missing condition → partial),
   **adapter contract tests against a local HTTP server** (Ollama `/api/chat`,
   OpenAI `/chat/completions`, Anthropic `/v1/messages` — payloads, auth headers, system
   extraction, error mapping, timeouts), **doctor** (healthy, allow-unsafe, keyless
   provider, scriptless project, missing workspace), **undo** (restore, delete, reverse
   replay, conflicts, double-undo, snapshot persistence) and **CLI parsing**.
3. **Build** — the existing Vite build must stay green (proved the app is untouched).

## 7. Known limitations

- **No formatter/linter**: the repository had none; `npm run verify` covers types, tests and
  build. Adding Prettier/ESLint would touch app-wide formatting — deliberately not done.
- **Git unavailable on this machine**: `git_status`/`git_diff` return structured errors
  ("install Git or run git init"), and the review stage falls back to the action log. No
  `git init` was performed (would change repo state without authorization).
- **Ollama runs, but slowly, and small models rarely emit `{"done": true}`**: the
  configured model is `qwen2.5-coder:3b` on CPU — planner calls take minutes, and models
  tend to repeat themselves instead of declaring completion. The loop guard stops repeats
  early and the auto-finish rule (plan complete + validation green + mutation succeeded)
  turns those runs into `success`; when the conditions are not all met the run ends
  `partial` (exit 1) and the user is asked to review. Offline degradation to a heuristic
  plan is still exercised by tests. No cloud keys are set, so the OpenAI/Anthropic
  adapters are verified against a local contract-test server, not the real APIs.
- **Heuristic fallback inspects but does not invent**: when the model is down the agent runs
  a read/search/validate plan; it will not fabricate code changes.
- **Single-run scope**: no cross-run memory beyond `.agent/runs/` records, no background
  agent, no web UI — the CLI is the interface.
- **Undo covers file mutations only**: `run_command`/`run_tests` side effects (installed
  packages, generated artifacts) cannot be reverted, and snapshots are capped at 256 KiB
  per file (larger files are reported as skipped rather than restored).
- **Doctor probes only the configured provider** and never prints key material; a cloud
  endpoint it cannot reach is reported as a warning, not a failure.
