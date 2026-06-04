/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { AuthType } from '@vibe-bti/vibe-code-core';
import { Box, Text } from 'ink';
import Link from 'ink-link';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from '../components/shared/DescriptiveRadioButtonSelect.js';
import { TextInput } from '../components/shared/TextInput.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { t } from '../../i18n/index.js';
import {
  generateCustomApiKeyEnvKey,
  maskApiKey,
  normalizeCustomModelIds,
} from './useAuth.js';

const MODEL_PROVIDERS_DOCUMENTATION_URL =
  'https://vibelm.github.io/vibe-code-docs/en/users/configuration/model-providers/';

type CustomProtocol =
  | AuthType.USE_OPENAI
  | AuthType.USE_ANTHROPIC
  | AuthType.USE_GEMINI
  | AuthType.USE_GOOGLE_ADC;

type ViewLevel =
  | 'custom-protocol-select'
  | 'custom-base-url-input'
  | 'custom-api-key-input'
  | 'custom-model-id-input'
  | 'custom-advanced-config'
  | 'custom-review-json';

interface AuthDialogProps {
  startInApiKeyFlow?: boolean;
}

type BaseUrlOptionValue =
  | 'https://api.mistral.ai/v1'
  | 'https://api.openai.com/v1'
  | 'https://api.groq.com/openai/v1'
  | 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  | 'custom';

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): CustomProtocol | null {
  if (
    defaultAuthType === AuthType.USE_OPENAI ||
    defaultAuthType === AuthType.USE_ANTHROPIC ||
    defaultAuthType === AuthType.USE_GEMINI ||
    defaultAuthType === AuthType.USE_GOOGLE_ADC
  ) {
    return defaultAuthType as CustomProtocol;
  }
  return null;
}

function toCustomProtocol(
  authType: AuthType | undefined,
): CustomProtocol | null {
  if (
    authType === AuthType.USE_OPENAI ||
    authType === AuthType.USE_ANTHROPIC ||
    authType === AuthType.USE_GEMINI ||
    authType === AuthType.USE_GOOGLE_ADC
  ) {
    return authType as CustomProtocol;
  }
  return null;
}

const DEFAULT_CUSTOM_BASE_URLS: Record<CustomProtocol, string> = {
  [AuthType.USE_OPENAI]: 'https://api.openai.com/v1',
  [AuthType.USE_ANTHROPIC]: 'https://api.anthropic.com/v1',
  [AuthType.USE_GEMINI]: 'https://generativelanguage.googleapis.com',
  [AuthType.USE_GOOGLE_ADC]: 'https://generativelanguage.googleapis.com',
};

const CUSTOM_BASE_URL_OPTIONS: Array<{
  title: string;
  description: string;
  value: BaseUrlOptionValue;
}> = [
  {
    title: 'https://api.mistral.ai/v1',
    description: t('Mistral API'),
    value: 'https://api.mistral.ai/v1',
  },
  {
    title: 'https://api.openai.com/v1',
    description: t('OpenAI API'),
    value: 'https://api.openai.com/v1',
  },
  {
    title: 'https://api.groq.com/openai/v1',
    description: t('Groq OpenAI-compatible API'),
    value: 'https://api.groq.com/openai/v1',
  },
  {
    title: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    description: t('Alibaba DashScope compatible-mode API'),
    value: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  },
  {
    title: t('Custom'),
    description: t('Enter your own endpoint URL'),
    value: 'custom',
  },
];

export function AuthDialog(props: AuthDialogProps = {}): React.JSX.Element {
  return <AuthDialogWithMode {...props} />;
}

