/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DeviceAuthorizationData } from '@vibe-bti/vibe-code-core';
import { useVibeAuth } from './useVibeAuth.js';
import {
  AuthType,
  vibeOAuth2Events,
  VibeOAuth2Event,
} from '@vibe-bti/vibe-code-core';

// Mock the vibeOAuth2Events
vi.mock('@vibe-bti/vibe-code-core', async () => {
  const actual = await vi.importActual('@vibe-bti/vibe-code-core');
  const mockEmitter = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
  };
  return {
    ...actual,
    vibeOAuth2Events: mockEmitter,
    VibeOAuth2Event: {
      AuthUri: 'authUri',
      AuthProgress: 'authProgress',
    },
  };
});

const mockVibeOAuth2Events = vi.mocked(vibeOAuth2Events);

describe('useVibeAuth', () => {
  const mockDeviceAuth: DeviceAuthorizationData = {
    verification_uri: 'https://oauth.vibe.com/device',
    verification_uri_complete: 'https://oauth.vibe.com/device?user_code=ABC123',
    user_code: 'ABC123',
    expires_in: 1800,
    device_code: 'device_code_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state when not Vibe auth', () => {
    const { result } = renderHook(() =>
      useVibeAuth(AuthType.USE_GEMINI, false),
    );

    expect(result.current.vibeAuthState).toEqual({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
    expect(result.current.cancelVibeAuth).toBeInstanceOf(Function);
  });

  it('should initialize with default state when Vibe auth but not authenticating', () => {
    const { result } = renderHook(() =>
      useVibeAuth(AuthType.VIBE_OAUTH, false),
    );

    expect(result.current.vibeAuthState).toEqual({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
    expect(result.current.cancelVibeAuth).toBeInstanceOf(Function);
  });

  it('should set up event listeners when Vibe auth and authenticating', () => {
    renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    expect(mockVibeOAuth2Events.on).toHaveBeenCalledWith(
      VibeOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockVibeOAuth2Events.on).toHaveBeenCalledWith(
      VibeOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should handle device auth event', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result } = renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.vibeAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.vibeAuthState.authStatus).toBe('polling');
  });

  it('should handle auth progress event - success', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result } = renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    act(() => {
      handleAuthProgress!('success', 'Authentication successful!');
    });

    expect(result.current.vibeAuthState.authStatus).toBe('success');
    expect(result.current.vibeAuthState.authMessage).toBe(
      'Authentication successful!',
    );
  });

  it('should handle auth progress event - error', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result } = renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    act(() => {
      handleAuthProgress!('error', 'Authentication failed');
    });

    expect(result.current.vibeAuthState.authStatus).toBe('error');
    expect(result.current.vibeAuthState.authMessage).toBe(
      'Authentication failed',
    );
  });

  it('should handle auth progress event - polling', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result } = renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    act(() => {
      handleAuthProgress!('polling', 'Waiting for user authorization...');
    });

    expect(result.current.vibeAuthState.authStatus).toBe('polling');
    expect(result.current.vibeAuthState.authMessage).toBe(
      'Waiting for user authorization...',
    );
  });

  it('should handle auth progress event - rate_limit', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result } = renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    act(() => {
      handleAuthProgress!(
        'rate_limit',
        'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
      );
    });

    expect(result.current.vibeAuthState.authStatus).toBe('rate_limit');
    expect(result.current.vibeAuthState.authMessage).toBe(
      'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
    );
  });

  it('should handle auth progress event without message', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result } = renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    act(() => {
      handleAuthProgress!('success');
    });

    expect(result.current.vibeAuthState.authStatus).toBe('success');
    expect(result.current.vibeAuthState.authMessage).toBe(null);
  });

  it('should clean up event listeners when auth type changes', () => {
    const { rerender } = renderHook(
      ({ pendingAuthType, isAuthenticating }) =>
        useVibeAuth(pendingAuthType, isAuthenticating),
      {
        initialProps: {
          pendingAuthType: AuthType.VIBE_OAUTH,
          isAuthenticating: true,
        },
      },
    );

    // Change to non-Vibe auth
    rerender({ pendingAuthType: AuthType.USE_GEMINI, isAuthenticating: true });

    expect(mockVibeOAuth2Events.off).toHaveBeenCalledWith(
      VibeOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockVibeOAuth2Events.off).toHaveBeenCalledWith(
      VibeOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners when authentication stops', () => {
    const { rerender } = renderHook(
      ({ isAuthenticating }) =>
        useVibeAuth(AuthType.VIBE_OAUTH, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(mockVibeOAuth2Events.off).toHaveBeenCalledWith(
      VibeOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockVibeOAuth2Events.off).toHaveBeenCalledWith(
      VibeOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useVibeAuth(AuthType.VIBE_OAUTH, true),
    );

    unmount();

    expect(mockVibeOAuth2Events.off).toHaveBeenCalledWith(
      VibeOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockVibeOAuth2Events.off).toHaveBeenCalledWith(
      VibeOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should reset state when switching from Vibe auth to another auth type', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ pendingAuthType, isAuthenticating }) =>
        useVibeAuth(pendingAuthType, isAuthenticating),
      {
        initialProps: {
          pendingAuthType: AuthType.VIBE_OAUTH,
          isAuthenticating: true,
        },
      },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.vibeAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.vibeAuthState.authStatus).toBe('polling');

    // Switch to different auth type
    rerender({ pendingAuthType: AuthType.USE_GEMINI, isAuthenticating: true });

    expect(result.current.vibeAuthState.deviceAuth).toBe(null);
    expect(result.current.vibeAuthState.authStatus).toBe('idle');
    expect(result.current.vibeAuthState.authMessage).toBe(null);
  });

  it('should reset state when authentication stops', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ isAuthenticating }) =>
        useVibeAuth(AuthType.VIBE_OAUTH, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.vibeAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.vibeAuthState.authStatus).toBe('polling');

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(result.current.vibeAuthState.deviceAuth).toBe(null);
    expect(result.current.vibeAuthState.authStatus).toBe('idle');
    expect(result.current.vibeAuthState.authMessage).toBe(null);
  });

  it('should handle cancelVibeAuth function', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockVibeOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === VibeOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockVibeOAuth2Events;
    });

    const { result } = renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    // Set up some state
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.vibeAuthState.deviceAuth).toEqual(mockDeviceAuth);

    // Cancel auth
    act(() => {
      result.current.cancelVibeAuth();
    });

    expect(result.current.vibeAuthState.deviceAuth).toBe(null);
    expect(result.current.vibeAuthState.authStatus).toBe('idle');
    expect(result.current.vibeAuthState.authMessage).toBe(null);
  });

  it('should handle different auth types correctly', () => {
    // Test with Vibe OAuth - should set up event listeners when authenticating
    const { result: vibeResult } = renderHook(() =>
      useVibeAuth(AuthType.VIBE_OAUTH, true),
    );
    expect(vibeResult.current.vibeAuthState.authStatus).toBe('idle');
    expect(mockVibeOAuth2Events.on).toHaveBeenCalled();

    // Test with other auth types - should not set up event listeners
    const { result: geminiResult } = renderHook(() =>
      useVibeAuth(AuthType.USE_GEMINI, true),
    );
    expect(geminiResult.current.vibeAuthState.authStatus).toBe('idle');

    const { result: oauthResult } = renderHook(() =>
      useVibeAuth(AuthType.USE_OPENAI, true),
    );
    expect(oauthResult.current.vibeAuthState.authStatus).toBe('idle');
  });

  it('should initialize with idle status when starting authentication with Vibe auth', () => {
    const { result } = renderHook(() => useVibeAuth(AuthType.VIBE_OAUTH, true));

    expect(result.current.vibeAuthState.authStatus).toBe('idle');
    expect(mockVibeOAuth2Events.on).toHaveBeenCalled();
  });
});
