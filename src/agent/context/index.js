/**
 * Context layer — builds a *targeted* brief for the LLM instead of dumping
 * the repository into the prompt.
 *
 * Sources, in priority order:
 *   1. project analysis (stack, scripts, module system)
 *   2. task-vocabulary hits from code search (paths + matching lines)
 *   3. a shallow file tree (orientation)
 *   4. recently modified files (change awareness)
 *   5. git status/diff when available (structured skip when not)
 *
 * Everything is capped by `settings.agent.contextBudget` characters.
 */

import { analyzeProject } from '../../code/analyzer/project.js'
import { searchByFileName, searchRelevant, tokenize } from '../../code/search/index.js'
import { formatRecent, recentFiles } from '../../code/parser/recent.js'
import { createRegistry } from '../../tools/index.js'
import { truncate } from '../../utils/text.js'

/** @typedef {import('../../config/index.js').Settings} Settings */
/** @typedef {import('../../logging/logger.js').Logger} Logger */

/**
 * @typedef {Object} ContextBundle
 * @property {string} text        The assembled brief (budget-capped).
 * @property {string[]} files     Specific files worth reading next.
 * @property {import('../../code/analyzer/project.js').ProjectInfo} project
 * @property {string[]} tokens    Task tokens that drove the search.
 */

/**
 * @param {{ task: string, settings: Settings, logger: Logger }} args
 * @returns {Promise<ContextBundle>}
 */
export async function buildContext({ task, settings, logger }) {
  const root = settings.workspaceRoot
  const log = logger.child({ stage: 'context' })
  const tokens = tokenize(task)
  const project = analyzeProject(root)

  // --- targeted search -------------------------------------------------
  const lineHits = await searchRelevant(root, tokens, { limit: 12 })
  const nameHits = await searchByFileName(root, tokens, { limit: 8 })

  /** @type {string[]} */
  const files = [...new Set([...nameHits, ...lineHits.map((h) => h.path)])].slice(0, 10)

  // --- shallow tree -----------------------------------------------------
  const registry = createRegistry({ workspaceRoot: root, logger, settings })
  const treeResult = await registry.execute('list_files', { path: '.', maxDepth: 3 })
  const tree = treeResult.ok ? String(treeResult.data) : '(tree unavailable)'

  // --- recent changes ---------------------------------------------------
  const recent = formatRecent(await recentFiles(root, { limit: 8 }))

  // --- git awareness (graceful when git is absent) ----------------------
  const gitBlock = await gitSummary(registry)

  // --- assemble ---------------------------------------------------------
  const sections = [
    '## Project',
    `- root: ${root}`,
    `- name: ${project.name ?? '(unnamed)'}${project.version ? ` v${project.version}` : ''}`,
    `- description: ${project.description ?? '(none)'}`,
    `- module system: ${project.moduleSystem ?? 'unknown'}`,
    `- package manager: ${packageManagerLabel(project)}`,
    `- frameworks/tools: ${project.frameworks.join(', ') || '(none detected)'}`,
    `- languages: ${project.languages.join(', ') || '(unknown)'}`,
    `- validation: ${(project.validation ?? []).join(' | ') || '(none)'}`,
    ...(project.notes.length ? [`- notes: ${project.notes.join('; ')}`] : []),
    '',
    '## Scripts (package.json)',
    formatScripts(project.scripts),
    '',
    '## Task-matched code',
    lineHits.length
      ? lineHits.map((h) => `${h.path}:${h.line}: ${h.text}`).join('\n')
      : '(no direct matches — use search_files / list_files to locate the code)',
    '',
    '## Candidate files',
    files.length ? files.map((f) => `- ${f}`).join('\n') : '(none identified)',
    '',
    '## File tree (depth 3)',
    tree,
    '',
    '## Recently modified',
    recent,
    '',
    '## Repository state',
    gitBlock,
  ]

  let text = sections.join('\n')
  if (text.length > settings.agent.contextBudget) {
    text = `${text.slice(0, settings.agent.contextBudget)}\n… [context capped at ${settings.agent.contextBudget} chars]`
  }

  log.info('context:built', {
    tokens: tokens.length,
    hits: lineHits.length,
    files: files.length,
    chars: text.length,
  })

  return { text, files, project, tokens }
}

/**
 * @param {import('../../tools/registry.js').ToolRegistry} registry
 * @returns {Promise<string>}
 */
async function gitSummary(registry) {
  const status = await registry.execute('git_status', {})
  if (!status.ok) return `git: unavailable — ${status.error}`
  const diff = await registry.execute('git_diff', { stat: true })
  return `${status.data}${diff.ok && diff.data !== '(no differences)' ? `\n\ndiff stat:\n${diff.data}` : ''}`
}

/**
 * @param {Record<string,string>} scripts
 * @returns {string}
 */
function formatScripts(scripts) {
  const entries = Object.entries(scripts)
  if (entries.length === 0) return '(none)'
  return entries.map(([k, v]) => `- ${k}: ${v}`).join('\n')
}

/**
 * @param {import('../../code/analyzer/project.js').ProjectInfo} project
 * @returns {string}
 */
function packageManagerLabel(project) {
  return project.packageManager ?? 'npm'
}

export { truncate }
