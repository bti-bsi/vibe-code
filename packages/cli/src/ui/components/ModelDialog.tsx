/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  AuthType,
  MAINLINE_CODER_MODEL,
  ModelSlashCommandEvent,
  logModelSlashCommand,
  type AvailableModel as CoreAvailableModel,
  type ContentGeneratorConfig,
  type InputModalities,
  type ModelProvidersConfig,
  type ProviderModelConfig,
} from '@vibe-bti/vibe-code-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { TextInput } from './shared/TextInput.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { UIStateContext, type UIState } from '../contexts/UIStateContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import { t } from '../../i18n/index.js';
import { backupSettingsFile } from '../../utils/settingsUtils.js';

function formatModalities(modalities?: InputModalities): string {
  if (!modalities) return t('text-only');
  const parts: string[] = [];
  if (modalities.image) parts.push(t('image'));
  if (modalities.pdf) parts.push(t('pdf'));
  if (modalities.audio) parts.push(t('audio'));
  if (modalities.video) parts.push(t('video'));
  if (parts.length === 0) return t('text-only');
  return `${t('text')} · ${parts.join(' · ')}`;
}

interface ModelDialogProps {
  onClose: () => void;
  isFastModelMode?: boolean;
}

const CREATE_CUSTOM_MODEL_VALUE = '__create_custom_model__';

type CustomModelAuthType =
  | AuthType.USE_OPENAI
  | AuthType.USE_ANTHROPIC
  | AuthType.USE_GEMINI;

type DialogMode =
  | 'select'
  | 'create-auth-type'
  | 'create-base-url'
  | 'create-api-key'
  | 'create-model-id'
  | 'create-reasoning-effort';

type ReasoningEffort = 'low' | 'medium' | 'high' | 'max';

function normalizeConfigToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function generateCustomModelEnvKey(
  authType: CustomModelAuthType,
  baseUrl: string,
): string {
  return `VIBE_CUSTOM_MODEL_API_KEY_${normalizeConfigToken(authType)}_${normalizeConfigToken(baseUrl)}`;
}

function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey) return `(${t('not set')})`;
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) return `(${t('not set')})`;
  if (trimmed.length <= 6) return '***';
  const head = trimmed.slice(0, 3);
  const tail = trimmed.slice(-4);
  return `${head}…${tail}`;
}

function persistModelSelection(
  settings: ReturnType<typeof useSettings>,
  modelId: string,
): void {
  const scope = getPersistScopeForModelSelection(settings);
  settings.setValue(scope, 'model.name', modelId);
}

function persistAuthTypeSelection(
  settings: ReturnType<typeof useSettings>,
  authType: AuthType,
): void {
  const scope = getPersistScopeForModelSelection(settings);
  settings.setValue(scope, 'security.auth.selectedType', authType);
}

function isCustomModelAuthType(
  value: AuthType | undefined,
): value is CustomModelAuthType {
  return (
    value === AuthType.USE_OPENAI ||
    value === AuthType.USE_ANTHROPIC ||
    value === AuthType.USE_GEMINI
  );
}

function getInitialCustomModelAuthType(
  authType: AuthType | undefined,
): CustomModelAuthType {
  return isCustomModelAuthType(authType) ? authType : AuthType.USE_OPENAI;
}

interface HandleModelSwitchSuccessParams {
  settings: ReturnType<typeof useSettings>;
  uiState: UIState | null;
  after: ContentGeneratorConfig | undefined;
  effectiveAuthType: AuthType | undefined;
  effectiveModelId: string;
  isRuntime: boolean;
}

function handleModelSwitchSuccess({
  settings,
  uiState,
  after,
  effectiveAuthType,
  effectiveModelId,
  isRuntime,
}: HandleModelSwitchSuccessParams): void {
  persistModelSelection(settings, effectiveModelId);
  if (effectiveAuthType) {
    persistAuthTypeSelection(settings, effectiveAuthType);
  }

  const baseUrl = after?.baseUrl ?? t('(default)');
  const maskedKey = maskApiKey(after?.apiKey);
  uiState?.historyManager.addItem(
    {
      type: 'info',
      text:
        `authType: ${effectiveAuthType ?? `(${t('none')})`}` +
        `\n` +
        `Using ${isRuntime ? 'runtime ' : ''}model: ${effectiveModelId}` +
        `\n` +
        `Base URL: ${baseUrl}` +
        `\n` +
        `API key: ${maskedKey}`,
    },
    Date.now(),
  );
}

