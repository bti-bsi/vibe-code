/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRemoveModelCommand } from './useRemoveModelCommand.js';

describe('useRemoveModelCommand', () => {
  it('should initialize with the dialog closed', () => {
    const { result } = renderHook(() => useRemoveModelCommand());
    expect(result.current.isRemoveModelDialogOpen).toBe(false);
  });

  it('should open the dialog when openRemoveModelDialog is called', () => {
    const { result } = renderHook(() => useRemoveModelCommand());

    act(() => {
      result.current.openRemoveModelDialog();
    });

    expect(result.current.isRemoveModelDialogOpen).toBe(true);
  });

  it('should close the dialog when closeRemoveModelDialog is called', () => {
    const { result } = renderHook(() => useRemoveModelCommand());

    act(() => {
      result.current.openRemoveModelDialog();
    });
    expect(result.current.isRemoveModelDialogOpen).toBe(true);

    act(() => {
      result.current.closeRemoveModelDialog();
    });
    expect(result.current.isRemoveModelDialogOpen).toBe(false);
  });
});
