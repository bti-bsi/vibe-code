/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelDialog } from './ModelDialog.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { TextInput } from './shared/TextInput.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import type { Config } from '@vibe-bti/vibe-code-core';
import { AuthType, DEFAULT_QWEN_MODEL } from '@vibe-bti/vibe-code-core';
import type { LoadedSettings } from '../../config/settings.js';
import { SettingScope } from '../../config/settings.js';
import { getFilteredQwenModels } from '../models/availableModels.js';

vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));
const mockedUseKeypress = vi.mocked(useKeypress);

vi.mock('./shared/DescriptiveRadioButtonSelect.js', () => ({
  DescriptiveRadioButtonSelect: vi.fn(() => null),
}));
vi.mock('./shared/TextInput.js', () => ({
  TextInput: vi.fn(() => null),
}));
vi.mock('../../utils/settingsUtils.js', () => ({
  backupSettingsFile: vi.fn(),
}));

// Helper to create getAvailableModelsForAuthType mock
const createMockGetAvailableModelsForAuthType = () =>
  vi.fn((t: AuthType) => {
    if (t === AuthType.QWEN_OAUTH) {
      return getFilteredQwenModels().map((m) => ({
        id: m.id,
        label: m.label,
        authType: AuthType.QWEN_OAUTH,
      }));
    }
    return [];
  });
const mockedSelect = vi.mocked(DescriptiveRadioButtonSelect);
const mockedTextInput = vi.mocked(TextInput);

const renderComponent = (
  props: Partial<React.ComponentProps<typeof ModelDialog>> = {},
  contextValue: Partial<Config> | undefined = undefined,
) => {
  const defaultProps = {
    onClose: vi.fn(),
  };
  const combinedProps = { ...defaultProps, ...props };

  const mockSettings = {
    isTrusted: true,
    user: { settings: {} },
    workspace: { settings: {} },
    setValue: vi.fn(),
    forScope: vi.fn(() => ({ path: '/mock/.qwen/settings.json' })),
    merged: {},
  } as unknown as LoadedSettings;

  const mockConfig = {
    // --- Functions used by ModelDialog ---
    getModel: vi.fn(() => DEFAULT_QWEN_MODEL),
    setModel: vi.fn().mockResolvedValue(undefined),
    switchModel: vi.fn().mockResolvedValue(undefined),
    getAuthType: vi.fn(() => 'qwen-oauth'),
    getAllConfiguredModels: vi.fn(() =>
      getFilteredQwenModels().map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description || '',
        authType: AuthType.QWEN_OAUTH,
      })),
    ),

    // --- Functions used by ClearcutLogger ---
    getUsageStatisticsEnabled: vi.fn(() => true),
    getSessionId: vi.fn(() => 'mock-session-id'),
    getDebugMode: vi.fn(() => false),
    getContentGeneratorConfig: vi.fn(() => ({
      authType: AuthType.QWEN_OAUTH,
      model: DEFAULT_QWEN_MODEL,
    })),
    reloadModelProvidersConfig: vi.fn(),
    getUseModelRouter: vi.fn(() => false),
    getProxy: vi.fn(() => undefined),

    // --- Spread test-specific overrides ---
    ...(contextValue ?? {}),
  } as unknown as Config;

  const renderResult = render(
    <SettingsContext.Provider value={mockSettings}>
      <ConfigContext.Provider value={mockConfig}>
        <ModelDialog {...combinedProps} />
      </ConfigContext.Provider>
    </SettingsContext.Provider>,
  );

  return {
    ...renderResult,
    props: combinedProps,
    mockConfig,
    mockSettings,
  };
};

