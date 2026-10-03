import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { PROVIDER_IDS } from '../llm/models.js'

/**
 * @typedef {Object} Settings
 * @property {string} workspaceRoot
 * @property {LogLevelAlias} logLevel
 * @property {string|null} logFile
 * @property {{ provider: string, model: string, baseUrl: string, apiKey: string|null,
 *              timeoutMs: number, temperature: number, mockScript: string[]|null }} llm
 * @property {{ maxSteps: number, maxActionsPerStep: number, maxRepairs: number,
 *              verifyEnabled: boolean, verifyCommands: string[]|null,
 *              allowUnsafe: boolean, contextBudget: number, commandTimeoutMs: number }} agent
 *
 * @typedef {import('../logging/logger.js').LogLevel} LogLevelAlias
 *
 * Deep-partial override accepted by loadSettings() — every field is optional,
 * nested groups included (callers only ever override a couple of knobs).
 * @typedef {{ workspaceRoot?: string, logLevel?: LogLevelAlias, logFile?: string|null,
 *             llm?: Partial<Settings['llm']>, agent?: Partial<Settings['agent']> }} SettingsOverrides
 */

/** Defaults for every configurable value (overridden by environment variables). */
export const DEFAULTS = {
  llmProvider: 'ollama',
  llmTimeoutMs: 300_000, // local CPU models can take minutes
  llmTemperature: 0.2,
  maxSteps: 24,
  maxActionsPerStep: 5,
  maxRepairs: 3,
  contextBudget: 14_000, // characters of context sent to the model
  commandTimeoutMs: 120_000,
}

/**
 * Load `.env` (agent-scoped variables) into `process.env` if present.
 * `.env.local` is deliberately NOT loaded: it holds deployment secrets
 * (Vercel OIDC token) that must never enter the agent process.
 * @param {string} cwd
 */
export function loadEnvFiles(cwd) {
  const p = join(cwd, '.env')
  if (existsSync(p) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(p)
    } catch {
      /* malformed .env must not crash startup */
    }
  }
}

/**
 * Walk up from `start` until a package.json is found — the repository root.
 * @param {string} start
 * @returns {string}
 */
export function findWorkspaceRoot(start) {
  let dir = resolve(start)
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return resolve(start)
}

/**
 * @param {string|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function envInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Parse `AGENT_VERIFY_COMMANDS`: JSON array, `||`-separated list, or unset.
 * @param {string|undefined} value
 * @returns {string[]|null}
 */
export function parseCommandList(value) {
  if (!value || !value.trim()) return null
  const raw = value.trim()
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.map(String).filter(Boolean)
    } catch {
      /* fall through to || split */
    }
  }
  return raw
    .split('||')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Build the immutable settings object for a run.
 * Precedence: explicit overrides > environment > defaults.
 *
 * @param {{ cwd?: string, overrides?: SettingsOverrides }} [opts]
 * @returns {Settings}
 */
