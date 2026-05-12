/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  getErrorMessage,
  type Config,
  type ProviderModelConfig as ModelConfig,
} from '@vibe-bti/vibe-code-core';
import { writeStdoutLine, writeStderrLine } from '../../utils/stdioHelpers.js';
import { t } from '../../i18n/index.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import {
  getCodingPlanConfig,
  isCodingPlanConfig,
  CodingPlanRegion,
  CODING_PLAN_ENV_KEY,
} from '../../constants/codingPlan.js';
import { backupSettingsFile } from '../../utils/settingsUtils.js';
import { loadSettings, type LoadedSettings } from '../../config/settings.js';
import { loadCliConfig } from '../../config/config.js';
import type { CliArgs } from '../../config/config.js';
import { InteractiveSelector } from './interactiveSelector.js';
import {
  ALIBABA_STANDARD_API_KEY_ENDPOINTS,
  DASHSCOPE_STANDARD_API_KEY_ENV_KEY,
} from '../../constants/alibabaStandardApiKey.js';
import {
  applyOpenRouterModelsConfiguration,
  createOpenRouterOAuthSession,
  isOpenRouterConfig,
  OPENROUTER_ENV_KEY,
  runOpenRouterOAuthLogin,
} from './openrouterOAuth.js';

function formatElapsedTime(startMs: number): string {
  return `${((Date.now() - startMs) / 1000).toFixed(2)}s`;
}

function generateCustomApiKeyEnvKey(protocol: string, baseUrl: string): string {
  const normalize = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

  return `VIBE_CUSTOM_API_KEY_${normalize(protocol)}_${normalize(baseUrl)}`;
}

function normalizeCustomModelIds(modelIdsInput: string): string[] {
  return modelIdsInput
    .split(',')
    .map((id) => id.trim())
    .filter((id, index, array) => id.length > 0 && array.indexOf(id) === index);
}

interface VibeAuthOptions {
  region?: string;
  key?: string;
}

interface CodingPlanSettings {
  region?: CodingPlanRegion;
  version?: string;
}

interface MergedSettingsWithCodingPlan {
  security?: {
    auth?: {
      selectedType?: string;
      apiKey?: string;
      baseUrl?: string;
    };
  };
  codingPlan?: CodingPlanSettings;
  model?: {
    name?: string;
  };
  modelProviders?: Record<string, ModelConfig[]>;
  env?: Record<string, string>;
}

/**
 * Creates a minimal CliArgs for auth command config loading
 */
function createMinimalArgv(): CliArgs {
  return {
    query: undefined,
    model: undefined,
    sandbox: undefined,
    sandboxImage: undefined,
    debug: undefined,
    prompt: undefined,
    promptInteractive: undefined,
    yolo: undefined,
    bare: undefined,
    approvalMode: undefined,
    telemetry: undefined,
    checkpointing: undefined,
    telemetryTarget: undefined,
    telemetryOtlpEndpoint: undefined,
    telemetryOtlpProtocol: undefined,
    telemetryLogPrompts: undefined,
    telemetryOutfile: undefined,
    allowedMcpServerNames: undefined,
    mcpConfig: undefined,
    allowedTools: undefined,
    acp: undefined,
    experimentalAcp: undefined,
    experimentalLsp: undefined,
    extensions: [],
    listExtensions: undefined,
    openaiLogging: undefined,
    openaiApiKey: undefined,
    openaiBaseUrl: undefined,
    openaiLoggingDir: undefined,
    proxy: undefined,
    includeDirectories: undefined,
    screenReader: undefined,
    inputFormat: undefined,
    outputFormat: undefined,
    includePartialMessages: undefined,
    chatRecording: undefined,
    continue: undefined,
    resume: undefined,
    sessionId: undefined,
    maxSessionTurns: undefined,
    coreTools: undefined,
    excludeTools: undefined,
    disabledSlashCommands: undefined,
    authType: undefined,
    channel: undefined,
    systemPrompt: undefined,
    appendSystemPrompt: undefined,
  };
}

/**
 * Loads settings and config for auth commands
 */
async function loadAuthConfig(settings: LoadedSettings) {
  return loadCliConfig(
    settings.merged,
    createMinimalArgv(),
    process.cwd(),
    [],
    {
      userHooks: settings.getUserHooks(),
      projectHooks: settings.getProjectHooks(),
    },
  );
}