export function AuthDialogWithMode({
  startInApiKeyFlow = false,
}: AuthDialogProps = {}): React.JSX.Element {
  const { pendingAuthType, authError } = useUIState();
  const { handleAuthSelect, handleCustomApiKeySubmit, onAuthError } =
    useUIActions();
  const config = useConfig();

  const resolvedInitialProtocol: CustomProtocol =
    toCustomProtocol(pendingAuthType) ??
    toCustomProtocol(config.getAuthType()) ??
    parseDefaultAuthType(process.env['VIBE_DEFAULT_AUTH_TYPE']) ??
    AuthType.USE_OPENAI;

  const protocolItems = [
    {
      key: AuthType.USE_OPENAI,
      title: t('OpenAI-compatible'),
      label: t('OpenAI-compatible'),
      description: t(
        'OpenAI Chat Completions API (OpenRouter, vLLM, Ollama, LM Studio, Fireworks, etc.)',
      ),
      value: AuthType.USE_OPENAI as CustomProtocol,
    },
    {
      key: AuthType.USE_ANTHROPIC,
      title: t('Anthropic-compatible'),
      label: t('Anthropic-compatible'),
      description: t('Anthropic Messages API'),
      value: AuthType.USE_ANTHROPIC as CustomProtocol,
    },
    {
      key: AuthType.USE_GEMINI,
      title: t('Gemini-compatible'),
      label: t('Gemini-compatible'),
      description: t('Google Gemini API'),
      value: AuthType.USE_GEMINI as CustomProtocol,
    },
    {
      key: AuthType.USE_GOOGLE_ADC,
      title: t('Google Auth (ADC)'),
      label: t('Google Auth (ADC)'),
      description: t('Google Application Default Credentials for Gemini'),
      value: AuthType.USE_GOOGLE_ADC as CustomProtocol,
    },
  ];

  const initialProtocolIndex = Math.max(
    0,
    protocolItems.findIndex((item) => item.value === resolvedInitialProtocol),
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>(
    'custom-protocol-select',
  );
  const [customProtocol, setCustomProtocol] = useState<CustomProtocol>(
    resolvedInitialProtocol,
  );
  const [customBaseUrl, setCustomBaseUrl] = useState(
    DEFAULT_CUSTOM_BASE_URLS[resolvedInitialProtocol],
  );
  const [isCustomBaseUrlInput, setIsCustomBaseUrlInput] = useState(
    !CUSTOM_BASE_URL_OPTIONS.some(
      (option) =>
        option.value !== 'custom' &&
        option.value === DEFAULT_CUSTOM_BASE_URLS[resolvedInitialProtocol],
    ),
  );
  const [customBaseUrlError, setCustomBaseUrlError] = useState<string | null>(
    null,
  );
  const [customApiKey, setCustomApiKey] = useState('');
  const [customApiKeyError, setCustomApiKeyError] = useState<string | null>(
    null,
  );
  const [customModelIds, setCustomModelIds] = useState('');
  const [customModelIdsError, setCustomModelIdsError] = useState<string | null>(
    null,
  );
  const [advancedThinkingEnabled, setAdvancedThinkingEnabled] = useState(false);
  const [advancedModalityEnabled, setAdvancedModalityEnabled] = useState(false);
  const [focusedConfigIndex, setFocusedConfigIndex] = useState(0);

  const resetCustomFlowState = (protocol: CustomProtocol) => {
    const defaultBaseUrl = DEFAULT_CUSTOM_BASE_URLS[protocol];

    setCustomProtocol(protocol);
    setCustomBaseUrl(defaultBaseUrl);
    setIsCustomBaseUrlInput(
      !CUSTOM_BASE_URL_OPTIONS.some(
        (option) =>
          option.value !== 'custom' && option.value === defaultBaseUrl,
      ),
    );
    setCustomBaseUrlError(null);
    setCustomApiKey('');
    setCustomApiKeyError(null);
    setCustomModelIds('');
    setCustomModelIdsError(null);
    setAdvancedThinkingEnabled(false);
    setAdvancedModalityEnabled(false);
    setFocusedConfigIndex(0);
  };

  const handleCustomProtocolSelect = (protocol: CustomProtocol) => {
    setErrorMessage(null);
    onAuthError(null);
    if (protocol === AuthType.USE_GOOGLE_ADC) {
      void handleCustomApiKeySubmit(
        protocol,
        'https://generativelanguage.googleapis.com',
        '',
        'gemini-1.5-pro,gemini-2.5-pro',
      );
      return;
    }
    resetCustomFlowState(protocol);
    setViewLevel('custom-base-url-input');
  };

  const handleCustomBaseUrlSubmit = () => {
    const trimmedUrl = customBaseUrl.trim();
    if (!trimmedUrl) {
      setCustomBaseUrlError(t('Base URL cannot be empty.'));
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setCustomBaseUrlError(t('Base URL must start with http:// or https://.'));
      return;
    }
    setCustomBaseUrlError(null);
    setViewLevel('custom-api-key-input');
  };

  const handleCustomBaseUrlOptionSelect = (value: BaseUrlOptionValue) => {
    setErrorMessage(null);
    onAuthError(null);
    setCustomBaseUrlError(null);

    if (value === 'custom') {
      setIsCustomBaseUrlInput(true);
      return;
    }

    setCustomBaseUrl(value);
    setIsCustomBaseUrlInput(false);
    setViewLevel('custom-api-key-input');
  };

  const handleCustomApiKeySubmitLocal = () => {
    const trimmedKey = customApiKey.trim();
    if (!trimmedKey) {
      setCustomApiKeyError(t('API key cannot be empty.'));
      return;
    }
    setCustomApiKeyError(null);
    setViewLevel('custom-model-id-input');
  };

  const handleCustomModelIdSubmit = () => {
    const normalized = normalizeCustomModelIds(customModelIds);
    if (normalized.length === 0) {
      setCustomModelIdsError(t('Model IDs cannot be empty.'));
      return;
    }
    setCustomModelIdsError(null);
    setViewLevel('custom-advanced-config');
  };

  const handleCustomReviewSubmit = () => {
    const hasThinking = advancedThinkingEnabled;
    const hasModality = advancedModalityEnabled;
    const generationConfig =
      hasThinking || hasModality
        ? {
            enableThinking: hasThinking ? true : undefined,
            multimodal: hasModality
              ? { image: true, video: true, audio: true }
              : undefined,
          }
        : undefined;

    void handleCustomApiKeySubmit(
      customProtocol,
      customBaseUrl.trim(),
      customApiKey.trim(),
      customModelIds,
      generationConfig,
    );
  };

  const handleGoBack = () => {
    setErrorMessage(null);
    onAuthError(null);

    switch (viewLevel) {
      case 'custom-protocol-select':
        if (config.getAuthType() === undefined || startInApiKeyFlow) {
          setErrorMessage(
            t(
              'You must configure API authentication to proceed. Press Ctrl+C again to exit.',
            ),
          );
          return;
        }
        handleAuthSelect(undefined);
        return;
      case 'custom-base-url-input':
        if (isCustomBaseUrlInput) {
          const defaultBaseUrl = DEFAULT_CUSTOM_BASE_URLS[customProtocol];
          const hasRadioOption = CUSTOM_BASE_URL_OPTIONS.some(
            (option) =>
              option.value !== 'custom' && option.value === defaultBaseUrl,
          );
          if (!hasRadioOption) {
            setViewLevel('custom-protocol-select');
            return;
          }
          setIsCustomBaseUrlInput(false);
          return;
        }
        setViewLevel('custom-protocol-select');
        return;
      case 'custom-api-key-input':
        setViewLevel('custom-base-url-input');
        return;
      case 'custom-model-id-input':
        setViewLevel('custom-api-key-input');
        return;
      case 'custom-advanced-config':
        setViewLevel('custom-model-id-input');
        return;
      case 'custom-review-json':
        setViewLevel('custom-advanced-config');
        return;
      default:
        break;
    }
  };

  useKeypress(
    (key) => {
      if (key.name !== 'escape') return;
      if (errorMessage || authError) {
        if (errorMessage) setErrorMessage(null);
        if (authError) onAuthError(null);
        return;
      }
      handleGoBack();
    },
    { isActive: true },
  );

  useKeypress(
    (key) => {
      if (key.name === 'return' && viewLevel === 'custom-review-json') {
        handleCustomReviewSubmit();
      }
    },
    { isActive: true },
  );

  useKeypress(
    (key) => {
      if (viewLevel !== 'custom-advanced-config') return;

      if (key.name === 'up') {
        setFocusedConfigIndex((value) => (value <= 0 ? 1 : value - 1));
        return;
      }

      if (key.name === 'down') {
        setFocusedConfigIndex((value) => (value >= 1 ? 0 : value + 1));
        return;
      }

      if (key.name === 'space') {
        if (focusedConfigIndex === 0) {
          setAdvancedThinkingEnabled((value) => !value);
        } else {
          setAdvancedModalityEnabled((value) => !value);
        }
        return;
      }

      if (key.name === 'return') {
        setViewLevel('custom-review-json');
      }
    },
    { isActive: true },
  );

  const renderCustomProtocolSelectView = () => (
    <>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={protocolItems}
          initialIndex={initialProtocolIndex}
          onSelect={handleCustomProtocolSelect}
          onHighlight={resetCustomFlowState}
          itemGap={1}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to select, ↑↓ to navigate, Esc to go back')}
        </Text>
      </Box>
    </>
  );

  const renderCustomBaseUrlInputView = () => (
    <Box marginTop={1} flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {t('Enter the API endpoint for this protocol.')}
        </Text>
      </Box>
      {!isCustomBaseUrlInput ? (
        <Box marginTop={1}>
          <DescriptiveRadioButtonSelect
            items={CUSTOM_BASE_URL_OPTIONS.map((option) => ({
              key: option.value,
              title: option.title,
              label: option.title,
              description: option.description,
              value: option.value,
            }))}
            initialIndex={Math.max(
              0,
              CUSTOM_BASE_URL_OPTIONS.findIndex(
                (option) =>
                  option.value !== 'custom' && option.value === customBaseUrl,
              ),
            )}
            onSelect={handleCustomBaseUrlOptionSelect}
            itemGap={1}
          />
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <TextInput
              value={customBaseUrl}
              onChange={(value) => {
                setCustomBaseUrl(value);
                if (customBaseUrlError) setCustomBaseUrlError(null);
              }}
              onSubmit={handleCustomBaseUrlSubmit}
              placeholder="https://api.example.com/v1"
            />
          </Box>
        </Box>
      )}
      {customBaseUrlError && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{customBaseUrlError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Link url={MODEL_PROVIDERS_DOCUMENTATION_URL} fallback={false}>
          <Text color={theme.text.link}>
            {t(
              'Need advanced generationConfig or capabilities? See documentation',
            )}
          </Text>
        </Link>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {isCustomBaseUrlInput
            ? t('Enter to submit, Esc to go back')
            : t('Enter to select, ↑↓ to navigate, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );

  const renderCustomApiKeyInputView = () => (
    <Box marginTop={1} flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {t('Enter the API key for this endpoint.')}
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextInput
          value={customApiKey}
          onChange={(value) => {
            setCustomApiKey(value);
            if (customApiKeyError) setCustomApiKeyError(null);
          }}
          onSubmit={handleCustomApiKeySubmitLocal}
          placeholder="sk-..."
        />
      </Box>
      {customApiKeyError && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{customApiKeyError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to submit, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );

  const renderCustomModelIdInputView = () => (
    <Box marginTop={1} flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {t('Enter one or more model IDs, separated by commas.')}
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextInput
          value={customModelIds}
          onChange={(value) => {
            setCustomModelIds(value);
            if (customModelIdsError) setCustomModelIdsError(null);
          }}
          onSubmit={handleCustomModelIdSubmit}
          placeholder="vibe/vibe3-coder,openai/gpt-4.1"
        />
      </Box>
      {customModelIdsError && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{customModelIdsError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to submit, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );

  const renderCustomAdvancedConfigView = () => {
    const checkmark = (value: boolean) => (value ? '◉' : '○');
    const cursor = (index: number) =>
      focusedConfigIndex === index ? '›' : ' ';

    return (
      <Box marginTop={1} flexDirection="column">
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            {t('Optional: configure advanced generation settings.')}
          </Text>
        </Box>
        <Box marginTop={1} marginLeft={2}>
          <Text
            color={focusedConfigIndex === 0 ? theme.status.success : undefined}
          >
            {cursor(0)} {checkmark(advancedThinkingEnabled)}{' '}
            {t('Enable thinking')}
          </Text>
        </Box>
        <Box marginTop={0} marginLeft={4}>
          <Text color={theme.text.secondary}>
            {t(
              'Allows the model to perform extended reasoning before responding.',
            )}
          </Text>
        </Box>
        <Box marginTop={1} marginLeft={2}>
          <Text
            color={focusedConfigIndex === 1 ? theme.status.success : undefined}
          >
            {cursor(1)} {checkmark(advancedModalityEnabled)}{' '}
            {t('Enable modality')}
          </Text>
        </Box>
        <Box marginTop={0} marginLeft={4}>
          <Text color={theme.text.secondary}>
            {t('Enables image, video, and audio input/output capabilities.')}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            {t(
              '↑↓ to navigate, Space to toggle, Enter to continue, Esc to go back',
            )}
          </Text>
        </Box>
      </Box>
    );
  };

  const renderCustomReviewJsonView = () => {
    const generatedEnvKey = generateCustomApiKeyEnvKey(
      customProtocol,
      customBaseUrl.trim(),
    );
    const normalizedIds = normalizeCustomModelIds(customModelIds);
    const maskedKey = maskApiKey(customApiKey);

    const generationConfig =
      advancedThinkingEnabled || advancedModalityEnabled
        ? {
            ...(advancedModalityEnabled
              ? {
                  modalities: {
                    image: true,
                    video: true,
                    audio: true,
                  },
                }
              : {}),
            ...(advancedThinkingEnabled
              ? {
                  extra_body: {
                    enable_thinking: true,
                  },
                }
              : {}),
          }
        : undefined;

    const modelEntries = normalizedIds.map((id) => ({
      id,
      name: id,
      baseUrl: customBaseUrl.trim(),
      envKey: generatedEnvKey,
      ...(generationConfig ? { generationConfig } : {}),
    }));

    const preview = {
      env: { [generatedEnvKey]: maskedKey },
      modelProviders: {
        [customProtocol]: modelEntries,
      },
      security: {
        auth: {
          selectedType: customProtocol,
        },
      },
      model: {
        name: normalizedIds[0],
      },
    };

    return (
      <Box marginTop={1} flexDirection="column">
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            {t('The following JSON will be saved to settings.json:')}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>{JSON.stringify(preview, null, 2)}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            {t('Enter to save, Esc to go back')}
          </Text>
        </Box>
      </Box>
    );
  };

  const getViewTitle = () => {
    switch (viewLevel) {
      case 'custom-protocol-select':
        return t('Select Custom API Protocol');
      case 'custom-base-url-input':
        return t('Step 2/6 · Base URL');
      case 'custom-api-key-input':
        return t('Step 3/6 · API Key');
      case 'custom-model-id-input':
        return t('Step 4/6 · Model IDs');
      case 'custom-advanced-config':
        return t('Step 5/6 · Advanced Config');
      case 'custom-review-json':
        return t('Step 6/6 · Review');
      default:
        return '';
    }
  };

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{getViewTitle()}</Text>

      {viewLevel === 'custom-protocol-select' &&
        renderCustomProtocolSelectView()}
      {viewLevel === 'custom-base-url-input' && renderCustomBaseUrlInputView()}
      {viewLevel === 'custom-api-key-input' && renderCustomApiKeyInputView()}
      {viewLevel === 'custom-model-id-input' && renderCustomModelIdInputView()}
      {viewLevel === 'custom-advanced-config' &&
        renderCustomAdvancedConfigView()}
      {viewLevel === 'custom-review-json' && renderCustomReviewJsonView()}

      {(authError || errorMessage) && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{authError || errorMessage}</Text>
        </Box>
      )}

      {viewLevel === 'custom-protocol-select' && (
        <>
          <Box marginY={1}>
            <Text color={theme.border.default}>{'─'.repeat(80)}</Text>
          </Box>
          <Box>
            <Text color={theme.text.primary}>
              {t('Terms of Services and Privacy Notice')}:
            </Text>
          </Box>
          <Box>
            <Link
              url="https://vibelm.github.io/vibe-code-docs/en/users/support/tos-privacy/"
              fallback={false}
            >
              <Text color={theme.text.secondary} underline>
                https://vibelm.github.io/vibe-code-docs/en/users/support/tos-privacy/
              </Text>
            </Link>
          </Box>
        </>
      )}
    </Box>
  );
}
