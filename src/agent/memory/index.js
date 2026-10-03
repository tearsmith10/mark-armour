/**
 * Memory — the structured record of a single agent run.
 *
 * Task-shaped state the agent maintains while working:
 *
 *   Task
 *    ├── objective
 *    ├── context
 *    ├── plan
 *    ├── actions
 *    ├── results
 *    ├── errors
 *    ├── verification
 *    └── final status
 *
 * The record is written to `.agent/runs/<id>.json` at the end of every run so
 * runs are auditable and can be reviewed later (and so a human can see exactly
 * which commands a self-modifying system executed).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { truncate } from '../../utils/text.js'

/** @typedef {import('../../utils/types.js').RunRecord} RunRecord */
/** @typedef {import('../../utils/types.js').ActionRecord} ActionRecord */
/** @typedef {import('../../utils/types.js').Plan} Plan */
/** @typedef {import('../../utils/types.js').VerificationResult} VerificationResult */
/** @typedef {import('../../utils/types.js').ReviewResult} ReviewResult */

export class Memory {
  /**
   * @param {{ task: string, workspaceRoot: string, dryRun?: boolean }} args
   */
  constructor(args) {
    /** @type {RunRecord} */
    this.record = {
      id: `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
      task: args.task,
      status: args.dryRun ? 'dry-run' : 'running',
      startedAt: new Date().toISOString(),
      objective: args.task,
      actions: [],
      errors: [],
    }
    this.workspaceRoot = args.workspaceRoot
    this.dryRun = args.dryRun ?? false
  }

  /** @param {string} text */
  setContext(text) {
    this.record.context = truncate(text, 12_000)
  }

  /** @param {Plan} plan */
  setPlan(plan) {
    this.record.plan = plan
  }

  /**
   * Record one executed action (tool call, verification attempt, repair, …).
   * @param {ActionRecord} action
   */
  recordAction(action) {
    this.record.actions.push(action)
  }

  /** @param {string} message */
  recordError(message) {
    this.record.errors.push(truncate(message, 2000))
  }

  /** @param {VerificationResult} verification */
  setVerification(verification) {
    this.record.verification = verification
  }

  /** @param {ReviewResult} review */
  setReview(review) {
    this.record.review = review
  }

  /** @param {string} summary */
  setSummary(summary) {
    this.record.summary = truncate(summary, 4000)
  }

  /** @param {string} report */
  setReport(report) {
    this.record.report = report
  }

  /**
   * @param {'success'|'failed'|'dry-run'} status
   */
  finish(status) {
    this.record.status = status
    this.record.finishedAt = new Date().toISOString()
  }

  /** @returns {RunRecord} */
  toJSON() {
    return this.record
  }

  /**
   * Persist the run record under `.agent/runs/`.
   * @returns {Promise<string>} path written
   */
  async save() {
    const dir = join(this.workspaceRoot, '.agent', 'runs')
    await mkdir(dir, { recursive: true })
    const file = join(dir, `${this.record.id}.json`)
    await writeFile(file, JSON.stringify(this.record, null, 2), 'utf8')
    return file
  }
}
