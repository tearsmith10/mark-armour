/**
 * Prompt construction — one place where the agent talks to the model.
 *
 * Stages: PLANNER | EXECUTOR | REVIEWER | REPORTER | REPAIR
 * Each stage gets: system policy + task + context + tool manifest, plus
 * stage-specific instructions. All prompts demand strict JSON so responses can
 * be validated before execution (the agent never parses prose into actions).
 */

import { truncate } from '../utils/text.js'

/** @typedef {import('../utils/types.js').ChatMessage} ChatMessage */
/** @typedef {import('../utils/types.js').Tool} Tool */

const SYSTEM_POLICY = `You are an autonomous senior software engineer operating inside ONE workspace.
Rules:
- Work only through the provided tools. Never invent file contents; read before you edit.
- Prefer the smallest change that satisfies the task. Do not refactor unrelated code.
- After changing code you MUST validate (run_tests / run_command).
- Never print secrets. Never run destructive commands.
- Stay inside the repository: no absolute paths outside the workspace.
- Reply ONLY with the JSON shape requested. No prose, no markdown fences unless asked.`

/**
 * @param {Tool[]} tools
 * @returns {string}
 */
export function toolManifest(tools) {
  return tools
    .map(
      (t) =>
        `- ${t.name}${t.dangerous ? ' [modifies files/system]' : ''}: ${t.description}\n  input: ${JSON.stringify(t.inputSchema)}`,
    )
    .join('\n')
}

/**
 * @param {Object} args
 * @param {'PLANNER'|'EXECUTOR'|'REVIEWER'|'REPORTER'|'REPAIR'} args.stage
 * @param {string} args.task
 * @param {string} args.context
 * @param {Tool[]} args.tools
 * @param {string} [args.extra]   Stage-specific payload (plan, log, diff, error…)
 * @returns {ChatMessage[]}
 */
export function buildPromptMessages({ stage, task, context, tools, extra }) {
  /** @type {string} */
  let instruction
  switch (stage) {
    case 'PLANNER':
      instruction = `Create a plan for the task.
Respond with EXACTLY this JSON:
{"strategy": string, "steps": [{"goal": string, "tool": string|null, "args": object}]}
- 2..10 steps; each step has a concrete goal.
- "tool" must be one of the tool names below, or null for a reasoning/report step.
- "args" must satisfy that tool's input schema (e.g. {"path": "..."}).
- End the plan with a validation step (run_tests) whenever code changes are planned.`
      break
    case 'EXECUTOR':
      instruction = `You are now EXECUTING the plan. Look at the task, the plan and the latest tool results, then choose the NEXT single action.
Respond with EXACTLY one of these JSON objects:
{"reasoning": string, "tool": string, "args": object}   <- call one tool
{"done": true, "summary": string}                        <- task complete
Rules:
- One tool call per reply.
- NEVER repeat a tool call you already made with identical arguments: a result you
  already have is knowledge, not work left to do. If nothing remains, reply {"done": true}.
- If the previous tool failed, diagnose and choose a corrective action.
- Call run_tests (or the project validation) after your last code change before replying {"done": true}.`
      break
    case 'REPAIR':
      instruction = `Validation FAILED. Diagnose the error below and repair the code.
Respond with EXACTLY one of these JSON objects:
{"reasoning": string, "tool": string, "args": object}   <- next corrective tool call
{"done": true, "summary": string}                        <- fixed (only after re-running validation yourself)
Rules: fix the root cause, keep the change minimal, then re-run validation.`
      break
    case 'REVIEWER':
      instruction = `Review the changes summarized below as a skeptical senior engineer.
Respond with EXACTLY this JSON:
{"approved": boolean, "critique": string, "risks": string[]}
Flag: unrelated changes, missing validation, security issues, dead code.`
      break
    case 'REPORTER':
    default:
      instruction = `Write the final report for this run.
Respond with EXACTLY this JSON:
{"status": "success"|"partial"|"failed", "summary": string, "changes": string[], "validation": string, "followUps": string[]}
Keep the summary under 60 words. Be factual — only claim what the action log proves.`
      break
  }

  const system = `${SYSTEM_POLICY}

TOOLS AVAILABLE:
${toolManifest(tools)}`

  const user = [
    `TASK:\n${truncate(task, 4000)}`,
    `WORKSPACE CONTEXT:\n${truncate(context, 14_000)}`,
    extra ? `ADDITIONAL DATA:\n${truncate(extra, 12_000)}` : '',
    `STAGE: ${stage}`,
    instruction,
  ]
    .filter(Boolean)
    .join('\n\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
