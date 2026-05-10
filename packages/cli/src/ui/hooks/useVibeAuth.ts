/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AuthType,
  vibeOAuth2Events,
  VibeOAuth2Event,
  type DeviceAuthorizationData,
} from '@vibe-bti/vibe-code-core';

export interface VibeAuthState {
  deviceAuth: DeviceAuthorizationData | null;
  authStatus:
    | 'idle'
    | 'polling'
    | 'success'
    | 'error'
    | 'timeout'
    | 'rate_limit';
  authMessage: string | null;
}

export interface ExternalAuthState {
  title: string;
  message: string;
  detail?: string;
}

export const useVibeAuth = (
  pendingAuthType: AuthType | undefined,
  isAuthenticating: boolean,
) => {
  const [vibeAuthState, setVibeAuthState] = useState<VibeAuthState>({
    deviceAuth: null,
    authStatus: 'idle',
    authMessage: null,
  });

  const isVibeAuth = pendingAuthType === AuthType.VIBE_OAUTH;

  // Set up event listeners when authentication starts
  useEffect(() => {
    if (!isVibeAuth || !isAuthenticating) {
      // Reset state when not authenticating or not Vibe auth
      setVibeAuthState({
        deviceAuth: null,
        authStatus: 'idle',
        authMessage: null,
      });
      return;
    }

    setVibeAuthState((prev) => ({
      ...prev,
      authStatus: 'idle',
    }));

    // Set up event listeners
    const handleDeviceAuth = (deviceAuth: DeviceAuthorizationData) => {
      setVibeAuthState((prev) => ({
        ...prev,
        deviceAuth: {
          verification_uri: deviceAuth.verification_uri,
          verification_uri_complete: deviceAuth.verification_uri_complete,
          user_code: deviceAuth.user_code,
          expires_in: deviceAuth.expires_in,
          device_code: deviceAuth.device_code,
        },
        authStatus: 'polling',
      }));
    };

    const handleAuthProgress = (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => {
      setVibeAuthState((prev) => ({
        ...prev,
        authStatus: status,
        authMessage: message || null,
      }));
    };

    // Add event listeners
    vibeOAuth2Events.on(VibeOAuth2Event.AuthUri, handleDeviceAuth);
    vibeOAuth2Events.on(VibeOAuth2Event.AuthProgress, handleAuthProgress);

    // Cleanup event listeners when component unmounts or auth finishes
    return () => {
      vibeOAuth2Events.off(VibeOAuth2Event.AuthUri, handleDeviceAuth);
      vibeOAuth2Events.off(VibeOAuth2Event.AuthProgress, handleAuthProgress);
    };
  }, [isVibeAuth, isAuthenticating]);

  const cancelVibeAuth = useCallback(() => {
    // Emit cancel event to stop polling
    vibeOAuth2Events.emit(VibeOAuth2Event.AuthCancel);

    setVibeAuthState({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
  }, []);

  return {
    vibeAuthState,
    cancelVibeAuth,
  };
};
