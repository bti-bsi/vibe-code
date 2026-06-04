/**
 * @license
 * Copyright 2025 Vibe Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_VIBE_MODEL, MAINLINE_CODER_MODEL } from '../config/models.js';

import type { ModelConfig } from './types.js';

type AuthType = import('../core/contentGenerator.js').AuthType;
type ContentGeneratorConfig =
  import('../core/contentGenerator.js').ContentGeneratorConfig;

/**
 * Field keys for model-scoped generation config.
 *
 * Kept in a small standalone module to avoid circular deps. The `import('...')`
 * usage is type-only and does not emit runtime imports.
 */
export const MODEL_GENERATION_CONFIG_FIELDS = [
  'samplingParams',
  'timeout',
  'maxRetries',
  'retryErrorCodes',
  'enableCacheControl',
  'schemaCompliance',
  'reasoning',
  'contextWindowSize',
  'customHeaders',
  'extra_body',
  'modalities',
  'splitToolMedia',
  'useStreaming',
] as const satisfies ReadonlyArray<keyof ContentGeneratorConfig>;

/**
 * Credential-related fields that are part of ContentGeneratorConfig
 * but not ModelGenerationConfig.
 */
export const CREDENTIAL_FIELDS = [
  'model',
  'apiKey',
  'apiKeyEnvKey',
  'baseUrl',
] as const satisfies ReadonlyArray<keyof ContentGeneratorConfig>;

/**
 * All provider-sourced fields that need to be tracked for source attribution
 * and cleared when switching from provider to manual credentials.
 */
export const PROVIDER_SOURCED_FIELDS = [
  ...CREDENTIAL_FIELDS,
  ...MODEL_GENERATION_CONFIG_FIELDS,
] as const;

/**
 * Environment variable mappings per authType.
 */
export interface AuthEnvMapping {
  apiKey: string[];
  baseUrl: string[];
  model: string[];
}

export const AUTH_ENV_MAPPINGS = {
  openai: {
    apiKey: ['OPENAI_API_KEY'],
    baseUrl: ['OPENAI_BASE_URL'],
    model: ['OPENAI_MODEL', 'VIBE_MODEL'],
  },
  anthropic: {
    apiKey: ['ANTHROPIC_API_KEY'],
    baseUrl: ['ANTHROPIC_BASE_URL'],
    model: ['ANTHROPIC_MODEL'],
  },
  gemini: {
    apiKey: ['GEMINI_API_KEY'],
    baseUrl: [],
    model: ['GEMINI_MODEL'],
  },
  'vertex-ai': {
    apiKey: ['GOOGLE_API_KEY'],
    baseUrl: [],
    model: ['GOOGLE_MODEL'],
  },
  'vibe-oauth': {
    apiKey: [],
    baseUrl: [],
    model: [],
  },
  'google-adc': {
    apiKey: [],
    baseUrl: [],
    model: ['GEMINI_MODEL'],
  },
} as const satisfies Record<AuthType, AuthEnvMapping>;

export const DEFAULT_MODELS = {
  openai: MAINLINE_CODER_MODEL,
  'vibe-oauth': DEFAULT_VIBE_MODEL,
  'google-adc': 'gemini-2.5-flash',
} as Partial<Record<AuthType, string>>;

/**
 * Hard-coded Vibe OAuth models that are always available.
 * These cannot be overridden by user configuration.
 */
export const VIBE_OAUTH_MODELS: ModelConfig[] = [
  {
    id: 'coder-model',
    name: 'coder-model',
    description:
      'Vibe 3.6 Plus — efficient hybrid model with leading coding performance',
    capabilities: { vision: true },
  },
];

/**
 * Derive allowed models from VIBE_OAUTH_MODELS for authorization.
 * This ensures single source of truth (SSOT).
 */
export const VIBE_OAUTH_ALLOWED_MODELS = VIBE_OAUTH_MODELS.map(
  (model) => model.id,
) as readonly string[];