/**
 * Handles the authentication process based on the specified command and options
 */
export async function handleVibeAuth(
  command: 'vibe-oauth' | 'coding-plan' | 'openrouter',
  options: VibeAuthOptions,
) {
  try {
    const settings = loadSettings();
    const config = await loadAuthConfig(settings);

    if (command === 'vibe-oauth') {
      await handleVibeOAuth(config, settings);
    } else if (command === 'coding-plan') {
      await handleCodePlanAuth(config, settings, options);
    } else if (command === 'openrouter') {
      await handleOpenRouterAuth(config, settings, options);
    }

    // Exit after authentication is complete
    writeStdoutLine(t('Authentication completed successfully.'));
    process.exit(0);
  } catch (error) {
    writeStderrLine(getErrorMessage(error));
    process.exit(1);
  }
}

/**
 * Handles Vibe OAuth authentication
 */
async function handleVibeOAuth(
  config: Config,
  settings: LoadedSettings,
): Promise<void> {
  writeStdoutLine(t('Starting Vibe OAuth authentication...'));

  try {
    await config.refreshAuth(AuthType.VIBE_OAUTH);

    // Persist the auth type
    const authTypeScope = getPersistScopeForModelSelection(settings);
    settings.setValue(
      authTypeScope,
      'security.auth.selectedType',
      AuthType.VIBE_OAUTH,
    );

    writeStdoutLine(t('Successfully authenticated with Vibe OAuth.'));
    process.exit(0);
  } catch (error) {
    writeStderrLine(
      t('Failed to authenticate with Vibe OAuth: {{error}}', {
        error: getErrorMessage(error),
      }),
    );
    process.exit(1);
  }
}

/**
 * Handles Alibaba Cloud Coding Plan authentication
 */
async function handleCodePlanAuth(
  config: Config,
  settings: LoadedSettings,
  options: VibeAuthOptions,
): Promise<void> {
  const { region, key } = options;

  let selectedRegion: CodingPlanRegion;
  let selectedKey: string;

  // If region and key are provided as options, use them
  if (region && key) {
    selectedRegion =
      region.toLowerCase() === 'global'
        ? CodingPlanRegion.GLOBAL
        : CodingPlanRegion.CHINA;
    selectedKey = key;
  } else {
    // Otherwise, prompt interactively
    selectedRegion = await promptForRegion();
    selectedKey = await promptForKey();
  }

  writeStdoutLine(t('Processing Alibaba Cloud Coding Plan authentication...'));

  try {
    // Get configuration based on region
    const { template, version } = getCodingPlanConfig(selectedRegion);

    // Get persist scope
    const authTypeScope = getPersistScopeForModelSelection(settings);

    // Backup settings file before modification
    const settingsFile = settings.forScope(authTypeScope);
    backupSettingsFile(settingsFile.path);

    // Store api-key in settings.env (unified env key)
    settings.setValue(authTypeScope, `env.${CODING_PLAN_ENV_KEY}`, selectedKey);

    // Sync to process.env immediately so refreshAuth can read the apiKey
    process.env[CODING_PLAN_ENV_KEY] = selectedKey;

    // Generate model configs from template
    const newConfigs = template.map((templateConfig) => ({
      ...templateConfig,
      envKey: CODING_PLAN_ENV_KEY,
    }));

    // Get existing configs
    const existingConfigs =
      (settings.merged.modelProviders as Record<string, ModelConfig[]>)?.[
        AuthType.USE_OPENAI
      ] || [];

    // Filter out all existing Coding Plan configs (mutually exclusive)
    const nonCodingPlanConfigs = existingConfigs.filter(
      (existing) => !isCodingPlanConfig(existing.baseUrl, existing.envKey),
    );

    // Add new Coding Plan configs at the beginning
    const updatedConfigs = [...newConfigs, ...nonCodingPlanConfigs];

    // Persist to modelProviders
    settings.setValue(
      authTypeScope,
      `modelProviders.${AuthType.USE_OPENAI}`,
      updatedConfigs,
    );

    // Also persist authType
    settings.setValue(
      authTypeScope,
      'security.auth.selectedType',
      AuthType.USE_OPENAI,
    );

    // Persist coding plan region
    settings.setValue(authTypeScope, 'codingPlan.region', selectedRegion);

    // Persist coding plan version (single field for backward compatibility)
    settings.setValue(authTypeScope, 'codingPlan.version', version);

    // If there are configs, use the first one as the model
    if (updatedConfigs.length > 0 && updatedConfigs[0]?.id) {
      settings.setValue(
        authTypeScope,
        'model.name',
        (updatedConfigs[0] as ModelConfig).id,
      );
    }

    // Refresh auth with the new configuration
    await config.refreshAuth(AuthType.USE_OPENAI);

    writeStdoutLine(
      t('Successfully authenticated with Alibaba Cloud Coding Plan.'),
    );
  } catch (error) {
    writeStderrLine(
      t('Failed to authenticate with Coding Plan: {{error}}', {
        error: getErrorMessage(error),
      }),
    );
    process.exit(1);
  }
}