export function loadSettings(opts = {}) {
  const cwd = resolve(opts.cwd ?? process.cwd())
  loadEnvFiles(cwd)
  const env = process.env
  const overrides = opts.overrides ?? {}

  const workspaceRoot = resolve(
    overrides.workspaceRoot ??
      (env.AGENT_WORKSPACE ? resolve(cwd, env.AGENT_WORKSPACE) : findWorkspaceRoot(cwd)),
  )

  const provider = (overrides.llm?.provider ?? env.AGENT_LLM_PROVIDER ?? DEFAULTS.llmProvider)
    .trim()
    .toLowerCase()
  if (!PROVIDER_IDS.includes(provider)) {
    throw new Error(`Unknown AGENT_LLM_PROVIDER "${provider}". Supported: ${PROVIDER_IDS.join(', ')}`)
  }

  const logFileSetting = env.AGENT_LOG_FILE
  const logFile =
    logFileSetting === 'none'
      ? null
      : (logFileSetting
          ? resolve(workspaceRoot, logFileSetting)
          : join(workspaceRoot, '.agent', 'logs', 'agent.log'))

  /** @type {Settings} */
  const settings = {
    workspaceRoot,
    logLevel: /** @type {any} */ (env.AGENT_LOG_LEVEL ?? 'info'),
    logFile,
    llm: {
      provider,
      model:
        overrides.llm?.model ??
        env.AGENT_LLM_MODEL ??
        providerDefaultModel(provider, env),
      baseUrl:
        overrides.llm?.baseUrl ?? providerBaseUrl(provider, env),
      apiKey: overrides.llm?.apiKey ?? providerApiKey(provider, env),
      timeoutMs: envInt(env.AGENT_LLM_TIMEOUT_MS, DEFAULTS.llmTimeoutMs),
      temperature: Number.isFinite(Number(env.AGENT_LLM_TEMPERATURE))
        ? Number(env.AGENT_LLM_TEMPERATURE)
        : DEFAULTS.llmTemperature,
      mockScript: parseCommandList(env.AGENT_MOCK_SCRIPT) ?? null,
    },
    agent: {
      maxSteps: overrides.agent?.maxSteps ?? envInt(env.AGENT_MAX_STEPS, DEFAULTS.maxSteps),
      maxActionsPerStep:
        overrides.agent?.maxActionsPerStep ?? envInt(env.AGENT_MAX_ACTIONS_PER_STEP, DEFAULTS.maxActionsPerStep),
      maxRepairs: overrides.agent?.maxRepairs ?? envInt(env.AGENT_MAX_REPAIRS, DEFAULTS.maxRepairs),
      verifyEnabled:
        overrides.agent?.verifyEnabled ??
        !(env.AGENT_NO_VERIFY === '1' || env.AGENT_NO_VERIFY === 'true'),
      verifyCommands:
        overrides.agent?.verifyCommands ?? parseCommandList(env.AGENT_VERIFY_COMMANDS),
      allowUnsafe:
        overrides.agent?.allowUnsafe ??
        (env.AGENT_ALLOW_UNSAFE === '1' || env.AGENT_ALLOW_UNSAFE === 'true'),
      contextBudget: envInt(env.AGENT_CONTEXT_BUDGET, DEFAULTS.contextBudget),
      commandTimeoutMs: envInt(env.AGENT_COMMAND_TIMEOUT_MS, DEFAULTS.commandTimeoutMs),
    },
  }
  return settings
}

/**
 * Read the repository's package.json scripts (used for verification detection).
 * @param {string} root
 * @returns {Record<string, string>}
 */
export function readPackageScripts(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    return pkg && typeof pkg.scripts === 'object' && pkg.scripts ? pkg.scripts : {}
  } catch {
    return {}
  }
}

/**
 * Provider-specific defaults, resolved from environment variables.
 * @param {string} provider
 * @param {NodeJS.ProcessEnv} env
 */
function providerDefaultModel(provider, env) {
  switch (provider) {
    case 'ollama':
      return env.OLLAMA_MODEL ?? env.VITE_OLLAMA_MODEL ?? 'llama3.1'
    case 'openai':
      return env.OPENAI_MODEL ?? 'gpt-4o-mini'
    case 'anthropic':
      return env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest'
    case 'mock':
      return 'mock-1'
    default:
      return 'unknown'
  }
}

/**
 * @param {string} provider
 * @param {NodeJS.ProcessEnv} env
 */
function providerBaseUrl(provider, env) {
  switch (provider) {
    case 'ollama':
      return (env.OLLAMA_BASE_URL ?? env.VITE_OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '')
    case 'openai':
      return (env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
    case 'anthropic':
      return (env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '')
    default:
      return ''
  }
}

/**
 * @param {string} provider
 * @param {NodeJS.ProcessEnv} env
 * @returns {string|null}
 */
function providerApiKey(provider, env) {
  switch (provider) {
    case 'openai':
      return env.OPENAI_API_KEY ?? null
    case 'anthropic':
      return env.ANTHROPIC_API_KEY ?? null
    default:
      return null
  }
}
