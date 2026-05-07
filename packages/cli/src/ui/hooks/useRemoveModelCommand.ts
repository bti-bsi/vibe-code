/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';

interface UseRemoveModelCommandReturn {
  isRemoveModelDialogOpen: boolean;
  openRemoveModelDialog: () => void;
  closeRemoveModelDialog: () => void;
}

export function useRemoveModelCommand(): UseRemoveModelCommandReturn {
  const [isRemoveModelDialogOpen, setIsRemoveModelDialogOpen] = useState(false);

  const openRemoveModelDialog = useCallback(() => {
    setIsRemoveModelDialogOpen(true);
  }, []);

  const closeRemoveModelDialog = useCallback(() => {
    setIsRemoveModelDialogOpen(false);
  }, []);

  return {
    isRemoveModelDialogOpen,
    openRemoveModelDialog,
    closeRemoveModelDialog,
  };
}