describe('<ModelDialog />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure env-based fallback models don't leak into this suite from the developer environment.
    delete process.env['OPENAI_MODEL'];
    delete process.env['ANTHROPIC_MODEL'];
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the title', () => {
    const { getByText } = renderComponent();
    expect(getByText('Select Model')).toBeDefined();
  });

  it('passes all model options to DescriptiveRadioButtonSelect', () => {
    renderComponent();
    expect(mockedSelect).toHaveBeenCalledTimes(1);

    const props = mockedSelect.mock.calls[0][0];
    expect(props.items).toHaveLength(getFilteredQwenModels().length + 1);
    expect(props.items[0].value).toBe('__create_custom_model__');
    // coder-model is the only model and it has vision capability
    expect(props.items[1].value).toBe(
      `${AuthType.QWEN_OAUTH}::${DEFAULT_QWEN_MODEL}`,
    );
    expect(props.showNumbers).toBe(true);
  });

  it('initializes with the model from ConfigContext', () => {
    const mockGetModel = vi.fn(() => DEFAULT_QWEN_MODEL);
    renderComponent(
      {},
      {
        getModel: mockGetModel,
        getAvailableModelsForAuthType:
          createMockGetAvailableModelsForAuthType(),
      },
    );

    expect(mockGetModel).toHaveBeenCalled();
    // Calculate expected index dynamically based on model list
    const qwenModels = getFilteredQwenModels();
    const expectedIndex = qwenModels.findIndex(
      (m) => m.id === DEFAULT_QWEN_MODEL,
    );
    expect(mockedSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialIndex: expectedIndex + 1,
      }),
      undefined,
    );
  });

  it('initializes with default coder model if context is not provided', () => {
    renderComponent({}, undefined);

    expect(mockedSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialIndex: 1,
      }),
      undefined,
    );
  });

  it('initializes with default coder model if getModel returns undefined', () => {
    const mockGetModel = vi.fn(() => undefined as unknown as string);
    renderComponent(
      {},
      {
        getModel: mockGetModel,
        getAvailableModelsForAuthType:
          createMockGetAvailableModelsForAuthType(),
      },
    );

    expect(mockGetModel).toHaveBeenCalled();

    // When getModel returns undefined, preferredModel falls back to DEFAULT_QWEN_MODEL
    // which has index 0, so initialIndex should be 0
    expect(mockedSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialIndex: 0,
      }),
      undefined,
    );
    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });

  it('blocks qwen-oauth model selection with an error message (discontinued)', async () => {
    const { props, mockConfig } = renderComponent(
      {},
      {
        getAvailableModelsForAuthType: vi.fn((t: AuthType) => {
          if (t === AuthType.QWEN_OAUTH) {
            return getFilteredQwenModels().map((m) => ({
              id: m.id,
              label: m.label,
              authType: AuthType.QWEN_OAUTH,
            }));
          }
          return [];
        }),
      },
    );

    const childOnSelect = mockedSelect.mock.calls[0][0].onSelect;
    expect(childOnSelect).toBeDefined();

    await childOnSelect(`${AuthType.QWEN_OAUTH}::${DEFAULT_QWEN_MODEL}`);

    // qwen-oauth is discontinued — switchModel should NOT be called
    expect(mockConfig?.switchModel).not.toHaveBeenCalled();
    // Dialog should NOT close (user stays in the dialog to see the error)
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('calls config.switchModel and onClose when selecting a non-OAuth model', async () => {
    const switchModel = vi.fn().mockResolvedValue(undefined);
    const getAuthType = vi.fn(() => AuthType.USE_OPENAI);
    const getAvailableModelsForAuthType = vi.fn((t: AuthType) => {
      if (t === AuthType.USE_OPENAI) {
        return [{ id: 'gpt-4', label: 'GPT-4', authType: t }];
      }
      if (t === AuthType.QWEN_OAUTH) {
        return getFilteredQwenModels().map((m) => ({
          id: m.id,
          label: m.label,
          authType: AuthType.QWEN_OAUTH,
        }));
      }
      return [];
    });

    const { props, mockSettings } = renderComponent({}, {
      getModel: vi.fn(() => 'gpt-4'),
      getAuthType,
      switchModel,
      getAvailableModelsForAuthType,
      getAllConfiguredModels: vi.fn(() => [
        ...getFilteredQwenModels().map((m) => ({
          id: m.id,
          label: m.label,
          description: m.description || '',
          authType: AuthType.QWEN_OAUTH,
        })),
        {
          id: 'gpt-4',
          label: 'GPT-4',
          description: 'GPT-4 model',
          authType: AuthType.USE_OPENAI,
        },
      ]),
      getContentGeneratorConfig: vi.fn(() => ({
        authType: AuthType.USE_OPENAI,
        model: 'gpt-4',
      })),
    } as unknown as Partial<Config>);

    const childOnSelect = mockedSelect.mock.calls[0][0].onSelect;
    expect(childOnSelect).toBeDefined();

    // Select a non-OAuth model (USE_OPENAI)
    await childOnSelect(`${AuthType.USE_OPENAI}::gpt-4`);

    expect(switchModel).toHaveBeenCalledWith(
      AuthType.USE_OPENAI,
      'gpt-4',
      undefined,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'model.name',
      'gpt-4',
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.USE_OPENAI,
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks switching to qwen-oauth from another authType (discontinued)', async () => {
    const switchModel = vi.fn().mockResolvedValue(undefined);
    const getAuthType = vi.fn(() => AuthType.USE_OPENAI);
    const getAvailableModelsForAuthType = vi.fn((t: AuthType) => {
      if (t === AuthType.USE_OPENAI) {
        return [{ id: 'gpt-4', label: 'GPT-4', authType: t }];
      }
      if (t === AuthType.QWEN_OAUTH) {
        return getFilteredQwenModels().map((m) => ({
          id: m.id,
          label: m.label,
          authType: AuthType.QWEN_OAUTH,
        }));
      }
      return [];
    });

    const mockConfigWithSwitchAuthType = {
      getAuthType,
      getModel: vi.fn(() => 'gpt-4'),
      getContentGeneratorConfig: vi.fn(() => ({
        authType: AuthType.USE_OPENAI,
        model: 'gpt-4',
      })),
      switchModel,
      getAvailableModelsForAuthType,
    };

    const { props } = renderComponent(
      {},
      mockConfigWithSwitchAuthType as unknown as Partial<Config>,
    );

    const childOnSelect = mockedSelect.mock.calls[0][0].onSelect;
    await childOnSelect(`${AuthType.QWEN_OAUTH}::${DEFAULT_QWEN_MODEL}`);

    // qwen-oauth is discontinued — switchModel should NOT be called
    expect(switchModel).not.toHaveBeenCalled();
    // Dialog should NOT close
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('passes onHighlight to DescriptiveRadioButtonSelect', () => {
    renderComponent();

    const childOnHighlight = mockedSelect.mock.calls[0][0].onHighlight;
    expect(childOnHighlight).toBeDefined();
    expect(typeof childOnHighlight).toBe('function');
  });

  it('creates and saves a custom model from the model dialog', async () => {
    const switchModel = vi.fn().mockResolvedValue(undefined);
    const reloadModelProvidersConfig = vi.fn();
    const { mockConfig, mockSettings, props } = renderComponent(
      {},
      {
        getAuthType: vi.fn(() => AuthType.USE_OPENAI),
        getModel: vi.fn(() => 'gpt-4'),
        switchModel,
        reloadModelProvidersConfig,
        getAllConfiguredModels: vi.fn(() => [
          {
            id: 'gpt-4',
            label: 'GPT-4',
            description: 'GPT-4 model',
            authType: AuthType.USE_OPENAI,
          },
        ]),
        getContentGeneratorConfig: vi.fn(() => ({
          authType: AuthType.USE_OPENAI,
          model: 'gpt-4',
        })),
      } as unknown as Partial<Config>,
    );

    const selectInitial = mockedSelect.mock.calls[0][0];
    await act(async () => {
      await selectInitial.onSelect('__create_custom_model__');
    });

    const authTypeSelect = mockedSelect.mock.calls.at(-1)?.[0];
    await act(async () => {
      await authTypeSelect?.onSelect(AuthType.USE_OPENAI);
    });

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange(
        'https://api.example.com/v1',
      );
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange('secret-key');
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange('custom-model');
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    const reasoningSelect = mockedSelect.mock.calls.at(-1)?.[0];
    await act(async () => {
      await reasoningSelect?.onSelect('high');
    });

    expect(reloadModelProvidersConfig).toHaveBeenCalled();
    expect(switchModel).toHaveBeenCalledWith(
      AuthType.USE_OPENAI,
      'custom-model',
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'model.name',
      'custom-model',
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.USE_OPENAI,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'modelProviders.openai',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'custom-model',
          baseUrl: 'https://api.example.com/v1',
          generationConfig: {
            useStreaming: true,
            reasoning: { effort: 'high' },
          },
        }),
      ]),
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      expect.stringMatching(/^env\.QWEN_CUSTOM_MODEL_API_KEY_OPENAI_/),
      'secret-key',
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(mockConfig).toBeDefined();
  });

  it('remounts each custom-model text input with a clean displayed value between steps', async () => {
    renderComponent(
      {},
      {
        getAuthType: vi.fn(() => AuthType.USE_OPENAI),
        getModel: vi.fn(() => 'gpt-4'),
        getAllConfiguredModels: vi.fn(() => [
          {
            id: 'gpt-4',
            label: 'GPT-4',
            description: 'GPT-4 model',
            authType: AuthType.USE_OPENAI,
          },
        ]),
      } as unknown as Partial<Config>,
    );

    const selectInitial = mockedSelect.mock.calls[0][0];
    await act(async () => {
      await selectInitial.onSelect('__create_custom_model__');
    });

    const authTypeSelect = mockedSelect.mock.calls.at(-1)?.[0];
    await act(async () => {
      await authTypeSelect?.onSelect(AuthType.USE_OPENAI);
    });

    expect(mockedTextInput.mock.calls.at(-1)?.[0].value).toBe('');

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange(
        'https://api.example.com/v1',
      );
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    expect(mockedTextInput.mock.calls.at(-1)?.[0].value).toBe('');

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange('secret-key');
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    expect(mockedTextInput.mock.calls.at(-1)?.[0].value).toBe('');
  });

  it('calls onClose prop when "escape" key is pressed', () => {
    const { props } = renderComponent();

    expect(mockedUseKeypress).toHaveBeenCalled();

    const keyPressHandler = mockedUseKeypress.mock.calls[0][0];
    const options = mockedUseKeypress.mock.calls[0][1];

    expect(options).toEqual({ isActive: true });

    keyPressHandler({
      name: 'escape',
      ctrl: false,
      meta: false,
      shift: false,
      paste: false,
      sequence: '',
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);

    keyPressHandler({
      name: 'a',
      ctrl: false,
      meta: false,
      shift: false,
      paste: false,
      sequence: '',
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('updates initialIndex when config context changes', () => {
    const mockGetModel = vi.fn(() => DEFAULT_QWEN_MODEL);
    const mockGetAuthType = vi.fn(() => 'qwen-oauth');
    const mockSettings = {
      isTrusted: true,
      user: { settings: {} },
      workspace: { settings: {} },
      setValue: vi.fn(),
    } as unknown as LoadedSettings;
    const { rerender } = render(
      <SettingsContext.Provider value={mockSettings}>
        <ConfigContext.Provider
          value={
            {
              getModel: mockGetModel,
              getAuthType: mockGetAuthType,
              getAvailableModelsForAuthType:
                createMockGetAvailableModelsForAuthType(),
              getAllConfiguredModels: vi.fn(() =>
                getFilteredQwenModels().map((m) => ({
                  id: m.id,
                  label: m.label,
                  description: m.description || '',
                  authType: AuthType.QWEN_OAUTH,
                })),
              ),
            } as unknown as Config
          }
        >
          <ModelDialog onClose={vi.fn()} />
        </ConfigContext.Provider>
      </SettingsContext.Provider>,
    );

    // The custom-model action occupies index 0, so coder-model shifts to 1.
    expect(mockedSelect.mock.calls[0][0].initialIndex).toBe(1);

    mockGetModel.mockReturnValue(DEFAULT_QWEN_MODEL);
    const newMockConfig = {
      getModel: mockGetModel,
      getAuthType: mockGetAuthType,
      getAvailableModelsForAuthType: createMockGetAvailableModelsForAuthType(),
      getAllConfiguredModels: vi.fn(() =>
        getFilteredQwenModels().map((m) => ({
          id: m.id,
          label: m.label,
          description: m.description || '',
          authType: AuthType.QWEN_OAUTH,
        })),
      ),
    } as unknown as Config;

    rerender(
      <SettingsContext.Provider value={mockSettings}>
        <ConfigContext.Provider value={newMockConfig}>
          <ModelDialog onClose={vi.fn()} />
        </ConfigContext.Provider>
      </SettingsContext.Provider>,
    );

    // Should be called at least twice: initial render + re-render after context change
    expect(mockedSelect).toHaveBeenCalledTimes(2);
    // Calculate expected index for DEFAULT_QWEN_MODEL dynamically
    const qwenModels = getFilteredQwenModels();
    const expectedCoderIndex = qwenModels.findIndex(
      (m) => m.id === DEFAULT_QWEN_MODEL,
    );
    expect(mockedSelect.mock.calls[1][0].initialIndex).toBe(
      expectedCoderIndex + 1,
    );
  });
});
