"""Error types for vibe_code_sdk."""

from __future__ import annotations


class VibeSDKError(Exception):
    """Base error for all SDK failures."""


class ValidationError(VibeSDKError):
    """Raised when query options are invalid."""


class AbortError(VibeSDKError):
    """Raised when an operation is aborted by caller or transport."""


class ProcessExitError(VibeSDKError):
    """Raised when vibe CLI exits with non-zero status or signal."""

    def __init__(self, message: str, exit_code: int | None = None) -> None:
        super().__init__(message)
        self.exit_code = exit_code


class ControlRequestTimeoutError(VibeSDKError):
    """Raised when a control request times out waiting for response."""
