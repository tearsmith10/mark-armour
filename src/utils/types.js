/**
 * Shared JSDoc type definitions for the self-coding agent.
 *
 * The project is plain JavaScript, so types are expressed as JSDoc and
 * checked by `npm run typecheck` (tsc --noEmit --checkJs).
 *
 * @typedef {import('./result.js').Result} Result
 *
 * @typedef {Object} ChatMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 *
 * @typedef {Object} LLMProvider
 * @property {string} id                    Provider id (ollama/openai/anthropic/mock).
 * @property {string} model                 Resolved model name.
 * @property {(messages: ChatMessage[], opts?: { timeoutMs?: number, temperature?: number }) => Promise<string>} complete
 *
 * @typedef {Object} ToolContext
 * @property {string} workspaceRoot
 * @property {import('../logging/logger.js').Logger} logger
 * @property {import('../config/index.js').Settings} settings
 *
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description
 * @property {Record<string, any>} inputSchema   JSON-Schema-like input description.
 * @property {boolean} [dangerous]               True for commands that modify the repo/system.
 * @property {(args: any, ctx: ToolContext) => Promise<Result>} execute
 *
 * @typedef {Object} PlanStep
 * @property {string} goal
 * @property {string|null} [tool]   Tool to invoke for this step (null = reasoning/verification step).
 * @property {Record<string, any>} [args]
 *
 * @typedef {Object} Plan
 * @property {string} strategy
 * @property {PlanStep[]} steps
 * @property {'llm'|'heuristic'} origin
 *
 * @typedef {Object} FileSnapshot
 * @property {string|null} before      Previous content (null when the file did not exist).
 * @property {boolean} existed         False when this action created the file.
 * @property {boolean} [skipped]       True when the file was too large to snapshot.
 * @property {string} [afterHash]      sha256 of the file as this run left it —
 *                                     undo refuses to touch files that changed since.
 *
 * @typedef {Object} ActionRecord
 * @property {string} action
 * @property {string} [tool]
 * @property {Record<string, any>} [input]
 * @property {string} [output]      Truncated, redacted output for the record.
 * @property {boolean} [ok]
 * @property {string} [error]
 * @property {number} [durationMs]
 * @property {FileSnapshot} [snapshot]  Restore data for `--undo` (write_file/edit_file only).
 * @property {number} ts
 *
 * @typedef {Object} VerifyCommandResult
 * @property {string} command
 * @property {boolean} ok
 * @property {number|null} code
 * @property {string} output        Truncated, redacted.
 * @property {boolean} [timedOut]
 *
 * @typedef {Object} VerificationResult
 * @property {boolean} passed
 * @property {boolean} skipped
 * @property {VerifyCommandResult[]} commands
 *
 * @typedef {Object} ReviewResult
 * @property {string[]} changed
 * @property {string[]} added
 * @property {string[]} removed
 * @property {boolean} gitAvailable
 * @property {string} [diffStat]
 * @property {string} [critique]
 *
 * @typedef {Object} RunRecord
 * @property {string} id
 * @property {string} task
 * @property {string} status          running | success | failed | dry-run
 * @property {string} startedAt
 * @property {string} [finishedAt]
 * @property {string} [objective]
 * @property {string} [context]       Truncated context handed to the LLM.
 * @property {Plan} [plan]
 * @property {ActionRecord[]} actions
 * @property {string[]} errors
 * @property {VerificationResult} [verification]
 * @property {ReviewResult} [review]
 * @property {string} [report]
 * @property {string} [summary]       Model's own completion summary.
 */

export {}
