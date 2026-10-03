/**
 * Project analyzer — derives the technology stack and validation strategy
 * from what actually exists on disk (never from assumptions).
 *
 * Used by the context builder ("understand the repository") and by the
 * verifier ("which command proves the change works?").
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @typedef {Object} ProjectInfo
 * @property {boolean} exists
 * @property {string|null} name
 * @property {string|null} description
 * @property {string|null} version
 * @property {'commonjs'|'module'|null} moduleSystem
 * @property {Record<string,string>} scripts
 * @property {Record<string,string>} dependencies
 * @property {Record<string,string>} devDependencies
 * @property {string[]} frameworks     Detected frameworks/tools (react, vite, next, …).
 * @property {string[]} languages      File extensions present in src.
 * @property {string[]|null} validation Candidate validation commands, best first.
 * @property {string|null} packageManager  npm|pnpm|yarn (lockfile detection).
 * @property {string[]} notes          Human-readable observations.
 */

/** Signals we look for in dependencies/devDependencies. */
const FRAMEWORK_SIGNALS = [
  'react', 'react-dom', 'next', 'vite', '@vitejs/plugin-react', 'express', 'fastify',
  'koa', 'typescript', 'jest', 'vitest', 'mocha', 'playwright', 'cypress', 'eslint',
  'prettier', 'tailwindcss', 'prisma', 'sequelize', 'mongoose', 'pg', 'next-auth',
]

const SOURCE_DIRS = ['src', 'app', 'lib', 'components', 'pages', 'server', 'api', 'tests', 'test']
const CODE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.css', '.html', '.py']

/**
 * @param {string} root
 * @returns {ProjectInfo}
 */
export function analyzeProject(root) {
  /** @type {ProjectInfo} */
  const info = {
    exists: false,
    name: null,
    description: null,
    version: null,
    moduleSystem: null,
    scripts: {},
    dependencies: {},
    devDependencies: {},
    frameworks: [],
    languages: [],
    validation: null,
    packageManager: null,
    notes: [],
  }

  const pkgPath = join(root, 'package.json')
  if (!existsSync(pkgPath)) {
    info.notes.push('No package.json at workspace root')
    scanLanguages(root, info)
    return info
  }
  info.exists = true

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    info.name = pkg.name ?? null
    info.description = pkg.description ?? null
    info.version = pkg.version ?? null
    info.moduleSystem = pkg.type === 'module' ? 'module' : 'commonjs'
    info.scripts = pkg.scripts ?? {}
    info.dependencies = pkg.dependencies ?? {}
    info.devDependencies = pkg.devDependencies ?? {}
  } catch (e) {
    info.notes.push(`package.json is not valid JSON: ${e instanceof Error ? e.message : e}`)
    return info
  }

  const allDeps = { ...info.dependencies, ...info.devDependencies }
  info.frameworks = FRAMEWORK_SIGNALS.filter((f) => f in allDeps)

  if (existsSync(join(root, 'pnpm-lock.yaml'))) info.packageManager = 'pnpm'
  else if (existsSync(join(root, 'yarn.lock'))) info.packageManager = 'yarn'
  else if (existsSync(join(root, 'package-lock.json'))) info.packageManager = 'npm'
  else info.packageManager = 'npm'

  info.validation = validationCandidates(info)
  scanLanguages(root, info)

  if (!info.scripts.test) info.notes.push('package.json has no "test" script')
  if (info.moduleSystem === 'module') info.notes.push('ESM ("type": "module") — use import/export, require() is unavailable')
  return info
}

/**
 * Ordered validation commands: explicit project scripts first, sensible
 * fallbacks afterwards.
 * @param {ProjectInfo} info
 * @returns {string[]|null}
 */
function validationCandidates(info) {
  const pm = info.packageManager === 'yarn' ? 'yarn' : info.packageManager === 'pnpm' ? 'pnpm' : 'npm'
  const run = pm === 'npm' ? 'npm run' : pm
  /** @type {string[]} */
  const out = []
  for (const name of ['test', 'lint', 'typecheck', 'check', 'build']) {
    if (typeof info.scripts[name] === 'string' && info.scripts[name].trim()) {
      out.push(`${run} ${name}`)
    }
  }
  if (out.length === 0) out.push('node --check <changed files>')
  return out
}

/**
 * Cheap language census over the first-level source directories.
 * @param {string} root
 * @param {ProjectInfo} info
 */
function scanLanguages(root, info) {
  /** @type {Record<string, number>} */
  const counts = {}
  let files = 0
  /** @param {string} dir @param {number} depth */
  const walk = (dir, depth) => {
    if (files > 4000 || depth > 6) return
    /** @type {import('node:fs').Dirent[]} */
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (files > 4000) return
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full, depth + 1)
      } else {
        files++
        const dot = entry.name.lastIndexOf('.')
        if (dot > 0) {
          const ext = entry.name.slice(dot).toLowerCase()
          if (CODE_EXTS.includes(ext)) counts[ext] = (counts[ext] ?? 0) + 1
        }
      }
    }
  }

  // Prefer conventional source dirs, fall back to the root itself.
  const starts = SOURCE_DIRS.map((d) => join(root, d)).filter((p) => {
    try {
      return statSync(p).isDirectory()
    } catch {
      return false
    }
  })
  for (const start of starts.length ? starts : [root]) walk(start, 0)

  info.languages = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([ext, n]) => `${ext}(${n})`)
}
