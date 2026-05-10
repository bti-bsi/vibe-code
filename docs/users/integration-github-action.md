# Github Actions：vibe-code-action

## Overview

`vibe-code-action` is a GitHub Action that integrates [Vibe Code] into your development workflow via the [Vibe Code CLI]. It acts both as an autonomous agent for critical routine coding tasks, and an on-demand collaborator you can quickly delegate work to.

Use it to perform GitHub pull request reviews, triage issues, perform code analysis and modification, and more using [Vibe Code] conversationally (e.g., `@vibecoder fix this issue`) directly inside your GitHub repositories.

## Features

- **Automation**: Trigger workflows based on events (e.g. issue opening) or schedules (e.g. nightly).
- **On-demand Collaboration**: Trigger workflows in issue and pull request
  comments by mentioning the [Vibe Code CLI](./features/commands) (e.g., `@vibecoder /review`).
- **Extensible with Tools**: Leverage [Vibe Code](../developers/tools/introduction.md) models' tool-calling capabilities to interact with other CLIs like the [GitHub CLI] (`gh`).
- **Customizable**: Use a `VIBE.md` file in your repository to provide
  project-specific instructions and context to [Vibe Code CLI](./features/commands).

## Quick Start

Get started with Vibe Code CLI in your repository in just a few minutes:

### 1. Get a Vibe API Key