function formatContextWindow(size?: number): string {
  if (!size) return `(${t('unknown')})`;
  return `${size.toLocaleString('en-US')} tokens`;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box>
      <Box minWidth={16} flexShrink={0}>
        <Text color={theme.text.secondary}>{label}:</Text>
      </Box>
      <Box flexGrow={1} flexDirection="row" flexWrap="wrap">
        <Text>{value}</Text>
      </Box>
    </Box>
  );
}

export function ModelDialog({
  onClose,
  isFastModelMode,
}: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const uiState = useContext(UIStateContext);
  const settings = useSettings();
  const authType = config?.getAuthType();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightedValue, setHighlightedValue] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>('select');
  const [customModelAuthType, setCustomModelAuthType] =
    useState<CustomModelAuthType>(getInitialCustomModelAuthType(authType));
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [customReasoningEffort, setCustomReasoningEffort] =
    useState<ReasoningEffort>('medium');

  const availableModelEntries = useMemo(() => {
    const allModels = config ? config.getAllConfiguredModels() : [];
    const runtimeModels = allModels.filter((m) => m.isRuntimeModel);
    const registryModels = allModels.filter((m) => !m.isRuntimeModel);

    const modelsByAuthTypeMap = new Map<AuthType, CoreAvailableModel[]>();
    for (const model of registryModels) {
      const modelAuthType = model.authType;
      if (!modelsByAuthTypeMap.has(modelAuthType)) {
        modelsByAuthTypeMap.set(modelAuthType, []);
      }
      modelsByAuthTypeMap.get(modelAuthType)?.push(model);
    }

    const authTypeOrder: AuthType[] = [
      AuthType.VIBE_OAUTH,
      AuthType.USE_OPENAI,
      AuthType.USE_ANTHROPIC,
      AuthType.USE_GEMINI,
      AuthType.USE_VERTEX_AI,
    ];

    const availableAuthTypes = new Set(modelsByAuthTypeMap.keys());
    const orderedAuthTypes = authTypeOrder.filter((item) =>
      availableAuthTypes.has(item),
    );

    const result: Array<{
      authType: AuthType;
      model: CoreAvailableModel;
      isRuntime?: boolean;
      snapshotId?: string;
    }> = [];

    for (const runtimeModel of runtimeModels) {
      result.push({
        authType: runtimeModel.authType,
        model: runtimeModel,
        isRuntime: true,
        snapshotId: runtimeModel.runtimeSnapshotId,
      });
    }

    for (const item of orderedAuthTypes) {
      for (const model of modelsByAuthTypeMap.get(item) ?? []) {
        result.push({ authType: item, model, isRuntime: false });
      }
    }

    return result;
  }, [config]);

  const modelOptions = useMemo(
    () => [
      {
        value: CREATE_CUSTOM_MODEL_VALUE,
        title: (
          <Text color={theme.text.accent}>
            [{t('Custom')}] {t('Create New Model')}
          </Text>
        ),
        description: t(
          'Add a custom provider model by entering API type, base URL, API key, model ID, and reasoning mode.',
        ),
        key: CREATE_CUSTOM_MODEL_VALUE,
      },
      ...availableModelEntries.map(
        ({ authType: entryAuthType, model, isRuntime, snapshotId }) => {
          const value =
            isRuntime && snapshotId
              ? snapshotId
              : `${entryAuthType}::${model.id}`;
          const isVibeOAuth = entryAuthType === AuthType.VIBE_OAUTH;

          const title = (
            <Text>
              <Text
                bold
                color={
                  isVibeOAuth
                    ? theme.status.warning
                    : isRuntime
                      ? theme.status.warning
                      : theme.text.accent
                }
              >
                [{entryAuthType}]
              </Text>
              <Text>{` ${model.label}`}</Text>
              {isRuntime && (
                <Text color={theme.status.warning}> (Runtime)</Text>
              )}
              {isVibeOAuth && !isRuntime && (
                <Text color={theme.status.warning}> ({t('Discontinued')})</Text>
              )}
            </Text>
          );

          let description = model.description || '';
          if (isRuntime) {
            description = description
              ? `${description} (Runtime)`
              : 'Runtime model';
          }
          if (isVibeOAuth && !isRuntime) {
            description = t('Discontinued — switch to Coding Plan or API Key');
          }

          return {
            value,
            title,
            description,
            key: value,
          };
        },
      ),
    ],
    [availableModelEntries],
  );

  const fastModelSetting = settings?.merged?.fastModel as string | undefined;
  const preferredModelId =
    isFastModelMode && fastModelSetting
      ? fastModelSetting
      : config?.getModel() || MAINLINE_CODER_MODEL;
  const activeRuntimeSnapshot = isFastModelMode
    ? undefined
    : config?.getActiveRuntimeModelSnapshot?.();
  const preferredKey = activeRuntimeSnapshot
    ? activeRuntimeSnapshot.id
    : authType
      ? `${authType}::${preferredModelId}`
      : '';

  const resetCustomModelFlow = useCallback(() => {
    setCustomModelAuthType(getInitialCustomModelAuthType(authType));
    setCustomBaseUrl('');
    setCustomApiKey('');
    setCustomModelId('');
    setCustomReasoningEffort('medium');
    setErrorMessage(null);
    setDialogMode('select');
  }, [authType]);

  useKeypress(
    (key) => {
      if (dialogMode !== 'select' && key.name === 'escape') {
        setErrorMessage(null);
        switch (dialogMode) {
          case 'create-auth-type':
            resetCustomModelFlow();
            return;
          case 'create-base-url':
            setDialogMode('create-auth-type');
            return;
          case 'create-api-key':
            setDialogMode('create-base-url');
            return;
          case 'create-model-id':
            setDialogMode('create-api-key');
            return;
          case 'create-reasoning-effort':
            setDialogMode('create-model-id');
            return;
          default:
            return;
        }
      }

      if (
        dialogMode === 'select' &&
        (key.name === 'escape' || (key.name === 'left' && isFastModelMode))
      ) {
        onClose();
      }
    },
    { isActive: true },
  );

  const initialIndex = useMemo(() => {
    const index = modelOptions.findIndex(
      (option) => option.value === preferredKey,
    );
    return index === -1 ? 0 : index;
  }, [modelOptions, preferredKey]);

  const handleHighlight = useCallback((value: string) => {
    setHighlightedValue(value);
  }, []);

  const highlightedEntry = useMemo(() => {
    const key = highlightedValue ?? preferredKey;
    return availableModelEntries.find(
      ({ authType: entryAuthType, model, isRuntime, snapshotId }) => {
        const value =
          isRuntime && snapshotId
            ? snapshotId
            : `${entryAuthType}::${model.id}`;
        return value === key;
      },
    );
  }, [availableModelEntries, highlightedValue, preferredKey]);

  const saveCustomModel = useCallback(
    async (reasoningOverride?: ReasoningEffort) => {
      if (!config) {
        return;
      }

      const trimmedBaseUrl = customBaseUrl.trim();
      const trimmedApiKey = customApiKey.trim();
      const trimmedModelId = customModelId.trim();
      const effectiveReasoningEffort =
        reasoningOverride ?? customReasoningEffort;

      if (!trimmedBaseUrl) {
        setErrorMessage(t('API URL cannot be empty.'));
        setDialogMode('create-base-url');
        return;
      }
      if (!/^https?:\/\//i.test(trimmedBaseUrl)) {
        setErrorMessage(t('API URL must start with http:// or https://.'));
        setDialogMode('create-base-url');
        return;
      }
      if (!trimmedApiKey) {
        setErrorMessage(t('API key cannot be empty.'));
        setDialogMode('create-api-key');
        return;
      }
      if (!trimmedModelId) {
        setErrorMessage(t('Model ID cannot be empty.'));
        setDialogMode('create-model-id');
        return;
      }

      const persistScope = getPersistScopeForModelSelection(settings);
      const previousModelProviders = settings.merged.modelProviders as
        | ModelProvidersConfig
        | undefined;
      const existingConfigs: ProviderModelConfig[] =
        previousModelProviders?.[customModelAuthType] ?? [];
      const envKey = generateCustomModelEnvKey(
        customModelAuthType,
        trimmedBaseUrl,
      );
      const nextModelConfig: ProviderModelConfig = {
        id: trimmedModelId,
        name: trimmedModelId,
        baseUrl: trimmedBaseUrl,
        envKey,
        generationConfig: {
          useStreaming: true,
          reasoning: { effort: effectiveReasoningEffort },
        } as ProviderModelConfig['generationConfig'],
      };
      const updatedConfigs: ProviderModelConfig[] = [
        nextModelConfig,
        ...existingConfigs.filter((entry) => entry.id !== trimmedModelId),
      ];
      const updatedModelProviders = {
        ...(previousModelProviders ?? {}),
        [customModelAuthType]: updatedConfigs,
      } satisfies ModelProvidersConfig;

      process.env[envKey] = trimmedApiKey;
      config.reloadModelProvidersConfig(updatedModelProviders);

      try {
        await config.switchModel(customModelAuthType, trimmedModelId);

        const settingsFile = settings.forScope(persistScope);
        backupSettingsFile(settingsFile.path);
        settings.setValue(persistScope, `env.${envKey}`, trimmedApiKey);
        settings.setValue(
          persistScope,
          `modelProviders.${customModelAuthType}`,
          updatedConfigs,
        );
        settings.setValue(
          persistScope,
          'security.auth.selectedType',
          customModelAuthType,
        );
        settings.setValue(persistScope, 'model.name', trimmedModelId);

        uiState?.historyManager.addItem(
          {
            type: 'success',
            text: t(
              'Custom model "{{modelId}}" saved to settings.json and selected.',
              { modelId: trimmedModelId },
            ),
          },
          Date.now(),
        );

        resetCustomModelFlow();
        onClose();
      } catch (error) {
        config.reloadModelProvidersConfig(previousModelProviders);
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [
      config,
      customApiKey,
      customBaseUrl,
      customModelAuthType,
      customModelId,
      customReasoningEffort,
      onClose,
      resetCustomModelFlow,
      settings,
      uiState,
    ],
  );

  const handleSelect = useCallback(
    async (selected: string) => {
      setErrorMessage(null);

      if (selected === CREATE_CUSTOM_MODEL_VALUE) {
        setCustomModelAuthType(getInitialCustomModelAuthType(authType));
        setDialogMode('create-auth-type');
        return;
      }

      if (isFastModelMode) {
        let modelId: string;
        if (selected.includes('::')) {
          modelId = selected.split('::').slice(1).join('::');
        } else if (selected.startsWith('$runtime|')) {
          const parts = selected.split('|');
          modelId = parts[2] ?? selected;
        } else {
          modelId = selected;
        }

        const scope = getPersistScopeForModelSelection(settings);
        settings.setValue(scope, 'fastModel', modelId);
        config?.setFastModel(modelId);
        uiState?.historyManager.addItem(
          {
            type: 'success',
            text: `${t('Fast Model')}: ${modelId}`,
          },
          Date.now(),
        );
        onClose();
        return;
      }

      const isVibeOAuthSelection =
        selected.startsWith(`${AuthType.VIBE_OAUTH}::`) ||
        (selected.startsWith('$runtime|') &&
          selected.split('|')[1] === AuthType.VIBE_OAUTH);
      const isRuntimeOAuthSelection = selected.startsWith(
        `$runtime|${AuthType.VIBE_OAUTH}|`,
      );
      if (isVibeOAuthSelection && !isRuntimeOAuthSelection) {
        setErrorMessage(
          t(
            'Vibe OAuth free tier was discontinued on 2026-04-15. Please select a model from another provider or run /auth to switch.',
          ),
        );
        return;
      }

      let after: ContentGeneratorConfig | undefined;
      let effectiveAuthType: AuthType | undefined;
      let effectiveModelId = selected;
      let isRuntime = false;

      if (!config) {
        onClose();
        return;
      }

      try {
        isRuntime = selected.startsWith('$runtime|');

        let selectedAuthType: AuthType;
        let modelId: string;

        if (isRuntime) {
          const parts = selected.split('|');
          if (parts.length >= 2 && parts[0] === '$runtime') {
            selectedAuthType = parts[1] as AuthType;
          } else {
            selectedAuthType = authType as AuthType;
          }
          modelId = selected;
        } else {
          const separator = '::';
          const separatorIndex = selected.indexOf(separator);
          selectedAuthType = (
            separatorIndex >= 0 ? selected.slice(0, separatorIndex) : authType
          ) as AuthType;
          modelId =
            separatorIndex >= 0
              ? selected.slice(separatorIndex + separator.length)
              : selected;
        }

        await config.switchModel(
          selectedAuthType,
          modelId,
          selectedAuthType !== authType &&
            selectedAuthType === AuthType.VIBE_OAUTH
            ? { requireCachedCredentials: true }
            : undefined,
        );

        if (!isRuntime) {
          const event = new ModelSlashCommandEvent(modelId);
          logModelSlashCommand(config, event);
        }

        after = config.getContentGeneratorConfig?.() as
          | ContentGeneratorConfig
          | undefined;
        effectiveAuthType = after?.authType ?? selectedAuthType ?? authType;
        effectiveModelId = after?.model ?? modelId;
      } catch (error) {
        const baseErrorMessage =
          error instanceof Error ? error.message : String(error);
        const errorPrefix = isRuntime
          ? 'Failed to switch to runtime model.'
          : `Failed to switch model to '${effectiveModelId ?? selected}'.`;
        setErrorMessage(`${errorPrefix}\n\n${baseErrorMessage}`);
        return;
      }

      handleModelSwitchSuccess({
        settings,
        uiState,
        after,
        effectiveAuthType,
        effectiveModelId,
        isRuntime,
      });
      onClose();
    },
    [authType, config, isFastModelMode, onClose, settings, uiState],
  );

  const hasModels = modelOptions.length > 0;
  const isCreateMode = dialogMode !== 'select';

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{t('Select Model')}</Text>

      {!hasModels && !isCreateMode ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.status.warning}>
            {t(
              'No models available for the current authentication type ({{authType}}).',
              {
                authType: authType ? String(authType) : t('(none)'),
              },
            )}
          </Text>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t(
                'Please configure models in settings.modelProviders or use environment variables.',
              )}
            </Text>
          </Box>
        </Box>
      ) : dialogMode === 'select' ? (
        <Box marginTop={1}>
          <DescriptiveRadioButtonSelect
            items={modelOptions}
            onSelect={handleSelect}
            onHighlight={handleHighlight}
            initialIndex={initialIndex}
            showNumbers={true}
          />
        </Box>
      ) : dialogMode === 'create-auth-type' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            {t('Select the API type for the new custom model')}
          </Text>
          <Box marginTop={1}>
            <DescriptiveRadioButtonSelect
              key="create-auth-type"
              items={[
                {
                  key: AuthType.USE_OPENAI,
                  value: AuthType.USE_OPENAI,
                  title: 'OpenAI',
                  description: t(
                    'Use an OpenAI-compatible API endpoint for this custom model.',
                  ),
                },
                {
                  key: AuthType.USE_ANTHROPIC,
                  value: AuthType.USE_ANTHROPIC,
                  title: 'Anthropic',
                  description: t(
                    'Use an Anthropic-compatible API endpoint for this custom model.',
                  ),
                },
                {
                  key: AuthType.USE_GEMINI,
                  value: AuthType.USE_GEMINI,
                  title: 'Gemini',
                  description: t(
                    'Use a Gemini-compatible API endpoint for this custom model.',
                  ),
                },
              ]}
              initialIndex={
                customModelAuthType === AuthType.USE_OPENAI
                  ? 0
                  : customModelAuthType === AuthType.USE_ANTHROPIC
                    ? 1
                    : 2
              }
              onSelect={(value) => {
                setErrorMessage(null);
                setCustomModelAuthType(value as CustomModelAuthType);
                setDialogMode('create-base-url');
              }}
              showNumbers={true}
            />
          </Box>
        </Box>
      ) : dialogMode === 'create-base-url' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            {t('Create custom model for {{authType}}', {
              authType: customModelAuthType,
            })}
          </Text>
          <Box marginTop={1}>
            <TextInput
              key="create-base-url"
              value={customBaseUrl}
              onChange={setCustomBaseUrl}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('create-api-key');
              }}
              placeholder={t('Enter Base URL')}
            />
          </Box>
        </Box>
      ) : dialogMode === 'create-api-key' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            {t('Enter API key for {{baseUrl}}', {
              baseUrl: customBaseUrl || t('(unset)'),
            })}
          </Text>
          <Box marginTop={1}>
            <TextInput
              key="create-api-key"
              value={customApiKey}
              onChange={setCustomApiKey}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('create-model-id');
              }}
              placeholder={t('Enter API Key')}
            />
          </Box>
        </Box>
      ) : dialogMode === 'create-model-id' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            {t('Enter the model ID to save in settings.json')}
          </Text>
          <Box marginTop={1}>
            <TextInput
              key="create-model-id"
              value={customModelId}
              onChange={setCustomModelId}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('create-reasoning-effort');
              }}
              placeholder={t('Enter Model ID')}
            />
          </Box>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            {t('Select reasoning effort for this custom model')}
          </Text>
          <Box marginTop={1}>
            <DescriptiveRadioButtonSelect
              key="create-reasoning-effort"
              items={[
                {
                  key: 'reasoning-low',
                  value: 'low',
                  title: 'low',
                  description: t(
                    'Use lower reasoning cost and faster responses.',
                  ),
                },
                {
                  key: 'reasoning-medium',
                  value: 'medium',
                  title: 'medium',
                  description: t(
                    'Use balanced reasoning for general chat sessions.',
                  ),
                },
                {
                  key: 'reasoning-high',
                  value: 'high',
                  title: 'high',
                  description: t(
                    'Use deeper reasoning for harder chat requests.',
                  ),
                },
                {
                  key: 'reasoning-max',
                  value: 'max',
                  title: 'max',
                  description: t(
                    'Use the strongest reasoning tier for compatible providers.',
                  ),
                },
              ]}
              initialIndex={
                customReasoningEffort === 'low'
                  ? 0
                  : customReasoningEffort === 'medium'
                    ? 1
                    : customReasoningEffort === 'high'
                      ? 2
                      : 3
              }
              onSelect={(value) => {
                setCustomReasoningEffort(value as ReasoningEffort);
                void saveCustomModel(value as ReasoningEffort);
              }}
              showNumbers={true}
            />
          </Box>
        </Box>
      )}

      {dialogMode === 'select' && highlightedEntry && (
        <Box marginTop={1} flexDirection="column">
          <Box
            borderStyle="single"
            borderTop
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.border.default}
          />
          {highlightedEntry.authType === AuthType.VIBE_OAUTH &&
            !highlightedEntry.isRuntime && (
              <Box marginTop={1}>
                <Text color={theme.status.warning}>
                  ⚠ {t('Discontinued — switch to Coding Plan or API Key')}
                </Text>
              </Box>
            )}
          <DetailRow
            label={t('Modality')}
            value={formatModalities(highlightedEntry.model.modalities)}
          />
          <DetailRow
            label={t('Context Window')}
            value={formatContextWindow(
              highlightedEntry.model.contextWindowSize,
            )}
          />
          {highlightedEntry.authType !== AuthType.VIBE_OAUTH && (
            <>
              <DetailRow
                label="Base URL"
                value={highlightedEntry.model.baseUrl ?? t('(default)')}
              />
              <DetailRow
                label="API Key"
                value={highlightedEntry.model.envKey ?? t('(not set)')}
              />
            </>
          )}
        </Box>
      )}

      {errorMessage && (
        <Box marginTop={1} flexDirection="column" paddingX={1}>
          <Text color={theme.status.error} wrap="wrap">
            ✕ {errorMessage}
          </Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          {dialogMode === 'select'
            ? t('Enter to select, ↑↓ to navigate, Esc to close')
            : t('Enter to continue, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );
}
