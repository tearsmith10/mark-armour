/**
 * Model catalog and provider metadata.
 *
 * The agent never hard-codes a vendor: it resolves a provider id from config,
 * then constructs the matching adapter (`src/llm/adapters/*`). Adding a new
 * provider = add an entry here + an adapter file; no agent code changes.
 */

/**
 * @typedef {Object} ProviderInfo
 * @property {string} id
 * @property {string} label
 * @property {string} envKey         Environment variable holding the API key (null = local, no key).
 * @property {string|null} baseUrlEnv
 * @property {string} defaultModel
 * @property {string} docs
 */

/** @type {Record<string, ProviderInfo>} */
export const PROVIDERS = {
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    envKey: '', // no key — runs on localhost
    baseUrlEnv: 'OLLAMA_BASE_URL',
    defaultModel: 'llama3.1',
    docs: 'https://ollama.com/download — `ollama pull llama3.1 && ollama serve`',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (or any OpenAI-compatible endpoint)',
    envKey: 'OPENAI_API_KEY',
    baseUrlEnv: 'OPENAI_BASE_URL',
    defaultModel: 'gpt-4o-mini',
    docs: 'Set OPENAI_API_KEY; OPENAI_BASE_URL may point at a compatible gateway.',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    baseUrlEnv: 'ANTHROPIC_BASE_URL',
    defaultModel: 'claude-3-5-sonnet-latest',
    docs: 'Set ANTHROPIC_API_KEY.',
  },
  mock: {
    id: 'mock',
    label: 'Mock (offline / tests)',
    envKey: '',
    baseUrlEnv: null,
    defaultModel: 'mock-1',
    docs: 'Deterministic scripted provider used by `npm test` and offline dry runs.',
  },
}

/** Supported provider ids (order = preference). */
export const PROVIDER_IDS = Object.keys(PROVIDERS)

/** Alias used by src/config/index.js. */
export const PROVIDERS_LIST = PROVIDER_IDS

/**
 * A flat list for CLI `--list-providers` output.
 * @returns {ProviderInfo[]}
 */
export function listProviders() {
  return Object.values(PROVIDERS)
}
