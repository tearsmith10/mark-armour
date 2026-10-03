/**
 * Doctor — diagnoses the environment and reports exactly what a user must fix
 * before running the agent. Pure checks, no side effects (apart from creating
 * the `.agent/` bookkeeping directory).
 *
 * Check status:
 *   ok   — everything is in place
 *   warn — usable, but something will degrade (missing git, disabled checks, …)
 *   fail — a run would not work until this is fixed (`fix` says what to do)
 */

import { access, constants, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createProvider, describeProvider } from '../../llm/provider.js'
import { createRegistry } from '../../tools/index.js'
import { gitAvailable } from '../../tools/git/git_tools.js'
import { detectTestCommand } from '../../tools/testing/run_tests.js'

/** @typedef {import('../../config/index.js').Settings} Settings */
/** @typedef {import('../../logging/logger.js').Logger} Logger */

/** @typedef {{ id: string, status: 'ok'|'warn'|'fail', label: string, detail: string, fix?: string }} Check */

const MIN_NODE_MAJOR = 18
const PROBE_TIMEOUT_MS = 4_000

/**
 * Run every diagnostic.
 * @param {{ settings: Settings, logger: Logger }} args
 * @returns {Promise<{ checks: Check[], ok: boolean }>}
 */
export async function runDoctor({ settings, logger }) {
  const log = logger.child({ mod: 'doctor' })
  /** @type {Check[]} */
  const checks = []

  checks.push(nodeCheck())
  checks.push(await workspaceCheck(settings.workspaceRoot))
  checks.push(await providerConstructCheck(settings))
  const reachable = await providerReachabilityCheck(settings)
  checks.push(reachable)
  checks.push(await gitCheck(settings.workspaceRoot))
  checks.push(validationCheck(settings))
  checks.push(await storageCheck(settings.workspaceRoot))
  checks.push(safetyCheck(settings))
  checks.push(toolsCheck(settings, logger))
  checks.push(envCheck(settings))

  const result = { checks, ok: !checks.some((c) => c.status === 'fail') }
  log.info('doctor:done', {
    ok: result.ok,
    okCount: checks.filter((c) => c.status === 'ok').length,
    warnCount: checks.filter((c) => c.status === 'warn').length,
    failCount: checks.filter((c) => c.status === 'fail').length,
  })
  return result
}

/** @returns {Check} */
function nodeCheck() {
  const version = process.versions.node
  const major = Number.parseInt(version.split('.')[0] ?? '0', 10)
  const ok = major >= MIN_NODE_MAJOR
  return {
    id: 'node',
    status: ok ? 'ok' : 'fail',
    label: 'Node.js',
    detail: `v${version}`,
    ...(ok ? {} : { fix: `Install Node.js ${MIN_NODE_MAJOR}+ from https://nodejs.org` }),
  }
}

/**
 * @param {string} root
 * @returns {Promise<Check>}
 */
async function workspaceCheck(root) {
  let exists = false
  let writable = false
  let hasPkg = false
  try {
    await stat(root)
    exists = true
  } catch {
    /* missing */
  }
  try {
    await access(root, constants.W_OK)
    writable = true
  } catch {
    /* read-only */
  }
  try {
    await stat(join(root, 'package.json'))
    hasPkg = true
  } catch {
    /* no manifest */
  }

  if (!exists) {
    return {
      id: 'workspace',
      status: 'fail',
      label: 'Workspace',
      detail: `${root} does not exist`,
      fix: 'Pass a valid --workspace <dir> or run from inside the project',
    }
  }
  if (!writable) {
    return {
      id: 'workspace',
      status: 'fail',
      label: 'Workspace',
      detail: `${root} is read-only`,
      fix: 'The agent must be able to write files — fix directory permissions',
    }
  }
  return {
    id: 'workspace',
    status: hasPkg ? 'ok' : 'warn',
    label: 'Workspace',
    detail: hasPkg ? `${root} (writable)` : `${root} (writable, but no package.json found)`,
    ...(hasPkg ? {} : { fix: 'Run from a project root, or pass --workspace <dir>' }),
  }
}

/**
 * @param {Settings} settings
 * @returns {Promise<Check>}
 */
async function providerConstructCheck(settings) {
  try {
    createProvider(settings.llm)
    return {
      id: 'provider',
      status: 'ok',
      label: 'LLM provider',
      detail: describeProvider(settings.llm),
    }
  } catch (e) {
    return {
      id: 'provider',
      status: 'fail',
      label: 'LLM provider',
      detail: e instanceof Error ? e.message : String(e),
      fix: 'Set the key in .env (see .env.example) or switch: --provider ollama|mock',
    }
  }
}