/**
 * Handles OpenRouter API key setup.
 */
async function handleOpenRouterAuth(
  config: Config,
  settings: LoadedSettings,
  options: VibeAuthOptions,
): Promise<void> {
  writeStdoutLine(t('Processing OpenRouter authentication...'));

  try {
    const authStartMs = Date.now();
    let selectedKey = options.key;

    if (!selectedKey) {
      const oauthStartMs = Date.now();
      const oauthSession = createOpenRouterOAuthSession();
      writeStdoutLine(
        t(
          'Starting OpenRouter OAuth in your browser. If needed, open this link manually: {{authorizationUrl}}',
          {
            authorizationUrl: oauthSession.authorizationUrl,
          },
        ),
      );
      const oauthResult = await runOpenRouterOAuthLogin(undefined, {
        session: oauthSession,
      });
      writeStdoutLine(
        t('Waited for OpenRouter browser authorization in {{elapsed}}.', {
          elapsed:
            typeof oauthResult.authorizationCodeWaitMs === 'number'
              ? `${(oauthResult.authorizationCodeWaitMs / 1000).toFixed(2)}s`
              : formatElapsedTime(oauthStartMs),
        }),
      );
      writeStdoutLine(
        t('Exchanged OpenRouter auth code for API key in {{elapsed}}.', {
          elapsed:
            typeof oauthResult.apiKeyExchangeMs === 'number'
              ? `${(oauthResult.apiKeyExchangeMs / 1000).toFixed(2)}s`
              : formatElapsedTime(oauthStartMs),
        }),
      );
      writeStdoutLine(
        t('OpenRouter OAuth callback completed in {{elapsed}}.', {
          elapsed: formatElapsedTime(oauthStartMs),
        }),
      );
      selectedKey = oauthResult.apiKey;
    }

    if (!selectedKey) {
      throw new Error(
        'OpenRouter authentication completed without an API key.',
      );
    }

    const authTypeScope = getPersistScopeForModelSelection(settings);
    const settingsFile = settings.forScope(authTypeScope);
    backupSettingsFile(settingsFile.path);

    const modelsStartMs = Date.now();
    await applyOpenRouterModelsConfiguration({
      settings,
      config,
      apiKey: selectedKey,
      reloadConfig: true,
    });
    writeStdoutLine(
      t('Fetched OpenRouter models in {{elapsed}}.', {
        elapsed: formatElapsedTime(modelsStartMs),
      }),
    );

    const refreshStartMs = Date.now();
    await config.refreshAuth(AuthType.USE_OPENAI);
    writeStdoutLine(
      t('Refreshed OpenRouter auth in {{elapsed}}.', {
        elapsed: formatElapsedTime(refreshStartMs),
      }),
    );
    writeStdoutLine(
      t('Total OpenRouter setup time: {{elapsed}}.', {
        elapsed: formatElapsedTime(authStartMs),
      }),
    );

    writeStdoutLine(t('Successfully configured OpenRouter.'));
  } catch (error) {
    writeStderrLine(
      t('Failed to configure OpenRouter: {{error}}', {
        error: getErrorMessage(error),
      }),
    );
    process.exit(1);
  }
}

/**
 * Prompts the user to select a region using an interactive selector
 */
async function promptForRegion(): Promise<CodingPlanRegion> {
  const selector = new InteractiveSelector(
    [
      {
        value: CodingPlanRegion.CHINA,
        label: t('中国 (China)'),
        description: t('阿里云百炼 (aliyun.com)'),
      },
      {
        value: CodingPlanRegion.GLOBAL,
        label: t('Global'),
        description: t('Alibaba Cloud (alibabacloud.com)'),
      },
    ],
    t('Select region for Coding Plan:'),
  );

  return await selector.select();
}

