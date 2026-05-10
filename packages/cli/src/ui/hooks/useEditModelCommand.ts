/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';

interface UseEditModelCommandReturn {
  isEditModelDialogOpen: boolean;
  openEditModelDialog: () => void;
  closeEditModelDialog: () => void;
}

export function useEditModelCommand(): UseEditModelCommandReturn {
  const [isEditModelDialogOpen, setIsEditModelDialogOpen] = useState(false);

  const openEditModelDialog = useCallback(() => {
    setIsEditModelDialogOpen(true);
  }, []);

  const closeEditModelDialog = useCallback(() => {
    setIsEditModelDialogOpen(false);
  }, []);

  return {
    isEditModelDialogOpen,
    openEditModelDialog,
    closeEditModelDialog,
  };
}
