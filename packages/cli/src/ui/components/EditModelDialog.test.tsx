/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditModelDialog } from './EditModelDialog.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { TextInput } from './shared/TextInput.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import type { Config } from '@vibe-bti/vibe-code-core';
import { AuthType } from '@vibe-bti/vibe-code-core';
import type { LoadedSettings } from '../../config/settings.js';
import { SettingScope } from '../../config/settings.js';

vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));
vi.mock('./shared/DescriptiveRadioButtonSelect.js', () => ({
  DescriptiveRadioButtonSelect: vi.fn(() => null),
}));
vi.mock('./shared/TextInput.js', () => ({
  TextInput: vi.fn(() => null),
}));
vi.mock('../../utils/settingsUtils.js', () => ({
  backupSettingsFile: vi.fn(),
}));

const mockedUseKeypress = vi.mocked(useKeypress);
const mockedSelect = vi.mocked(DescriptiveRadioButtonSelect);
const mockedTextInput = vi.mocked(TextInput);

const renderComponent = (
  props: Partial<React.ComponentProps<typeof EditModelDialog>> = {},
) => {
  const mockSettings = {
    isTrusted: true,
    user: { settings: {} },
    workspace: { settings: {} },
    merged: {
      env: {
        OLD_ENV_KEY: 'old-secret',
      },
      modelProviders: {
        [AuthType.USE_OPENAI]: [
          {
            id: 'old-model',
            name: 'Old Name',
            baseUrl: 'https://api.old/v1',
            envKey: 'OLD_ENV_KEY',
            generationConfig: {
              useStreaming: false,
              reasoning: { effort: 'low' as const },
            },
          },
        ],
      },
    },
    setValue: vi.fn(),
    forScope: vi.fn(() => ({ path: '/mock/.vibe/settings.json' })),
  } as unknown as LoadedSettings;

  const mockConfig = {
    switchModel: vi.fn().mockResolvedValue(undefined),
    reloadModelProvidersConfig: vi.fn(),
  } as unknown as Config;

  const defaultProps = {
    onClose: vi.fn(),
  };

  return {
    ...render(
      <SettingsContext.Provider value={mockSettings}>
        <ConfigContext.Provider value={mockConfig}>
          <EditModelDialog {...defaultProps} {...props} />
        </ConfigContext.Provider>
      </SettingsContext.Provider>,
    ),
    mockSettings,
    mockConfig,
    props: { ...defaultProps, ...props },
  };
};

describe('<EditModelDialog />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders saved models from settings.json for selection', () => {
    renderComponent();

    const props = mockedSelect.mock.calls[0][0];
    expect(props.items).toHaveLength(1);
    expect(props.items[0].description).toContain('old-model');
    expect(props.items[0].description).toContain('https://api.old/v1');
  });

  it('prefills edit fields from settings.json and saves updates', async () => {
    const { mockConfig, mockSettings, props } = renderComponent();

    const selectModel = mockedSelect.mock.calls[0][0];
    await act(async () => {
      await selectModel.onSelect(selectModel.items[0].value);
    });

    const authTypeSelect = mockedSelect.mock.calls.at(-1)?.[0];
    await act(async () => {
      await authTypeSelect?.onSelect(AuthType.USE_ANTHROPIC);
    });

    expect(mockedTextInput.mock.calls.at(-1)?.[0].value).toBe(
      'https://api.old/v1',
    );

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange('https://api.new/v1');
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    expect(mockedTextInput.mock.calls.at(-1)?.[0].value).toBe('old-secret');

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange('new-secret');
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    expect(mockedTextInput.mock.calls.at(-1)?.[0].value).toBe('old-model');

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange('new-model');
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    expect(mockedTextInput.mock.calls.at(-1)?.[0].value).toBe('Old Name');

    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onChange('New Name');
    });
    await act(async () => {
      mockedTextInput.mock.calls.at(-1)?.[0].onSubmit?.();
    });

    const reasoningSelect = mockedSelect.mock.calls.at(-1)?.[0];
    await act(async () => {
      await reasoningSelect?.onSelect('high');
    });

    expect(mockConfig.reloadModelProvidersConfig).toHaveBeenCalled();
    expect(mockConfig.switchModel).toHaveBeenCalledWith(
      AuthType.USE_ANTHROPIC,
      'new-model',
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'env.OLD_ENV_KEY',
      undefined,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      expect.stringMatching(/^env\.QWEN_CUSTOM_MODEL_API_KEY_ANTHROPIC_/),
      'new-secret',
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'modelProviders.openai',
      [],
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'modelProviders.anthropic',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'new-model',
          name: 'New Name',
          baseUrl: 'https://api.new/v1',
          generationConfig: {
            useStreaming: false,
            reasoning: { effort: 'high' },
          },
        }),
      ]),
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.USE_ANTHROPIC,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'model.name',
      'new-model',
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('registers keypress handling', () => {
    renderComponent();
    expect(mockedUseKeypress).toHaveBeenCalled();
  });
});
