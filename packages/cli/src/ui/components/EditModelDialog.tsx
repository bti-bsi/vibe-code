/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  AuthType,
  type ModelProvidersConfig,
  type ProviderModelConfig,
} from '@vibe-bti/vibe-code-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { TextInput } from './shared/TextInput.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { UIStateContext } from '../contexts/UIStateContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import { backupSettingsFile } from '../../utils/settingsUtils.js';
import { t } from '../../i18n/index.js';

type CustomModelAuthType =
  | AuthType.USE_OPENAI
  | AuthType.USE_ANTHROPIC
  | AuthType.USE_GEMINI;

type ReasoningEffort = 'low' | 'medium' | 'high' | 'max';

type DialogMode =
  | 'select-model'
  | 'edit-auth-type'
  | 'edit-base-url'
  | 'edit-api-key'
  | 'edit-model-id'
  | 'edit-model-name'
  | 'edit-reasoning-effort';

interface EditModelDialogProps {
  onClose: () => void;
}

interface EditableModelEntry {
  authType: CustomModelAuthType;
  config: ProviderModelConfig;
  envValue: string;
  key: string;
}

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
  return `QWEN_CUSTOM_MODEL_API_KEY_${normalizeConfigToken(authType)}_${normalizeConfigToken(baseUrl)}`;
}

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return `(${t('not set')})`;
  if (trimmed.length <= 6) return '***';
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

function getReasoningEffort(config: ProviderModelConfig): ReasoningEffort {
  const effort = config.generationConfig?.reasoning;
  if (effort && typeof effort === 'object' && effort.effort) {
    return effort.effort;
  }
  return 'medium';
}

function getEditableEntries(
  modelProviders: ModelProvidersConfig | undefined,
  mergedEnv: Record<string, unknown> | undefined,
): EditableModelEntry[] {
  const authTypes: CustomModelAuthType[] = [
    AuthType.USE_OPENAI,
    AuthType.USE_ANTHROPIC,
    AuthType.USE_GEMINI,
  ];
  const entries: EditableModelEntry[] = [];

  for (const authType of authTypes) {
    for (const [index, config] of (modelProviders?.[authType] ?? []).entries()) {
      const envValue =
        typeof config.envKey === 'string' &&
        typeof mergedEnv?.[config.envKey] === 'string'
          ? (mergedEnv[config.envKey] as string)
          : '';
      entries.push({
        authType,
        config,
        envValue,
        key: `${authType}::${config.id}::${config.envKey ?? ''}::${index}`,
      });
    }
  }

  return entries;
}

function isSameModelEntry(
  left: ProviderModelConfig,
  right: ProviderModelConfig,
): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.baseUrl === right.baseUrl &&
    left.envKey === right.envKey
  );
}