/**
 * Reachability probe for the *configured* provider only.
 * @param {Settings} settings
 * @returns {Promise<Check>}
 */
async function providerReachabilityCheck(settings) {
  const { provider, baseUrl, model } = settings.llm
  if (provider === 'mock') {
    return {
      id: 'reachability',
      status: 'ok',
      label: 'Model reachable',
      detail: 'mock provider — offline by design, no endpoint needed',
    }
  }
  if (provider === 'openai' && !settings.llm.apiKey) {
    return {
      id: 'reachability',
      status: 'fail',
      label: 'Model reachable',
      detail: 'OPENAI_API_KEY is not set',
      fix: 'Export OPENAI_API_KEY, or use --provider ollama / --provider mock',
    }
  }
  if (provider === 'anthropic' && !settings.llm.apiKey) {
    return {
      id: 'reachability',
      status: 'fail',
      label: 'Model reachable',
      detail: 'ANTHROPIC_API_KEY is not set',
      fix: 'Export ANTHROPIC_API_KEY, or use --provider ollama / --provider mock',
    }
  }

  const probe = await probeEndpoint(provider, baseUrl, settings.llm.apiKey)
  if (probe.ok) {
    const modelNote = probe.models?.length
      ? probe.models.includes(model)
        ? `model "${model}" is available`
        : `server has: ${probe.models.slice(0, 6).join(', ')} — "${model}" not found`
      : `${baseUrl} responded`
    return {
      id: 'reachability',
      status: probe.models && !probe.models.includes(model) ? 'warn' : 'ok',
      label: 'Model reachable',
      detail: modelNote,
      ...(probe.models && !probe.models.includes(model)
        ? { fix: provider === 'ollama' ? `ollama pull ${model}` : `Set AGENT_LLM_MODEL to an available model` }
        : {}),
    }
  }
  if (provider === 'ollama') {
    return {
      id: 'reachability',
      status: 'fail',
      label: 'Model reachable',
      detail: probe.error ?? `cannot reach ${baseUrl}`,
      fix: 'Start the local server: `ollama serve` (install: https://ollama.com/download), then `ollama pull llama3.1`',
    }
  }
  if (probe.unauthorized) {
    return {
      id: 'reachability',
      status: 'fail',
      label: 'Model reachable',
      detail: probe.error ?? 'rejected the API key',
      fix: 'Check the key value, or use --provider ollama / --provider mock',
    }
  }
  return {
    id: 'reachability',
    status: 'warn',
    label: 'Model reachable',
    detail: probe.error ?? `cannot verify ${baseUrl} right now`,
    fix: 'Network may be blocked; runs will fail over to the heuristic plan until the API answers',
  }
}

/**
 * @param {string} provider
 * @param {string} baseUrl
 * @param {string|null} apiKey
 * @returns {Promise<{ ok: boolean, unauthorized?: boolean, models?: string[], error?: string }>}
 */
async function probeEndpoint(provider, baseUrl, apiKey) {
  const base = baseUrl.replace(/\/$/, '')
  const url = provider === 'ollama' ? `${base}/api/tags` : provider === 'anthropic' ? `${base}/v1/models` : `${base}/models`
  /** @type {Record<string, string>} */
  const headers = {}
  if (provider === 'openai' && apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (provider === 'anthropic' && apiKey) {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: controller.signal })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, unauthorized: true, error: `HTTP ${res.status} from ${url}` }
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} from ${url}` }
    const data = /** @type {any} */ (await res.json())
    const models = extractModels(provider, data)
    return { ok: true, models }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: message.includes('abort') ? `no response within ${PROBE_TIMEOUT_MS}ms (${url})` : `${url}: ${message}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} provider
 * @param {any} data
 * @returns {string[]|undefined}
 */
function extractModels(provider, data) {
  try {
    if (provider === 'ollama') return (data?.models ?? []).map((/** @type {any} */ m) => String(m.name ?? ''))
    if (provider === 'openai') return (data?.data ?? []).map((/** @type {any} */ m) => String(m.id ?? ''))
    if (provider === 'anthropic') return (data?.data ?? []).map((/** @type {any} */ m) => String(m.id ?? ''))
  } catch {
    /* unexpected payload — omit the model list */
  }
  return undefined
}

