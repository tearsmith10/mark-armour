/**
 * Default tool set — the agent's hands.
 *
 * Adding a tool = import it here and add it to `registerDefaultTools()`.
 * Nothing else in the agent core needs to change (the registry exposes the
 * manifest to the planner/executor dynamically).
 */

import { ToolRegistry } from './registry.js'
import { readFileTool } from './filesystem/read_file.js'
import { writeFileTool } from './filesystem/write_file.js'
import { editFileTool } from './filesystem/edit_file.js'
import { listFilesTool } from './filesystem/list_files.js'
import { searchFilesTool } from './repository/search_files.js'
import { runCommandTool } from './terminal/run_command.js'
import { runTestsTool } from './testing/run_tests.js'
import { gitStatusTool, gitDiffTool } from './git/git_tools.js'

/** @typedef {import('../utils/types.js').ToolContext} ToolContext */
/** @typedef {import('../utils/types.js').Tool} Tool */

/** Every tool the agent gets by default (name → tool). */
export const DEFAULT_TOOLS = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listFilesTool,
  searchFilesTool,
  runCommandTool,
  runTestsTool,
  gitStatusTool,
  gitDiffTool,
]

/**
 * Build a registry populated with the default tools.
 * @param {ToolContext} ctx
 * @param {Tool[]} [extra] Optional additional tools (extensions/tests).
 * @returns {ToolRegistry}
 */
export function createRegistry(ctx, extra = []) {
  const registry = new ToolRegistry(ctx)
  for (const tool of [...DEFAULT_TOOLS, ...extra]) registry.register(tool)
  return registry
}