export function EditModelDialog({
  onClose,
}: EditModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const uiState = useContext(UIStateContext);
  const settings = useSettings();

  const [dialogMode, setDialogMode] = useState<DialogMode>('select-model');
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customModelAuthType, setCustomModelAuthType] =
    useState<CustomModelAuthType>(AuthType.USE_OPENAI);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [customReasoningEffort, setCustomReasoningEffort] =
    useState<ReasoningEffort>('medium');

  const editableEntries = useMemo(
    () =>
      getEditableEntries(
        settings.merged.modelProviders as ModelProvidersConfig | undefined,
        settings.merged.env as Record<string, unknown> | undefined,
      ),
    [settings.merged.env, settings.merged.modelProviders],
  );

  const selectedEntry = useMemo(
    () => editableEntries.find((entry) => entry.key === selectedEntryKey) ?? null,
    [editableEntries, selectedEntryKey],
  );

  const resetState = useCallback(() => {
    setDialogMode('select-model');
    setSelectedEntryKey(null);
    setErrorMessage(null);
    setCustomModelAuthType(AuthType.USE_OPENAI);
    setCustomBaseUrl('');
    setCustomApiKey('');
    setCustomModelId('');
    setCustomModelName('');
    setCustomReasoningEffort('medium');
  }, []);

  const populateFromEntry = useCallback((entry: EditableModelEntry) => {
    setSelectedEntryKey(entry.key);
    setCustomModelAuthType(entry.authType);
    setCustomBaseUrl(entry.config.baseUrl ?? '');
    setCustomApiKey(entry.envValue);
    setCustomModelId(entry.config.id);
    setCustomModelName(entry.config.name ?? entry.config.id);
    setCustomReasoningEffort(getReasoningEffort(entry.config));
  }, []);

  useKeypress(
    (key) => {
      if (key.name !== 'escape') {
        return;
      }
      if (dialogMode === 'select-model') {
        onClose();
        return;
      }
      setErrorMessage(null);
      switch (dialogMode) {
        case 'edit-auth-type':
          setDialogMode('select-model');
          return;
        case 'edit-base-url':
          setDialogMode('edit-auth-type');
          return;
        case 'edit-api-key':
          setDialogMode('edit-base-url');
          return;
        case 'edit-model-id':
          setDialogMode('edit-api-key');
          return;
        case 'edit-model-name':
          setDialogMode('edit-model-id');
          return;
        case 'edit-reasoning-effort':
          setDialogMode('edit-model-name');
          return;
        default:
          return;
      }
    },
    { isActive: true },
  );

  const saveEditedModel = useCallback(async (reasoningOverride?: ReasoningEffort) => {
    if (!config || !selectedEntry) {
      return;
    }

    const trimmedBaseUrl = customBaseUrl.trim();
    const trimmedApiKey = customApiKey.trim();
    const trimmedModelId = customModelId.trim();
    const trimmedModelName = customModelName.trim();
    const effectiveReasoningEffort =
      reasoningOverride ?? customReasoningEffort;

    if (!trimmedBaseUrl) {
      setErrorMessage(t('Base URL cannot be empty.'));
      setDialogMode('edit-base-url');
      return;
    }
    if (!/^https?:\/\//i.test(trimmedBaseUrl)) {
      setErrorMessage(t('Base URL must start with http:// or https://.'));
      setDialogMode('edit-base-url');
      return;
    }
    if (!trimmedApiKey) {
      setErrorMessage(t('API key cannot be empty.'));
      setDialogMode('edit-api-key');
      return;
    }
    if (!trimmedModelId) {
      setErrorMessage(t('Model ID cannot be empty.'));
      setDialogMode('edit-model-id');
      return;
    }
    if (!trimmedModelName) {
      setErrorMessage(t('Model name cannot be empty.'));
      setDialogMode('edit-model-name');
      return;
    }

    const persistScope = getPersistScopeForModelSelection(settings);
    const previousModelProviders = settings.merged
      .modelProviders as ModelProvidersConfig | undefined;
    const previousEnvValue =
      selectedEntry.config.envKey &&
      typeof process.env[selectedEntry.config.envKey] === 'string'
        ? process.env[selectedEntry.config.envKey]
        : undefined;
    const previousTargetEnvValue =
      typeof process.env[
        generateCustomModelEnvKey(customModelAuthType, trimmedBaseUrl)
      ] === 'string'
        ? process.env[generateCustomModelEnvKey(customModelAuthType, trimmedBaseUrl)]
        : undefined;

    const nextEnvKey = generateCustomModelEnvKey(customModelAuthType, trimmedBaseUrl);
    const oldEnvKey = selectedEntry.config.envKey;
    const previousGenerationConfig = selectedEntry.config.generationConfig ?? {};
    const nextConfig: ProviderModelConfig = {
      ...selectedEntry.config,
      id: trimmedModelId,
      name: trimmedModelName,
      baseUrl: trimmedBaseUrl,
      envKey: nextEnvKey,
      generationConfig: {
        ...previousGenerationConfig,
        reasoning: { effort: effectiveReasoningEffort },
      },
    };

    const nextModelProviders: ModelProvidersConfig = {
      ...(previousModelProviders ?? {}),
    };
    const sourceEntries = (previousModelProviders?.[selectedEntry.authType] ?? []).filter(
      (entry) => !isSameModelEntry(entry, selectedEntry.config),
    );
    const targetEntries = [
      ...(selectedEntry.authType === customModelAuthType
        ? sourceEntries
        : previousModelProviders?.[customModelAuthType] ?? []
      ).filter((entry) => entry.id !== trimmedModelId),
      nextConfig,
    ];

    nextModelProviders[selectedEntry.authType] = sourceEntries;
    nextModelProviders[customModelAuthType] = targetEntries;

    process.env[nextEnvKey] = trimmedApiKey;
    if (oldEnvKey && oldEnvKey !== nextEnvKey) {
      delete process.env[oldEnvKey];
    }
    config.reloadModelProvidersConfig(nextModelProviders);

    try {
      await config.switchModel(customModelAuthType, trimmedModelId);

      const settingsFile = settings.forScope(persistScope);
      backupSettingsFile(settingsFile.path);
      if (oldEnvKey && oldEnvKey !== nextEnvKey) {
        settings.setValue(persistScope, `env.${oldEnvKey}`, undefined);
      }
      settings.setValue(persistScope, `env.${nextEnvKey}`, trimmedApiKey);
      settings.setValue(
        persistScope,
        `modelProviders.${selectedEntry.authType}`,
        sourceEntries,
      );
      settings.setValue(
        persistScope,
        `modelProviders.${customModelAuthType}`,
        targetEntries,
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
            'Model "{{modelId}}" updated in settings.json and selected.',
            { modelId: trimmedModelId },
          ),
        },
        Date.now(),
      );

      resetState();
      onClose();
    } catch (error) {
      config.reloadModelProvidersConfig(previousModelProviders);
      if (oldEnvKey) {
        if (previousEnvValue !== undefined) {
          process.env[oldEnvKey] = previousEnvValue;
        } else if (oldEnvKey !== nextEnvKey) {
          delete process.env[oldEnvKey];
        }
      }
      if (previousTargetEnvValue !== undefined) {
        process.env[nextEnvKey] = previousTargetEnvValue;
      } else if (nextEnvKey !== oldEnvKey) {
        delete process.env[nextEnvKey];
      }
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, [
    config,
    customApiKey,
    customBaseUrl,
    customModelAuthType,
    customModelId,
    customModelName,
    customReasoningEffort,
    onClose,
    resetState,
    selectedEntry,
    settings,
    uiState,
  ]);

  const selectItems = useMemo(
    () =>
      editableEntries.map((entry) => ({
        key: entry.key,
        value: entry.key,
        title: (
          <Text>
            <Text color={theme.text.accent}>[{entry.authType}]</Text>
            <Text>{` ${entry.config.name ?? entry.config.id}`}</Text>
          </Text>
        ),
        description: `${entry.config.id} · ${entry.config.baseUrl ?? t('(default)')} · ${maskApiKey(entry.envValue)}`,
      })),
    [editableEntries],
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{t('Edit Model')}</Text>

      {dialogMode === 'select-model' ? (
        editableEntries.length === 0 ? (
          <Box marginTop={1} flexDirection="column">
            <Text color={theme.status.warning}>
              {t('No editable model configurations were found in settings.json.')}
            </Text>
          </Box>
        ) : (
          <Box marginTop={1}>
            <DescriptiveRadioButtonSelect
              items={selectItems}
              onSelect={(value) => {
                const entry = editableEntries.find((item) => item.key === value);
                if (!entry) {
                  return;
                }
                setErrorMessage(null);
                populateFromEntry(entry);
                setDialogMode('edit-auth-type');
              }}
              showNumbers={true}
            />
          </Box>
        )
      ) : dialogMode === 'edit-auth-type' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            {t('Edit API type for {{modelName}}', {
              modelName: selectedEntry?.config.name ?? selectedEntry?.config.id ?? '',
            })}
          </Text>
          <Box marginTop={1}>
            <DescriptiveRadioButtonSelect
              key="edit-auth-type"
              items={[
                {
                  key: AuthType.USE_OPENAI,
                  value: AuthType.USE_OPENAI,
                  title: 'OpenAI',
                  description: t('Use an OpenAI-compatible API endpoint.'),
                },
                {
                  key: AuthType.USE_ANTHROPIC,
                  value: AuthType.USE_ANTHROPIC,
                  title: 'Anthropic',
                  description: t('Use an Anthropic-compatible API endpoint.'),
                },
                {
                  key: AuthType.USE_GEMINI,
                  value: AuthType.USE_GEMINI,
                  title: 'Gemini',
                  description: t('Use a Gemini-compatible API endpoint.'),
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
                setDialogMode('edit-base-url');
              }}
              showNumbers={true}
            />
          </Box>
        </Box>
      ) : dialogMode === 'edit-base-url' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('Edit Base URL')}</Text>
          <Box marginTop={1}>
            <TextInput
              key="edit-base-url"
              value={customBaseUrl}
              onChange={setCustomBaseUrl}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('edit-api-key');
              }}
              placeholder={t('Enter Base URL')}
            />
          </Box>
        </Box>
      ) : dialogMode === 'edit-api-key' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('Edit API Key')}</Text>
          <Box marginTop={1}>
            <TextInput
              key="edit-api-key"
              value={customApiKey}
              onChange={setCustomApiKey}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('edit-model-id');
              }}
              placeholder={t('Enter API Key')}
            />
          </Box>
        </Box>
      ) : dialogMode === 'edit-model-id' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('Edit Model ID')}</Text>
          <Box marginTop={1}>
            <TextInput
              key="edit-model-id"
              value={customModelId}
              onChange={setCustomModelId}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('edit-model-name');
              }}
              placeholder={t('Enter Model ID')}
            />
          </Box>
        </Box>
      ) : dialogMode === 'edit-model-name' ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('Edit Model Name')}</Text>
          <Box marginTop={1}>
            <TextInput
              key="edit-model-name"
              value={customModelName}
              onChange={setCustomModelName}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('edit-reasoning-effort');
              }}
              placeholder={t('Enter Model Name')}
            />
          </Box>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('Edit reasoning effort')}</Text>
          <Box marginTop={1}>
            <DescriptiveRadioButtonSelect
              key="edit-reasoning-effort"
              items={[
                {
                  key: 'reasoning-low',
                  value: 'low',
                  title: 'low',
                  description: t('Use lower reasoning cost and faster responses.'),
                },
                {
                  key: 'reasoning-medium',
                  value: 'medium',
                  title: 'medium',
                  description: t('Use balanced reasoning for general chat sessions.'),
                },
                {
                  key: 'reasoning-high',
                  value: 'high',
                  title: 'high',
                  description: t('Use deeper reasoning for harder chat requests.'),
                },
                {
                  key: 'reasoning-max',
                  value: 'max',
                  title: 'max',
                  description: t('Use the strongest reasoning tier for compatible providers.'),
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
                void saveEditedModel(value as ReasoningEffort);
              }}
              showNumbers={true}
            />
          </Box>
        </Box>
      )}

      {errorMessage && (
        <Box marginTop={1} paddingX={1}>
          <Text color={theme.status.error}>✕ {errorMessage}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {dialogMode === 'select-model'
            ? t('Enter to select, ↑↓ to navigate, Esc to close')
            : t('Enter to continue, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );
}
