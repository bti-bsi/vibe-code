/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoveModelDialog } from './RemoveModelDialog.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
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
vi.mock('../../utils/settingsUtils.js', () => ({
  backupSettingsFile: vi.fn(),
}));

const mockedUseKeypress = vi.mocked(useKeypress);
const mockedSelect = vi.mocked(DescriptiveRadioButtonSelect);

const renderComponent = (
  props: Partial<React.ComponentProps<typeof RemoveModelDialog>> = {},
) => {
  const mockSettings = {
    isTrusted: true,
    user: { settings: {} },
    workspace: { settings: {} },
    merged: {
      env: {
        OPENAI_ENV: 'secret-openai',
        GEMINI_ENV: 'secret-gemini',
      },
      modelProviders: {
        [AuthType.USE_OPENAI]: [
          {
            id: 'openai-model',
            name: 'OpenAI Model',
            baseUrl: 'https://api.openai.local/v1',
            envKey: 'OPENAI_ENV',
          },
        ],
        [AuthType.USE_GEMINI]: [
          {
            id: 'gemini-model',
            name: 'Gemini Model',
            baseUrl: 'https://api.gemini.local/v1',
            envKey: 'GEMINI_ENV',
          },
        ],
      },
    },
    setValue: vi.fn(),
    forScope: vi.fn(() => ({ path: '/mock/.vibe/settings.json' })),
  } as unknown as LoadedSettings;

  const mockConfig = {
    getContentGeneratorConfig: vi.fn(() => ({
      authType: AuthType.USE_OPENAI,
    })),
    getModel: vi.fn(() => 'openai-model'),
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
          <RemoveModelDialog {...defaultProps} {...props} />
        </ConfigContext.Provider>
      </SettingsContext.Provider>,
    ),
    mockSettings,
    mockConfig,
    props: { ...defaultProps, ...props },
  };
};

describe('<RemoveModelDialog />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders saved models from settings.json for selection', () => {
    renderComponent();

    const props = mockedSelect.mock.calls[0][0];
    expect(props.items).toHaveLength(2);
    expect(props.items[0].description).toContain('https://api.openai.local/v1');
  });

  it('removes the selected model and switches to a fallback when needed', async () => {
    const { mockConfig, mockSettings, props } = renderComponent();

    const selectModel = mockedSelect.mock.calls[0][0];
    await act(async () => {
      await selectModel.onSelect(selectModel.items[0].value);
    });

    const confirmSelect = mockedSelect.mock.calls.at(-1)?.[0];
    await act(async () => {
      await confirmSelect?.onSelect('confirm');
    });

    expect(mockConfig.reloadModelProvidersConfig).toHaveBeenCalled();
    expect(mockConfig.switchModel).toHaveBeenCalledWith(
      AuthType.USE_GEMINI,
      'gemini-model',
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'env.OPENAI_ENV',
      undefined,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'modelProviders.openai',
      [],
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.USE_GEMINI,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'model.name',
      'gemini-model',
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('registers keypress handling', () => {
    renderComponent();
    expect(mockedUseKeypress).toHaveBeenCalled();
  });
});
