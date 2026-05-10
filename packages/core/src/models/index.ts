/**
 * @license
 * Copyright 2025 Vibe Team
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  type ModelCapabilities,
  type ModelGenerationConfig,
  type ModelConfig,
  type ModelProvidersConfig,
  type ResolvedModelConfig,
  type AvailableModel,
  type ModelSwitchMetadata,
  type RuntimeModelSnapshot,
} from './types.js';

export { ModelRegistry } from './modelRegistry.js';

export {
  ModelsConfig,
  type ModelsConfigOptions,
  type OnModelChangeCallback,
} from './modelsConfig.js';

export {
  AUTH_ENV_MAPPINGS,
  CREDENTIAL_FIELDS,
  DEFAULT_MODELS,
  MODEL_GENERATION_CONFIG_FIELDS,
  PROVIDER_SOURCED_FIELDS,
  VIBE_OAUTH_ALLOWED_MODELS,
  VIBE_OAUTH_MODELS,
} from './constants.js';

// Model configuration resolver
export {
  resolveModelConfig,
  validateModelConfig,
  type ModelConfigSourcesInput,
  type ModelConfigCliInput,
  type ModelConfigSettingsInput,
  type ModelConfigResolutionResult,
  type ModelConfigValidationResult,
} from './modelConfigResolver.js';
