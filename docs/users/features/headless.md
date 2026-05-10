# Headless Mode

Headless mode allows you to run Vibe Code programmatically from command line
scripts and automation tools without any interactive UI. This is ideal for
scripting, automation, CI/CD pipelines, and building AI-powered tools.

## Overview

The headless mode provides a headless interface to Vibe Code that:

- Accepts prompts via command line arguments or stdin
- Returns structured output (text or JSON)
- Supports file redirection and piping
- Enables automation and scripting workflows
- Provides consistent exit codes for error handling
- Can resume previous sessions scoped to the current project for multi-step automation

## Basic Usage

### Direct Prompts

Use the `--prompt` (or `-p`) flag to run in headless mode:

```bash
vibe --prompt "What is machine learning?"
```

### Stdin Input

Pipe input to Vibe Code from your terminal:

```bash
echo "Explain this code" | vibe
```

### Combining with File Input

Read from files and process with Vibe Code:

```bash
cat README.md | vibe --prompt "Summarize this documentation"
```

### Resume Previous Sessions (Headless)

Reuse conversation context from the current project in headless scripts:

```bash
# Continue the most recent session for this project and run a new prompt
vibe --continue -p "Run the tests again and summarize failures"

# Resume a specific session ID directly (no UI)
vibe --resume 123e4567-e89b-12d3-a456-426614174000 -p "Apply the follow-up refactor"
```

> [!note]
>
> - Session data is project-scoped JSONL under `~/.vibe/projects/<sanitized-cwd>/chats`.
> - Restores conversation history, tool outputs, and chat-compression checkpoints before sending the new prompt.

## Customize the Main Session Prompt

You can change the main session system prompt for a single CLI run without editing shared memory files.

### Override the Built-in System Prompt

Use `--system-prompt` to replace Vibe Code's built-in main-session prompt for the current run:

```bash
vibe -p "Review this patch" --system-prompt "You are a terse release reviewer. Report only blocking issues."
```

### Append Extra Instructions

Use `--append-system-prompt` to keep the built-in prompt and add extra instructions for this run:

```bash
vibe -p "Review this patch" --append-system-prompt "Be terse and focus on concrete findings."
```

You can combine both flags when you want a custom base prompt plus an extra run-specific instruction:

```bash
vibe -p "Summarize this repository" \
  --system-prompt "You are a migration planner." \
  --append-system-prompt "Return exactly three bullets."
```

> [!note]
>
> - `--system-prompt` applies only to the current run's main session.
> - Loaded memory and context files such as `VIBE.md` are still appended after `--system-prompt`.
> - `--append-system-prompt` is applied after the built-in prompt and loaded memory, and can be used together with `--system-prompt`.

## Output Formats

Vibe Code supports multiple output formats for different use cases:

### Text Output (Default)

Standard human-readable output:

```bash
vibe -p "What is the capital of France?"
```

Response format:

```
The capital of France is Paris.
```

### JSON Output

Returns structured data as a JSON array. All messages are buffered and output together when the session completes. This format is ideal for programmatic processing and automation scripts.

The JSON output is an array of message objects. The output includes multiple message types: system messages (session initialization), assistant messages (AI responses), and result messages (execution summary).

#### Example Usage

```bash
vibe -p "What is the capital of France?" --output-format json
```

Output (at end of execution):

```json
[
  {
    "type": "system",
    "subtype": "session_start",
    "uuid": "...",
    "session_id": "...",
    "model": "vibe3-coder-plus",
    ...
  },
  {
    "type": "assistant",
    "uuid": "...",
    "session_id": "...",
    "message": {
      "id": "...",
      "type": "message",
      "role": "assistant",
      "model": "vibe3-coder-plus",
      "content": [
        {
          "type": "text",
          "text": "The capital of France is Paris."
        }
      ],
      "usage": {...}
    },
    "parent_tool_use_id": null
  },
  {
    "type": "result",
    "subtype": "success",
    "uuid": "...",
    "session_id": "...",
    "is_error": false,
    "duration_ms": 1234,
    "result": "The capital of France is Paris.",
    "usage": {...}
  }
]
```

### Stream-JSON Output

Stream-JSON format emits JSON messages immediately as they occur during execution, enabling real-time monitoring. This format uses line-delimited JSON where each message is a complete JSON object on a single line.