Obtain your API key from [DashScope](https://help.aliyun.com/zh/model-studio/vibe-code) (Alibaba Cloud's AI platform)

### 2. Add it as a GitHub Secret

Store your API key as a secret named `VIBE_API_KEY` in your repository:

- Go to your repository's **Settings > Secrets and variables > Actions**
- Click **New repository secret**
- Name: `VIBE_API_KEY`, Value: your API key

### 3. Update your .gitignore

Add the following entries to your `.gitignore` file:

```gitignore
# vibe-code-cli settings
.vibe/

# GitHub App credentials
gha-creds-*.json
```

### 4. Choose a Workflow

You have two options to set up a workflow:

**Option A: Use setup command (Recommended)**

1. Start the Vibe Code CLI in your terminal:

   ```shell
   vibe
   ```

2. In Vibe Code CLI in your terminal, type:

   ```
   /setup-github
   ```

**Option B: Manually copy workflows**

1. Copy the pre-built workflows from the [`examples/workflows`](./common-workflow) directory to your repository's `.github/workflows` directory. Note: the `vibe-dispatch.yml` workflow must also be copied, which triggers the workflows to run.

### 5. Try it out

**Pull Request Review:**

- Open a pull request in your repository and wait for automatic review
- Comment `@vibecoder /review` on an existing pull request to manually trigger a review

**Issue Triage:**

- Open an issue and wait for automatic triage
- Comment `@vibecoder /triage` on existing issues to manually trigger triaging

**General AI Assistance:**

- In any issue or pull request, mention `@vibecoder` followed by your request
- Examples:
  - `@vibecoder explain this code change`
  - `@vibecoder suggest improvements for this function`
  - `@vibecoder help me debug this error`
  - `@vibecoder write unit tests for this component`

## Workflows

This action provides several pre-built workflows for different use cases. Each workflow is designed to be copied into your repository's `.github/workflows` directory and customized as needed.

### Vibe Code Dispatch

This workflow acts as a central dispatcher for Vibe Code CLI, routing requests to the appropriate workflow based on the triggering event and the command provided in the comment. For a detailed guide on how to set up the dispatch workflow, go to the [Vibe Code Dispatch workflow documentation](./common-workflow).

### Issue Triage

This action can be used to triage GitHub Issues automatically or on a schedule. For a detailed guide on how to set up the issue triage system, go to the [GitHub Issue Triage workflow documentation](./examples/workflows/issue-triage).

### Pull Request Review

This action can be used to automatically review pull requests when they are opened. For a detailed guide on how to set up the pull request review system, go to the [GitHub PR Review workflow documentation](./common-workflow).

### Vibe Code CLI Assistant

This type of action can be used to invoke a general-purpose, conversational Vibe Code AI assistant within the pull requests and issues to perform a wide range of tasks. For a detailed guide on how to set up the general-purpose Vibe Code CLI workflow, go to the [Vibe Code Assistant workflow documentation](./common-workflow).

## Configuration

### Inputs

<!-- BEGIN_AUTOGEN_INPUTS -->

- <a name="__input_vibe_api_key"></a><a href="#user-content-__input_vibe_api_key"><code>vibe*api_key</code></a>: *(Optional)\_ The API key for the Vibe API.

- <a name="__input_vibe_cli_version"></a><a href="#user-content-__input_vibe_cli_version"><code>vibe*cli_version</code></a>: *(Optional, default: `latest`)\_ The version of the Vibe Code CLI to install. Can be "latest", "preview", "nightly", a specific version number, or a git branch, tag, or commit. For more information, see [Vibe Code CLI releases](https://github.com/vibe-bti/vibe-code-action/blob/main/docs/releases.md).

- <a name="__input_vibe_debug"></a><a href="#user-content-__input_vibe_debug"><code>vibe*debug</code></a>: *(Optional)\_ Enable debug logging and output streaming.

- <a name="__input_vibe_model"></a><a href="#user-content-__input_vibe_model"><code>vibe*model</code></a>: *(Optional)\_ The model to use with Vibe Code.

- <a name="__input_prompt"></a><a href="#user-content-__input_prompt"><code>prompt</code></a>: _(Optional, default: `You are a helpful assistant.`)_ A string passed to the Vibe Code CLI's [`--prompt` argument](https://github.com/vibe-bti/vibe-code-action/blob/main/docs/cli/configuration.md#command-line-arguments).

- <a name="__input_settings"></a><a href="#user-content-__input_settings"><code>settings</code></a>: _(Optional)_ A JSON string written to `.vibe/settings.json` to configure the CLI's _project_ settings.
  For more details, see the documentation on [settings files](https://github.com/vibe-bti/vibe-code-action/blob/main/docs/cli/configuration.md#settings-files).

- <a name="__input_use_vibe_code_assist"></a><a href="#user-content-__input_use_vibe_code_assist"><code>use*vibe_code_assist</code></a>: *(Optional, default: `false`)\_ Whether to use Code Assist for Vibe Code model access instead of the default Vibe Code API key.
  For more information, see the [Vibe Code CLI documentation](https://github.com/vibe-bti/vibe-code-action/blob/main/docs/cli/authentication.md).

- <a name="__input_use_vertex_ai"></a><a href="#user-content-__input_use_vertex_ai"><code>use*vertex_ai</code></a>: *(Optional, default: `false`)\_ Whether to use Vertex AI for Vibe Code model access instead of the default Vibe Code API key.
  For more information, see the [Vibe Code CLI documentation](https://github.com/vibe-bti/vibe-code-action/blob/main/docs/cli/authentication.md).

- <a name="__input_extensions"></a><a href="#user-content-__input_extensions"><code>extensions</code></a>: _(Optional)_ A list of Vibe Code CLI extensions to install.

- <a name="__input_upload_artifacts"></a><a href="#user-content-__input_upload_artifacts"><code>upload*artifacts</code></a>: *(Optional, default: `false`)\_ Whether to upload artifacts to the github action.

- <a name="__input_use_pnpm"></a><a href="#user-content-__input_use_pnpm"><code>use*pnpm</code></a>: *(Optional, default: `false`)\_ Whether or not to use pnpm instead of npm to install vibe-code-cli

- <a name="__input_workflow_name"></a><a href="#user-content-__input_workflow_name"><code>workflow*name</code></a>: *(Optional, default: `${{ github.workflow }}`)\_ The GitHub workflow name, used for telemetry purposes.

<!-- END_AUTOGEN_INPUTS -->

### Outputs

<!-- BEGIN_AUTOGEN_OUTPUTS -->

- <a name="__output_summary"></a><a href="#user-content-__output_summary"><code>summary</code></a>: The summarized output from the Vibe Code CLI execution.

- <a name="__output_error"></a><a href="#user-content-__output_error"><code>error</code></a>: The error output from the Vibe Code CLI execution, if any.

<!-- END_AUTOGEN_OUTPUTS -->

### Repository Variables

We recommend setting the following values as repository variables so they can be reused across all workflows. Alternatively, you can set them inline as action inputs in individual workflows or to override repository-level values.

| Name               | Description                                               | Type     | Required | When Required             |
| ------------------ | --------------------------------------------------------- | -------- | -------- | ------------------------- |
| `DEBUG`            | Enables debug logging for the Vibe Code CLI.              | Variable | No       | Never                     |
| `VIBE_CLI_VERSION` | Controls which version of the Vibe Code CLI is installed. | Variable | No       | Pinning the CLI version   |
| `APP_ID`           | GitHub App ID for custom authentication.                  | Variable | No       | Using a custom GitHub App |

To add a repository variable:

1. Go to your repository's **Settings > Secrets and variables > Actions > New variable**.
2. Enter the variable name and value.
3. Save.

For details about repository variables, refer to the [GitHub documentation on variables][variables].

### Secrets

You can set the following secrets in your repository:

| Name              | Description                                   | Required | When Required                              |
| ----------------- | --------------------------------------------- | -------- | ------------------------------------------ |
| `VIBE_API_KEY`    | Your Vibe API key from DashScope.             | Yes      | Required for all workflows that call Vibe. |
| `APP_PRIVATE_KEY` | Private key for your GitHub App (PEM format). | No       | Using a custom GitHub App.                 |

To add a secret:

1. Go to your repository's **Settings > Secrets and variables >Actions > New repository secret**.
2. Enter the secret name and value.
3. Save.

For more information, refer to the [official GitHub documentation on creating and using encrypted secrets][secrets].

## Authentication

This action requires authentication to the GitHub API and optionally to Vibe Code services.

### GitHub Authentication

You can authenticate with GitHub in two ways:

1. **Default `GITHUB_TOKEN`:** For simpler use cases, the action can use the
   default `GITHUB_TOKEN` provided by the workflow.
2. **Custom GitHub App (Recommended):** For the most secure and flexible
   authentication, we recommend creating a custom GitHub App.

For detailed setup instructions for both Vibe and GitHub authentication, go to the
[**Authentication documentation**](./configuration/auth).

## Extensions

The Vibe Code CLI can be extended with additional functionality through extensions.
These extensions are installed from source from their GitHub repositories.

For detailed instructions on how to set up and configure extensions, go to the
[Extensions documentation](../developers/extensions/extension).

## Best Practices

To ensure the security, reliability, and efficiency of your automated workflows, we strongly recommend following our best practices. These guidelines cover key areas such as repository security, workflow configuration, and monitoring.

Key recommendations include:

- **Securing Your Repository:** Implementing branch and tag protection, and restricting pull request approvers.
- **Monitoring and Auditing:** Regularly reviewing action logs and enabling OpenTelemetry for deeper insights into performance and behavior.

For a comprehensive guide on securing your repository and workflows, please refer to our [**Best Practices documentation**](./common-workflow).

## Customization

Create a VIBE.md file in the root of your repository to provide
project-specific context and instructions to [Vibe Code CLI](./common-workflow). This is useful for defining
coding conventions, architectural patterns, or other guidelines the model should
follow for a given repository.

## Contributing

Contributions are welcome! Check out the Vibe Code CLI **Contributing Guide** for more details on how to get started.

[secrets]: https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions

[Vibe Code]: https://github.com/vibe-bti/vibe-code [DashScope]: https://dashscope.console.aliyun.com/apiKey
[Vibe Code CLI]: https://github.com/vibe-bti/vibe-code-action/
[variables]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables#creating-configuration-variables-for-a-repository
[GitHub CLI]: https://docs.github.com/en/github-cli/github-cli
[VIBE.md]: https://github.com/vibe-bti/vibe-code-action/blob/main/docs/cli/configuration.md#context-files-hierarchical-instructional-context
