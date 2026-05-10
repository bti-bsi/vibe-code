/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

export function useConfigCommand() {
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  const openConfigDialog = useCallback(() => {
    setIsConfigDialogOpen(true);
  }, []);

  const closeConfigDialog = useCallback(() => {
    setIsConfigDialogOpen(false);
  }, []);

  return {
    isConfigDialogOpen,
    openConfigDialog,
    closeConfigDialog,
  };
}
