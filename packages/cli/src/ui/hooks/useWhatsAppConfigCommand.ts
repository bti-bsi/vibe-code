/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

export function useWhatsAppConfigCommand() {
  const [isWhatsAppConfigDialogOpen, setIsWhatsAppConfigDialogOpen] = useState(false);

  const openWhatsAppConfigDialog = useCallback(() => {
    setIsWhatsAppConfigDialogOpen(true);
  }, []);

  const closeWhatsAppConfigDialog = useCallback(() => {
    setIsWhatsAppConfigDialogOpen(false);
  }, []);

  return {
    isWhatsAppConfigDialogOpen,
    openWhatsAppConfigDialog,
    closeWhatsAppConfigDialog,
  };
}