/**
 * Generic raw-mode text input prompt.
 * @param promptText - Text displayed before the cursor
 * @param options.mask - If true, echoes '*' instead of the typed character (for passwords)
 * @param options.defaultValue - Value returned when the user presses Enter on empty input
 */
async function promptForInput(
  promptText: string,
  options: { mask?: boolean; defaultValue?: string } = {},
): Promise<string> {
  const { mask = false, defaultValue } = options;
  const stdin = process.stdin;
  const stdout = process.stdout;

  stdout.write(promptText);

  const wasRaw = stdin.isRaw;
  if (stdin.setRawMode) {
    stdin.setRawMode(true);
  }
  stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let input = '';

    const onData = (chunk: string) => {
      for (const char of chunk) {
        switch (char) {
          case '\r': // Enter
          case '\n':
            stdin.removeListener('data', onData);
            if (stdin.setRawMode) {
              stdin.setRawMode(wasRaw);
            }
            stdout.write('\n');
            resolve(
              defaultValue !== undefined && !input ? defaultValue : input,
            );
            return;
          case '\x03': // Ctrl+C
            stdin.removeListener('data', onData);
            if (stdin.setRawMode) {
              stdin.setRawMode(wasRaw);
            }
            stdout.write('^C\n');
            reject(new Error('Interrupted'));
            return;
          case '\x08': // Backspace
          case '\x7F': // Delete
            if (input.length > 0) {
              input = input.slice(0, -1);
              // Move cursor back, print space, move back again
              stdout.write('\x1B[D \x1B[D');
            }
            break;
          default:
            input += char;
            stdout.write(mask ? '*' : char);
            break;
        }
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * Prompts the user to enter an API key (masked input)
 */
async function promptForKey(
  promptText: string = t('Enter your Coding Plan API key: '),
): Promise<string> {
  return promptForInput(promptText, { mask: true });
}

/**
 * Runs the interactive authentication flow
 */
export async function runInteractiveAuth() {
  await handleApiKeyAuth();
}

/**
 * Handles API Key authentication - shows sub-menu for Standard or Custom API key
 */
export async function handleApiKeyAuth() {
  try {
    const settings = loadSettings();
    const config = await loadAuthConfig(settings);
    const protocol = await promptForCustomProtocol();
    const defaultBaseUrl = getDefaultCustomBaseUrl(protocol);
    const baseUrl = (
      await promptForInput(
        t('Enter base URL (default: {{default}}): ', {
          default: defaultBaseUrl,
        }),
        { defaultValue: defaultBaseUrl },
      )
    ).trim();
    if (!baseUrl) {
      writeStderrLine(t('Base URL cannot be empty.'));
      process.exit(1);
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      writeStderrLine(t('Base URL must start with http:// or https://.'));
      process.exit(1);
    }

    const apiKey = (await promptForKey(t('Enter your API key: '))).trim();
    if (!apiKey) {
      writeStderrLine(t('API key cannot be empty.'));
      process.exit(1);
    }

    const modelIds = normalizeCustomModelIds(
      await promptForInput(t('Enter model IDs (comma-separated): ')),
    );
    if (modelIds.length === 0) {
      writeStderrLine(t('Model IDs cannot be empty.'));
      process.exit(1);
    }

    await handleCustomApiKeyAuth(
      config,
      settings,
      protocol,
      baseUrl,
      apiKey,
      modelIds,
    );
  } catch (error) {
    writeStderrLine(getErrorMessage(error));
    process.exit(1);
  }
}

function getDefaultCustomBaseUrl(
  protocol: AuthType.USE_OPENAI | AuthType.USE_ANTHROPIC | AuthType.USE_GEMINI,
): string {
  switch (protocol) {
    case AuthType.USE_ANTHROPIC:
      return 'https://api.anthropic.com/v1';
    case AuthType.USE_GEMINI:
      return 'https://generativelanguage.googleapis.com';
    case AuthType.USE_OPENAI:
    default:
      return 'https://api.openai.com/v1';
  }
}

async function promptForCustomProtocol(): Promise<
  AuthType.USE_OPENAI | AuthType.USE_ANTHROPIC | AuthType.USE_GEMINI
> {
  const selector = new InteractiveSelector(
    [
      {
        value: AuthType.USE_OPENAI as const,
        label: t('OpenAI-compatible'),
        description: t(
          'OpenAI Chat Completions API (OpenRouter, vLLM, Ollama, LM Studio, Fireworks, etc.)',
        ),
      },
      {
        value: AuthType.USE_ANTHROPIC as const,
        label: t('Anthropic-compatible'),
        description: t('Anthropic Messages API'),
      },
      {
        value: AuthType.USE_GEMINI as const,
        label: t('Gemini-compatible'),
        description: t('Google Gemini API'),
      },
    ],
    t('Select custom API protocol:'),
  );

  return selector.select();
}

async function handleCustomApiKeyAuth(
  config: Config,
  settings: LoadedSettings,
  protocol: AuthType.USE_OPENAI | AuthType.USE_ANTHROPIC | AuthType.USE_GEMINI,
  baseUrl: string,
  apiKey: string,
  modelIds: string[],
): Promise<void> {
  try {
    const persistScope = getPersistScopeForModelSelection(settings);
    const settingsFile = settings.forScope(persistScope);
    backupSettingsFile(settingsFile.path);

    const generatedEnvKey = generateCustomApiKeyEnvKey(protocol, baseUrl);
    settings.setValue(persistScope, `env.${generatedEnvKey}`, apiKey);
    process.env[generatedEnvKey] = apiKey;

    const newConfigs: ModelConfig[] = modelIds.map((modelId) => ({
      id: modelId,
      name: modelId,
      baseUrl,
      envKey: generatedEnvKey,
    }));

    const existingConfigs =
      (settings.merged.modelProviders as Record<string, ModelConfig[]>)?.[
        protocol
      ] || [];
    const preservedConfigs = existingConfigs.filter(
      (existing) => existing.envKey !== generatedEnvKey,
    );
    const updatedConfigs = [...newConfigs, ...preservedConfigs];

    settings.setValue(
      persistScope,
      `modelProviders.${protocol}`,
      updatedConfigs,
    );
    settings.setValue(persistScope, 'security.auth.selectedType', protocol);
    settings.setValue(persistScope, 'model.name', modelIds[0]);

    const updatedModelProviders: Record<string, ModelConfig[]> = {
      ...(settings.merged.modelProviders as Record<string, ModelConfig[]>),
      [protocol]: updatedConfigs,
    };
    config.reloadModelProvidersConfig(updatedModelProviders);
    await config.refreshAuth(protocol);

    writeStdoutLine(
      t(
        'Custom API Key authenticated successfully. Settings updated with generated env key and model provider config.',
      ),
    );
    writeStdoutLine(t('Tip: Use /model to switch between configured models.'));
    process.exit(0);
  } catch (error) {
    writeStderrLine(getErrorMessage(error));
    process.exit(1);
  }
}

/**
 * Shows the current authentication status
 */
export async function showAuthStatus(): Promise<void> {
  try {
    const settings = loadSettings();
    const mergedSettings = settings.merged as MergedSettingsWithCodingPlan;

    writeStdoutLine(t('\n=== Authentication Status ===\n'));

    // Check for selected auth type
    const selectedType = mergedSettings.security?.auth?.selectedType;

    if (!selectedType) {
      writeStdoutLine(t('⚠️  No authentication method configured.\n'));
      writeStdoutLine(t('Run one of the following commands to get started:\n'));
      writeStdoutLine(
        t('  vibe auth api-key        - Authenticate with an API key'),
      );
      writeStdoutLine(t('Or simply run:'));
      writeStdoutLine(
        t('  vibe auth                - Interactive authentication setup\n'),
      );
      process.exit(0);
    }

    // Display status based on auth type
    if (selectedType === AuthType.VIBE_OAUTH) {
      writeStdoutLine(t('✓ Authentication Method: Vibe OAuth'));
      writeStdoutLine(t('  Type: Free tier (discontinued 2026-04-15)'));
      writeStdoutLine(t('  Limit: No longer available'));
      writeStdoutLine(t('  Models: Vibe latest models'));
      writeStdoutLine(
        t('\n  ⚠ Run /auth to switch to Coding Plan or another provider.\n'),
      );
    } else if (selectedType === AuthType.USE_OPENAI) {
      const codingPlanRegion = mergedSettings.codingPlan?.region;
      const codingPlanVersion = mergedSettings.codingPlan?.version;
      const modelName = mergedSettings.model?.name;
      const openAiProviders =
        mergedSettings.modelProviders?.[AuthType.USE_OPENAI] || [];
      const activeConfig = modelName
        ? openAiProviders.find((c) => c.id === modelName)
        : openAiProviders[0];
      const isActiveOpenRouter = activeConfig
        ? isOpenRouterConfig(activeConfig)
        : false;
      const providerCodingPlanRegion = isCodingPlanConfig(
        activeConfig?.baseUrl,
        activeConfig?.envKey,
      );
      const detectedCodingPlanRegion = activeConfig
        ? providerCodingPlanRegion
        : !modelName
          ? codingPlanRegion
          : false;
      const isActiveStandard =
        activeConfig &&
        activeConfig.envKey === DASHSCOPE_STANDARD_API_KEY_ENV_KEY &&
        typeof activeConfig.baseUrl === 'string' &&
        Object.values(ALIBABA_STANDARD_API_KEY_ENDPOINTS).includes(
          activeConfig.baseUrl,
        );
      const hasOpenRouterApiKey =
        !!process.env[OPENROUTER_ENV_KEY] ||
        !!mergedSettings.env?.[OPENROUTER_ENV_KEY];

      if (isActiveOpenRouter) {
        if (hasOpenRouterApiKey) {
          writeStdoutLine(t('✓ Authentication Method: OpenRouter'));

          if (modelName) {
            writeStdoutLine(
              t('  Current Model: {{model}}', { model: modelName }),
            );
          }

          writeStdoutLine(t('  Status: API key configured\n'));
        } else {
          writeStdoutLine(
            t('⚠️  Authentication Method: OpenRouter (Incomplete)'),
          );
          writeStdoutLine(
            t('  Issue: API key not found in environment or settings\n'),
          );
          writeStdoutLine(t('  Run `vibe auth openrouter` to re-configure.\n'));
        }
      } else if (detectedCodingPlanRegion) {
        const hasCodingPlanKey =
          !!process.env[CODING_PLAN_ENV_KEY] ||
          !!mergedSettings.env?.[CODING_PLAN_ENV_KEY];

        if (hasCodingPlanKey) {
          writeStdoutLine(
            t('✓ Authentication Method: Alibaba Cloud Coding Plan'),
          );

          const displayRegion = codingPlanRegion || detectedCodingPlanRegion;
          if (displayRegion) {
            const regionDisplay =
              displayRegion === CodingPlanRegion.CHINA
                ? t('中国 (China) - 阿里云百炼')
                : t('Global - Alibaba Cloud');
            writeStdoutLine(
              t('  Region: {{region}}', { region: regionDisplay }),
            );
          }

          if (modelName) {
            writeStdoutLine(
              t('  Current Model: {{model}}', { model: modelName }),
            );
          }

          if (codingPlanVersion) {
            writeStdoutLine(
              t('  Config Version: {{version}}', {
                version: codingPlanVersion.substring(0, 8) + '...',
              }),
            );
          }

          writeStdoutLine(t('  Status: API key configured\n'));
        } else {
          writeStdoutLine(
            t(
              '⚠️  Authentication Method: Alibaba Cloud Coding Plan (Incomplete)',
            ),
          );
          writeStdoutLine(
            t('  Issue: API key not found in environment or settings\n'),
          );
          writeStdoutLine(
            t('  Run `vibe auth coding-plan` to re-configure.\n'),
          );
        }
      } else if (isActiveStandard) {
        const hasStandardKey =
          !!process.env[DASHSCOPE_STANDARD_API_KEY_ENV_KEY] ||
          !!mergedSettings.env?.[DASHSCOPE_STANDARD_API_KEY_ENV_KEY];

        if (hasStandardKey) {
          writeStdoutLine(
            t(
              '✓ Authentication Method: Alibaba Cloud ModelStudio Standard API Key',
            ),
          );

          if (modelName) {
            writeStdoutLine(
              t('  Current Model: {{model}}', { model: modelName }),
            );
          }

          writeStdoutLine(t('  Status: API key configured\n'));
        } else {
          writeStdoutLine(
            t(
              '⚠️  Authentication Method: Alibaba Cloud ModelStudio Standard API Key (Incomplete)',
            ),
          );
          writeStdoutLine(
            t('  Issue: API key not found in environment or settings\n'),
          );
          writeStdoutLine(t('  Run `vibe auth api-key` to re-configure.\n'));
        }
      } else if (activeConfig) {
        let hasApiKey: boolean;
        if (activeConfig.envKey) {
          hasApiKey =
            !!process.env[activeConfig.envKey] ||
            !!mergedSettings.env?.[activeConfig.envKey];
        } else {
          hasApiKey =
            !!process.env['OPENAI_API_KEY'] ||
            !!mergedSettings.env?.['OPENAI_API_KEY'] ||
            !!mergedSettings.security?.auth?.apiKey;
        }

        if (hasApiKey) {
          writeStdoutLine(
            t('✓ Authentication Method: OpenAI-compatible Provider'),
          );

          if (modelName) {
            writeStdoutLine(
              t('  Current Model: {{model}}', { model: modelName }),
            );
          }

          const baseUrl =
            activeConfig.baseUrl || mergedSettings.security?.auth?.baseUrl;
          if (baseUrl) {
            writeStdoutLine(t('  Base URL: {{baseUrl}}', { baseUrl }));
          }

          writeStdoutLine(t('  Status: API key configured\n'));
        } else {
          writeStdoutLine(
            t(
              '⚠️  Authentication Method: OpenAI-compatible Provider (Incomplete)',
            ),
          );
          writeStdoutLine(
            t('  Issue: API key not found in environment or settings\n'),
          );
          writeStdoutLine(t('  Run `vibe auth` to re-configure.\n'));
        }
      } else {
        const hasCodingPlanKey =
          !!process.env[CODING_PLAN_ENV_KEY] ||
          !!mergedSettings.env?.[CODING_PLAN_ENV_KEY];
        const hasGenericApiKey =
          !!process.env['OPENAI_API_KEY'] ||
          !!mergedSettings.env?.['OPENAI_API_KEY'] ||
          !!mergedSettings.security?.auth?.apiKey;
        const hasCodingPlanMetadata =
          !modelName && (!!codingPlanRegion || !!codingPlanVersion);

        if (hasGenericApiKey) {
          writeStdoutLine(
            t('✓ Authentication Method: OpenAI-compatible Provider'),
          );

          if (modelName) {
            writeStdoutLine(
              t('  Current Model: {{model}}', { model: modelName }),
            );
          }

          const baseUrl = mergedSettings.security?.auth?.baseUrl;
          if (baseUrl) {
            writeStdoutLine(t('  Base URL: {{baseUrl}}', { baseUrl }));
          }

          writeStdoutLine(t('  Status: API key configured\n'));
        } else if (hasCodingPlanKey) {
          writeStdoutLine(
            t('✓ Authentication Method: Alibaba Cloud Coding Plan'),
          );

          if (codingPlanRegion) {
            const regionDisplay =
              codingPlanRegion === CodingPlanRegion.CHINA
                ? t('中国 (China) - 阿里云百炼')
                : t('Global - Alibaba Cloud');
            writeStdoutLine(
              t('  Region: {{region}}', { region: regionDisplay }),
            );
          }

          if (modelName) {
            writeStdoutLine(
              t('  Current Model: {{model}}', { model: modelName }),
            );
          }

          if (codingPlanVersion) {
            writeStdoutLine(
              t('  Config Version: {{version}}', {
                version: codingPlanVersion.substring(0, 8) + '...',
              }),
            );
          }

          writeStdoutLine(t('  Status: API key configured\n'));
        } else if (hasCodingPlanMetadata) {
          writeStdoutLine(
            t(
              '⚠️  Authentication Method: Alibaba Cloud Coding Plan (Incomplete)',
            ),
          );
          writeStdoutLine(
            t('  Issue: API key not found in environment or settings\n'),
          );
          writeStdoutLine(
            t('  Run `vibe auth coding-plan` to re-configure.\n'),
          );
        } else {
          writeStdoutLine(
            t(
              '⚠️  Authentication Method: OpenAI-compatible Provider (Incomplete)',
            ),
          );
          writeStdoutLine(
            t('  Issue: API key not found in environment or settings\n'),
          );
          writeStdoutLine(t('  Run `vibe auth` to re-configure.\n'));
        }
      }
    } else {
      writeStdoutLine(
        t('✓ Authentication Method: {{type}}', { type: selectedType }),
      );
      writeStdoutLine(t('  Status: Configured\n'));
    }
    process.exit(0);
  } catch (error) {
    writeStderrLine(
      t('Failed to check authentication status: {{error}}', {
        error: getErrorMessage(error),
      }),
    );
    process.exit(1);
  }
}
