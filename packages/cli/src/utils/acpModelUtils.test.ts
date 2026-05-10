/**
 * @license
 * Copyright 2025 Vibe Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { AuthType } from '@vibe-bti/vibe-code-core';
import {
  formatAcpModelId,
  parseAcpBaseModelId,
  parseAcpModelOption,
} from './acpModelUtils.js';

describe('acpModelUtils', () => {
  it('formats modelId(authType)', () => {
    expect(formatAcpModelId('vibe3', AuthType.VIBE_OAUTH)).toBe(
      `vibe3(${AuthType.VIBE_OAUTH})`,
    );
  });

  it('extracts base model id when string ends with parentheses', () => {
    expect(parseAcpBaseModelId(`vibe3(${AuthType.USE_OPENAI})`)).toBe('vibe3');
  });

  it('does not strip when parentheses are not a trailing suffix', () => {
    expect(parseAcpBaseModelId('vibe3(x) y')).toBe('vibe3(x) y');
  });

  it('parses modelId and validates authType', () => {
    expect(parseAcpModelOption(` vibe3(${AuthType.USE_OPENAI}) `)).toEqual({
      modelId: 'vibe3',
      authType: AuthType.USE_OPENAI,
    });
  });

  it('returns trimmed input as modelId when authType is invalid', () => {
    expect(parseAcpModelOption('vibe3(not-a-real-auth)')).toEqual({
      modelId: 'vibe3(not-a-real-auth)',
    });
  });
});
