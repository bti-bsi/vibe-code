/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

export function useTelegramConfigCommand() {
  const [isTelegramConfigDialogOpen, setIsTelegramConfigDialogOpen] =
    useState(false);

  const openTelegramConfigDialog = useCallback(() => {
    setIsTelegramConfigDialogOpen(true);
  }, []);

  const closeTelegramConfigDialog = useCallback(() => {
    setIsTelegramConfigDialogOpen(false);
  }, []);

  return {
    isTelegramConfigDialogOpen,
    openTelegramConfigDialog,
    closeTelegramConfigDialog,
  };
}