```bash
vibe -p "Explain TypeScript" --output-format stream-json
```

Output (streaming as events occur):

```json
{"type":"system","subtype":"session_start","uuid":"...","session_id":"..."}
{"type":"assistant","uuid":"...","session_id":"...","message":{...}}
{"type":"result","subtype":"success","uuid":"...","session_id":"..."}
```

When combined with `--include-partial-messages`, additional stream events are emitted in real-time (message_start, content_block_delta, etc.) for real-time UI updates.

```bash
vibe -p "Write a Python script" --output-format stream-json --include-partial-messages
```

### Input Format

The `--input-format` parameter controls how Vibe Code consumes input from standard input:

- **`text`** (default): Standard text input from stdin or command-line arguments
- **`stream-json`**: JSON message protocol via stdin for bidirectional communication

> **Note:** Stream-json input mode is currently under construction and is intended for SDK integration. It requires `--output-format stream-json` to be set.

### File Redirection

Save output to files or pipe to other commands:

```bash
# Save to file
vibe -p "Explain Docker" > docker-explanation.txt
vibe -p "Explain Docker" --output-format json > docker-explanation.json

# Append to file
vibe -p "Add more details" >> docker-explanation.txt

# Pipe to other tools
vibe -p "What is Kubernetes?" --output-format json | jq '.response'
vibe -p "Explain microservices" | wc -w
vibe -p "List programming languages" | grep -i "python"

# Stream-JSON output for real-time processing
vibe -p "Explain Docker" --output-format stream-json | jq '.type'
vibe -p "Write code" --output-format stream-json --include-partial-messages | jq '.event.type'
```

## Configuration Options

Key command-line options for headless usage:

| Option                       | Description                                                              | Example                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `--prompt`, `-p`             | Run in headless mode                                                     | `vibe -p "query"`                                                        |
| `--output-format`, `-o`      | Specify output format (text, json, stream-json)                          | `vibe -p "query" --output-format json`                                   |
| `--input-format`             | Specify input format (text, stream-json)                                 | `vibe --input-format text --output-format stream-json`                   |
| `--include-partial-messages` | Include partial messages in stream-json output                           | `vibe -p "query" --output-format stream-json --include-partial-messages` |
| `--system-prompt`            | Override the main session system prompt for this run                     | `vibe -p "query" --system-prompt "You are a terse reviewer."`            |
| `--append-system-prompt`     | Append extra instructions to the main session system prompt for this run | `vibe -p "query" --append-system-prompt "Focus on concrete findings."`   |
| `--debug`, `-d`              | Enable debug mode                                                        | `vibe -p "query" --debug`                                                |
| `--all-files`, `-a`          | Include all files in context                                             | `vibe -p "query" --all-files`                                            |
| `--include-directories`      | Include additional directories                                           | `vibe -p "query" --include-directories src,docs`                         |
| `--yolo`, `-y`               | Auto-approve all actions                                                 | `vibe -p "query" --yolo`                                                 |
| `--approval-mode`            | Set approval mode                                                        | `vibe -p "query" --approval-mode auto_edit`                              |
| `--continue`                 | Resume the most recent session for this project                          | `vibe --continue -p "Pick up where we left off"`                         |
| `--resume [sessionId]`       | Resume a specific session (or choose interactively)                      | `vibe --resume 123e... -p "Finish the refactor"`                         |

For complete details on all available configuration options, settings files, and environment variables, see the [Configuration Guide](../configuration/settings).

## Examples

### Code review

```bash
cat src/auth.py | vibe -p "Review this authentication code for security issues" > security-review.txt
```

### Generate commit messages

```bash
result=$(git diff --cached | vibe -p "Write a concise commit message for these changes" --output-format json)
echo "$result" | jq -r '.response'
```

### API documentation

```bash
result=$(cat api/routes.js | vibe -p "Generate OpenAPI spec for these routes" --output-format json)
echo "$result" | jq -r '.response' > openapi.json
```

### Batch code analysis

```bash
for file in src/*.py; do
    echo "Analyzing $file..."
    result=$(cat "$file" | vibe -p "Find potential bugs and suggest improvements" --output-format json)
    echo "$result" | jq -r '.response' > "reports/$(basename "$file").analysis"
    echo "Completed analysis for $(basename "$file")" >> reports/progress.log
done
```

