/**
 * @license
 * Copyright 2025 Vibe Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { computeContextUsage } from './contextUsage.js';

describe('computeContextUsage', () => {
  it('returns null when there is no trusted token limit', () => {
    expect(
      computeContextUsage(
        {
          usage: {
            promptTokens: 1234,
          },
        },
        {
          modelId: 'unknown-model',
          name: 'Unknown Model',
        },
      ),
    ).toBeNull();
  });

  it('prefers usageStats.tokenLimit over model metadata', () => {
    expect(
      computeContextUsage(
        {
          usage: {
            promptTokens: 1000,
          },
          tokenLimit: 4000,
        },
        {
          modelId: 'vibe3-max',
          name: 'Vibe3 Max',
          _meta: { contextLimit: 8000 },
        },
      ),
    ).toEqual({
      percentLeft: 75,
      usedTokens: 1000,
      tokenLimit: 4000,
      modelName: 'Vibe3 Max',
      inputTokens: 1000,
      outputTokens: 0,
      totalTokens: 1000,
    });
  });

  it('falls back to model metadata when usageStats does not include a limit', () => {
    expect(
      computeContextUsage(
        {
          usage: {
            promptTokens: 2000,
          },
        },
        {
          modelId: 'vibe3-max',
          name: 'Vibe3 Max',
          _meta: { contextLimit: 8000 },
        },
      ),
    ).toEqual({
      percentLeft: 75,
      usedTokens: 2000,
      tokenLimit: 8000,
      modelName: 'Vibe3 Max',
      inputTokens: 2000,
      outputTokens: 0,
      totalTokens: 2000,
    });
  });

  it('uses totalTokens for context percentage and keeps input/output details', () => {
    expect(
      computeContextUsage(
        {
          usage: {
            inputTokens: 3000,
            outputTokens: 1000,
            totalTokens: 4000,
          },
          tokenLimit: 12000,
        },
        null,
      ),
    ).toEqual({
      percentLeft: 67,
      usedTokens: 4000,
      tokenLimit: 12000,
      modelName: undefined,
      inputTokens: 3000,
      outputTokens: 1000,
      totalTokens: 4000,
    });
  });
});
