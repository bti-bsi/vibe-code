/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'vibe-code';

export const EVENT_USER_PROMPT = 'vibe-code.user_prompt';
export const EVENT_USER_RETRY = 'vibe-code.user_retry';
export const EVENT_TOOL_CALL = 'vibe-code.tool_call';
export const EVENT_API_REQUEST = 'vibe-code.api_request';
export const EVENT_API_ERROR = 'vibe-code.api_error';
export const EVENT_API_CANCEL = 'vibe-code.api_cancel';
export const EVENT_API_RESPONSE = 'vibe-code.api_response';
export const EVENT_CLI_CONFIG = 'vibe-code.config';
export const EVENT_EXTENSION_DISABLE = 'vibe-code.extension_disable';
export const EVENT_EXTENSION_ENABLE = 'vibe-code.extension_enable';
export const EVENT_EXTENSION_INSTALL = 'vibe-code.extension_install';
export const EVENT_EXTENSION_UNINSTALL = 'vibe-code.extension_uninstall';
export const EVENT_EXTENSION_UPDATE = 'vibe-code.extension_update';
export const EVENT_FLASH_FALLBACK = 'vibe-code.flash_fallback';
export const EVENT_RIPGREP_FALLBACK = 'vibe-code.ripgrep_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'vibe-code.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'vibe-code.slash_command';
export const EVENT_IDE_CONNECTION = 'vibe-code.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'vibe-code.chat_compression';
export const EVENT_INVALID_CHUNK = 'vibe-code.chat.invalid_chunk';
export const EVENT_CONTENT_RETRY = 'vibe-code.chat.content_retry';
export const EVENT_CONTENT_RETRY_FAILURE =
  'vibe-code.chat.content_retry_failure';
export const EVENT_CONVERSATION_FINISHED = 'vibe-code.conversation_finished';
export const EVENT_MALFORMED_JSON_RESPONSE =
  'vibe-code.malformed_json_response';
export const EVENT_FILE_OPERATION = 'vibe-code.file_operation';
export const EVENT_MODEL_SLASH_COMMAND = 'vibe-code.slash_command.model';
export const EVENT_SUBAGENT_EXECUTION = 'vibe-code.subagent_execution';
export const EVENT_SKILL_LAUNCH = 'vibe-code.skill_launch';
export const EVENT_AUTH = 'vibe-code.auth';
export const EVENT_USER_FEEDBACK = 'vibe-code.user_feedback';

// Prompt Suggestion Events
export const EVENT_PROMPT_SUGGESTION = 'vibe-code.prompt_suggestion';
export const EVENT_SPECULATION = 'vibe-code.speculation';

// Arena Events
export const EVENT_ARENA_SESSION_STARTED = 'vibe-code.arena_session_started';
export const EVENT_ARENA_AGENT_COMPLETED = 'vibe-code.arena_agent_completed';
export const EVENT_ARENA_SESSION_ENDED = 'vibe-code.arena_session_ended';

// Performance Events
export const EVENT_STARTUP_PERFORMANCE = 'vibe-code.startup.performance';
export const EVENT_MEMORY_USAGE = 'vibe-code.memory.usage';
export const EVENT_PERFORMANCE_BASELINE = 'vibe-code.performance.baseline';
export const EVENT_PERFORMANCE_REGRESSION = 'vibe-code.performance.regression';

// Managed Auto-Memory Events
export const EVENT_MEMORY_EXTRACT = 'vibe-code.memory.extract';
export const EVENT_MEMORY_DREAM = 'vibe-code.memory.dream';
export const EVENT_MEMORY_RECALL = 'vibe-code.memory.recall';
