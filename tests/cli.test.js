import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCli } from '../src/main.js'

test('parseCli reads the task and run flags', () => {
  const cli = parseCli(['--dry-run', '-j', 'refactor', 'the', 'date', 'helpers'])
  assert.equal(cli.code, 0)
  assert.equal(cli.task, 'refactor the date helpers')
  assert.equal(cli.dryRun, true)
  assert.equal(cli.json, true)
  assert.equal(cli.doctor, false)
  assert.equal(cli.undo, null)
  assert.equal(cli.interactive, false)
})

test('parseCli maps flags to settings overrides', () => {
  const cli = parseCli([
    '--provider', 'mock',
    '--model', 'my-model',
    '--max-steps', '7',
    '--max-repairs', '1',
    '--no-verify',
    '--allow-unsafe',
    '-w', 'C:/somewhere',
    'do a thing',
  ])
  assert.equal(cli.task, 'do a thing')
  assert.equal(cli.verify, false)
  assert.equal(cli.allowUnsafe, true)
  assert.equal(cli.overrides.workspaceRoot, 'C:/somewhere')
  assert.equal(cli.overrides.llm?.provider, 'mock')
  assert.equal(cli.overrides.llm?.model, 'my-model')
  assert.equal(cli.overrides.agent?.maxSteps, 7)
  assert.equal(cli.overrides.agent?.maxRepairs, 1)
  assert.equal(cli.overrides.agent?.verifyEnabled, false)
  assert.equal(cli.overrides.agent?.allowUnsafe, true)
})

test('parseCli handles diagnostic and maintenance commands', () => {
  assert.equal(parseCli(['--doctor']).doctor, true)
  assert.equal(parseCli(['--list-runs']).listRuns, true)
  assert.equal(parseCli(['--undo', 'latest']).undo, 'latest')
  assert.equal(parseCli(['--undo', '2026-10-03T12-26']).undo, '2026-10-03T12-26')
  assert.equal(parseCli(['--list-tools']).listTools, true)
  assert.equal(parseCli(['--list-providers']).listProviders, true)
  assert.equal(parseCli(['-h']).help, true)
})

test('parseCli maps verbose/quiet to log levels and short flags work', () => {
  assert.equal(parseCli(['-v', 'x']).overrides.logLevel, 'debug')
  assert.equal(parseCli(['--verbose', 'x']).overrides.logLevel, 'debug')
  assert.equal(parseCli(['-q', 'x']).overrides.logLevel, 'warn')
  assert.equal(parseCli(['-i', 'x']).interactive, true)
  assert.equal(parseCli(['-n', 'x']).dryRun, true)
  assert.equal(parseCli(['-j', 'x']).json, true)
})

test('parseCli rejects unknown options with a usage error code', () => {
  const cli = parseCli(['--definitely-not-a-flag'])
  assert.equal(cli.code, 2)
  assert.equal(cli.task, null)
})

test('a task containing option-looking words survives strict parsing', () => {
  // cmd strips quotes, so the task can arrive as several tokens including "--version".
  const cli = parseCli(['--dry-run', 'add', 'a', '--version', 'flag', 'to', 'the', 'CLI'])
  assert.equal(cli.code, 0)
  assert.equal(cli.dryRun, true)
  assert.equal(cli.task, 'add a --version flag to the CLI')

  // Even with no leading flags at all (unknown option-looking words stay task text).
  const bare = parseCli(['add', 'a', '--release-notes', 'switch'])
  assert.equal(bare.code, 0)
  assert.equal(bare.task, 'add a --release-notes switch')

  // A *known* flag is still a flag wherever it appears — the rule is consistent:
  // flags always parse, unknown dashed words are preserved as task text.
  const knownFlag = parseCli(['add', 'a', '--verbose', 'switch'])
  assert.equal(knownFlag.code, 0)
  assert.equal(knownFlag.overrides.logLevel, 'debug')
  assert.equal(knownFlag.task, 'add a switch')

  // Value-taking options still consume their own value before the task starts,
  // and unknown option-looking words inside the task stay task text.
  const withValue = parseCli(['--provider', 'mock', 'document', 'the', '--release-notes', 'flag'])
  assert.equal(withValue.code, 0)
  assert.equal(withValue.overrides.llm?.provider, 'mock')
  assert.equal(withValue.task, 'document the --release-notes flag')

  // A known flag that follows the task keeps working (it is not swallowed).
  const flagAfter = parseCli(['inspect the project', '-j'])
  assert.equal(flagAfter.json, true)
  assert.equal(flagAfter.task, 'inspect the project')
})

test('a typo before the task is still a usage error', () => {
  assert.equal(parseCli(['--dryrun', 'fix', 'the', 'build']).code, 2)
  assert.equal(parseCli(['--providerx', 'mock', 'task']).code, 2)
})

test('wrapping quotes are stripped from the task', () => {
  assert.equal(parseCli(['"add a --version flag"']).task, 'add a --version flag')
  assert.equal(parseCli(["'cleanup'"]).task, 'cleanup')
  // Quotes in the middle are content, not delimiters.
  assert.equal(parseCli(['say', '"hello"', 'twice']).task, 'say "hello" twice')
  // An empty quoted string is no task at all.
  assert.equal(parseCli(['""']).task, null)
})

test('parseCli allows a dry run with no task (diagnostic-only invocations)', () => {
  assert.equal(parseCli([]).task, null)
  assert.equal(parseCli([]).code, 0, 'usage error is decided by the caller, not the parser')
})