/**
 * @param {string} root
 * @returns {Promise<Check>}
 */
async function gitCheck(root) {
  const available = await gitAvailable(root)
  return available
    ? { id: 'git', status: 'ok', label: 'Git', detail: 'available (diff review enabled)' }
    : {
        id: 'git',
        status: 'warn',
        label: 'Git',
        detail: 'not found on PATH',
        fix: 'Install Git to enable git_status/git_diff review, then run `git init` if this is a new repo',
      }
}

/**
 * @param {Settings} settings
 * @returns {Check}
 */
function validationCheck(settings) {
  const { command, source } = detectTestCommand(settings.workspaceRoot, settings.agent.verifyCommands)
  if (command) {
    return { id: 'validation', status: 'ok', label: 'Validation', detail: `${command} (${source})` }
  }
  return {
    id: 'validation',
    status: 'warn',
    label: 'Validation',
    detail: `no project script (${source}) — falling back to "node --check"`,
    fix: 'Add a "test"/"lint"/"build" script to package.json, or set AGENT_VERIFY_COMMANDS',
  }
}

/**
 * @param {string} root
 * @returns {Promise<Check>}
 */
async function storageCheck(root) {
  try {
    await mkdir(join(root, '.agent', 'runs'), { recursive: true })
    await access(join(root, '.agent'), constants.W_OK)
    return { id: 'storage', status: 'ok', label: 'Run records', detail: `${join(root, '.agent', 'runs')} (writable)` }
  } catch (e) {
    return {
      id: 'storage',
      status: 'fail',
      label: 'Run records',
      detail: e instanceof Error ? e.message : String(e),
      fix: 'The agent needs to write .agent/ inside the workspace — fix permissions or pick another workspace',
    }
  }
}

/**
 * @param {Settings} settings
 * @returns {Check}
 */
function safetyCheck(settings) {
  if (settings.agent.allowUnsafe) {
    return {
      id: 'safety',
      status: 'warn',
      label: 'Safety rails',
      detail: 'AGENT_ALLOW_UNSAFE is ON — destructive commands are permitted',
      fix: 'Unset AGENT_ALLOW_UNSAFE unless you are working in a throwaway workspace',
    }
  }
  return { id: 'safety', status: 'ok', label: 'Safety rails', detail: 'path sandbox + command deny-list active' }
}

/**
 * @param {Settings} settings
 * @param {Logger} logger
 * @returns {Check}
 */
function toolsCheck(settings, logger) {
  try {
    const registry = createRegistry({
      workspaceRoot: settings.workspaceRoot,
      logger,
      settings,
    })
    const names = registry.list().map((t) => t.name)
    const required = ['read_file', 'write_file', 'edit_file', 'search_files', 'list_files', 'run_command', 'run_tests', 'git_status', 'git_diff']
    const missing = required.filter((n) => !names.includes(n))
    return missing.length
      ? {
          id: 'tools',
          status: 'fail',
          label: 'Tool registry',
          detail: `missing: ${missing.join(', ')}`,
          fix: 'The registry failed to build — check src/tools/index.js',
        }
      : { id: 'tools', status: 'ok', label: 'Tool registry', detail: `${names.length} tools registered` }
  } catch (e) {
    return {
      id: 'tools',
      status: 'fail',
      label: 'Tool registry',
      detail: e instanceof Error ? e.message : String(e),
      fix: 'Check src/tools/index.js and the tool modules it imports',
    }
  }
}

/**
 * @param {Settings} settings
 * @returns {Check}
 */
function envCheck(settings) {
  const notes = []
  if (settings.logFile) notes.push(`logs → ${settings.logFile}`)
  else notes.push('file logging disabled')
  notes.push('.env.local is never loaded (deploy secrets stay out of the agent)')
  return { id: 'env', status: 'ok', label: 'Environment', detail: notes.join(' · ') }
}

/**
 * Render checks as aligned console lines.
 * @param {Check[]} checks
 * @returns {string}
 */
export function formatChecks(checks) {
  const icon = { ok: '✓', warn: '⚠', fail: '✗' }
  const width = Math.max(...checks.map((c) => c.label.length))
  const lines = []
  for (const c of checks) {
    lines.push(`${icon[c.status]} ${c.label.padEnd(width)}  ${c.detail}`)
    if (c.fix) lines.push(`  ${' '.repeat(width)}  ↳ fix: ${c.fix}`)
  }
  return lines.join('\n')
}