### PR code review

```bash
result=$(git diff origin/main...HEAD | vibe -p "Review these changes for bugs, security issues, and code quality" --output-format json)
echo "$result" | jq -r '.response' > pr-review.json
```

### Log analysis

```bash
grep "ERROR" /var/log/app.log | tail -20 | vibe -p "Analyze these errors and suggest root cause and fixes" > error-analysis.txt
```

### Release notes generation

```bash
result=$(git log --oneline v1.0.0..HEAD | vibe -p "Generate release notes from these commits" --output-format json)
response=$(echo "$result" | jq -r '.response')
echo "$response"
echo "$response" >> CHANGELOG.md
```

### Model and tool usage tracking

```bash
result=$(vibe -p "Explain this database schema" --include-directories db --output-format json)
total_tokens=$(echo "$result" | jq -r '.stats.models // {} | to_entries | map(.value.tokens.total) | add // 0')
models_used=$(echo "$result" | jq -r '.stats.models // {} | keys | join(", ") | if . == "" then "none" else . end')
tool_calls=$(echo "$result" | jq -r '.stats.tools.totalCalls // 0')
tools_used=$(echo "$result" | jq -r '.stats.tools.byName // {} | keys | join(", ") | if . == "" then "none" else . end')
echo "$(date): $total_tokens tokens, $tool_calls tool calls ($tools_used) used with models: $models_used" >> usage.log
echo "$result" | jq -r '.response' > schema-docs.md
echo "Recent usage trends:"
tail -5 usage.log
```

## Persistent Retry Mode

When Vibe Code runs in CI/CD pipelines or as a background daemon, a brief API outage (rate limiting or overload) should not kill a multi-hour task. **Persistent retry mode** makes Vibe Code retry transient API errors indefinitely until the service recovers.

### How it works

- **Transient errors only**: HTTP 429 (Rate Limit) and 529 (Overloaded) are retried indefinitely. Other errors (400, 500, etc.) still fail normally.
- **Exponential backoff with cap**: Retry delays grow exponentially but are capped at **5 minutes** per retry.
- **Heartbeat keepalive**: During long waits, a status line is printed to stderr every **30 seconds** to prevent CI runners from killing the process due to inactivity.
- **Graceful degradation**: Non-transient errors and interactive mode are completely unaffected.

### Activation

Set the `VIBE_CODE_UNATTENDED_RETRY` environment variable to `true` or `1` (strict match, case-sensitive):

```bash
export VIBE_CODE_UNATTENDED_RETRY=1
```

> [!important]
> Persistent retry requires an **explicit opt-in**. `CI=true` alone does **not** activate it — silently turning a fast-fail CI job into an infinite-wait job would be dangerous. Always set `VIBE_CODE_UNATTENDED_RETRY` explicitly in your pipeline configuration.

### Examples

#### GitHub Actions

```yaml
- name: Automated code review
  env:
    VIBE_CODE_UNATTENDED_RETRY: '1'
  run: |
    vibe -p "Review all files in src/ for security issues" \
      --output-format json \
      --yolo > review.json
```

#### Overnight batch processing

```bash
export VIBE_CODE_UNATTENDED_RETRY=1
vibe -p "Migrate all callback-style functions to async/await in src/" --yolo
```

#### Background daemon

```bash
VIBE_CODE_UNATTENDED_RETRY=1 nohup vibe -p "Audit all dependencies for known CVEs" \
  --output-format json > audit.json 2> audit.log &
```

### Monitoring

During persistent retry, heartbeat messages are printed to **stderr**:

```
[vibe-code] Waiting for API capacity... attempt 3, retry in 45s
[vibe-code] Waiting for API capacity... attempt 3, retry in 15s
```

These messages keep CI runners alive and let you monitor progress. They do not appear in stdout, so JSON output piped to other tools remains clean.

## Resources

- [CLI Configuration](../configuration/settings#command-line-arguments) - Complete configuration guide
- [Authentication](../configuration/settings#environment-variables-for-api-access) - Setup authentication
- [Commands](../features/commands) - Interactive commands reference
- [Tutorials](../quickstart) - Step-by-step automation guides
