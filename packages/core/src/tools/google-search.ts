/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import https from 'node:https';
import type { Config } from '../config/config.js';

interface GoogleSearchItem {
  title: string;
  snippet: string;
  link: string;
}

interface GoogleSearchApiResponse {
  error?: { message: string; code: number };
  items?: Array<{
    title: string;
    snippet: string;
    link: string;
  }>;
}

class GoogleSearchInvocation extends BaseToolInvocation<
  { query: string },
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: { query: string },
  ) {
    super(params);
  }

  getDescription(): string {
    return `Performing Google Search for: "${this.params.query}"`;
  }

  async execute(): Promise<ToolResult> {
    const apiKey = this.config.getGoogleSearchApiKey();
    const cx = this.config.getGoogleSearchCx();

    if (!apiKey || !cx) {
      return {
        llmContent:
          'Configuration error: Google Search API Key or CX is not set. Please configure google_search_api_key and google_search_cx in your settings.',
        returnDisplay:
          'Error: Google Search API Key or CX is not configured. Use /config > Google Search API to set them.',
        error: {
          type: ToolErrorType.CONFIG_ERROR,
          message: 'Google Search API Key or CX is not configured.',
        },
      };
    }

    return new Promise((resolve) => {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(this.params.query)}`;
      https
        .get(url, (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => (data += chunk.toString()));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data) as GoogleSearchApiResponse;
              if (parsed.error) {
                resolve({
                  llmContent: parsed.error.message,
                  returnDisplay: `Google Search error: ${parsed.error.message}`,
                  error: {
                    type: ToolErrorType.EXTERNAL_SERVICE_ERROR,
                    message: parsed.error.message,
                  },
                });
                return;
              }

              const items: GoogleSearchItem[] = (parsed.items ?? []).map(
                (i) => ({
                  title: i.title,
                  snippet: i.snippet,
                  link: i.link,
                }),
              );

              if (items.length === 0) {
                const msg = `No results found for "${this.params.query}".`;
                resolve({ llmContent: msg, returnDisplay: msg });
                return;
              }

              const text = JSON.stringify(items, null, 2);
              resolve({
                llmContent: text,
                returnDisplay: `Found ${items.length} result(s) for "${this.params.query}".\n${text}`,
              });
            } catch {
              const msg = 'Failed to parse Google Search response.';
              resolve({
                llmContent: msg,
                returnDisplay: `Error: ${msg}`,
                error: {
                  type: ToolErrorType.EXTERNAL_SERVICE_ERROR,
                  message: msg,
                },
              });
            }
          });
        })
        .on('error', (e: Error) => {
          resolve({
            llmContent: e.message,
            returnDisplay: `Network error: ${e.message}`,
            error: {
              type: ToolErrorType.EXTERNAL_SERVICE_ERROR,
              message: e.message,
            },
          });
        });
    });
  }
}

export class GoogleSearchTool extends BaseDeclarativeTool<
  { query: string },
  ToolResult
> {
  static readonly Name: string = ToolNames.GOOGLE_SEARCH;

  constructor(private readonly config: Config) {
    super(
      ToolNames.GOOGLE_SEARCH,
      ToolDisplayNames.GOOGLE_SEARCH,
      'Performs a web search using Google Custom Search API. Returns titles, snippets, and URLs of matching pages.',
      Kind.Search,
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query string.',
          },
        },
        required: ['query'],
      },
    );
  }

  protected createInvocation(params: {
    query: string;
  }): ToolInvocation<{ query: string }, ToolResult> {
    return new GoogleSearchInvocation(this.config, params);
  }
}
