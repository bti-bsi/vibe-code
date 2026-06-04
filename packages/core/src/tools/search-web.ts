/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';
import { request } from 'undici';
import type { Config } from '../config/config.js';

const SERPAPI_URL = 'https://serpapi.com/search';

/**
 * Parameters for the SearchWeb tool
 */
export interface SearchWebParams {
  query: string;
  count?: number;
  location?: string;
  google_domain?: string;
  hl?: string;
  gl?: string;
  apiKey?: string;
}

/**
 * Search result structure
 */
interface SerpApiOrganicResult {
  title?: string;
  link?: string;
  displayed_link?: string;
  snippet?: string;
  source?: string;
  date?: string;
}

interface SerpApiResponse {
  search_metadata?: { status?: string };
  error?: string;
  organic_results?: SerpApiOrganicResult[];
}

interface WebSearchResult {
  title: string;
  url: string;
  display_url: string;
  snippet: string;
  source: string;
  date: string | null;
}

function parseSerpApiResults(
  items: SerpApiOrganicResult[],
  limit: number,
): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  for (const item of items) {
    if (results.length >= limit) break;
    const url = item.link ?? '';
    if (!url) continue;

    let source = item.source ?? '';
    if (!source) {
      try {
        source = new URL(url).hostname.replace('www.', '');
      } catch {
        source = item.displayed_link ?? '';
      }
    }

    results.push({
      title: item.title ?? '',
      url,
      display_url: item.displayed_link ?? '',
      snippet: item.snippet
        ? item.snippet.substring(0, 300)
        : 'No description available',
      source,
      date: item.date ?? null,
    });
  }
  return results;
}

/**
 * Implementation of the SearchWeb tool invocation logic
 */
class SearchWebToolInvocation extends BaseToolInvocation<
  SearchWebParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;
  private readonly config?: Config;

  constructor(params: SearchWebParams, config?: Config) {
    super(params);
    this.config = config;
    this.debugLogger = createDebugLogger('SEARCH_WEB');
  }

  getDescription(): string {
    return `Search the web for: ${this.params.query}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    this.debugLogger.debug(`[SearchWebTool] Searching: ${this.params.query}`);

    const results: WebSearchResult[] = [];
    const numResults = this.params.count ?? 10;

    try {
      // Priority: params.apiKey > settings.serper_api (via config) > env var SERPAPI_API_KEY
      const apiKey =
        this.params.apiKey ||
        this.config?.getSerperApiKey() ||
        process.env['SERPAPI_API_KEY'] ||
        '';
      if (!apiKey) {
        return {
          llmContent:
            'SerpAPI key is not configured. ' +
            'Please ask the user to provide their SerpAPI key (obtainable at https://serpapi.com). ' +
            'Once the user provides the key, retry this tool call with it passed as the `apiKey` parameter, ' +
            'or instruct the user to add `"serper_api": "<key>"` to their settings.json.',
          returnDisplay: 'API key required — please provide your SerpAPI key',
        };
      }

      const params = new URLSearchParams({
        engine: 'google',
        q: this.params.query,
        location: this.params.location ?? 'Indonesia',
        google_domain: this.params.google_domain ?? 'google.co.id',
        hl: this.params.hl ?? 'id',
        gl: this.params.gl ?? 'id',
        num: String(numResults),
        api_key: apiKey,
      });

      const searchUrl = `${SERPAPI_URL}?${params.toString()}`;

      const { statusCode, body: responseBody } = await request(searchUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
        bodyTimeout: 15000,
        headersTimeout: 15000,
      });

      if (statusCode !== 200) {
        const errText = await responseBody.text();
        throw new Error(`HTTP ${statusCode}: ${errText.substring(0, 200)}`);
      }

      const json = (await responseBody.json()) as SerpApiResponse;

      if (json.error) {
        throw new Error(`SerpAPI error: ${json.error}`);
      }

      results.push(
        ...parseSerpApiResults(json.organic_results ?? [], numResults),
      );

      const finalJson = {
        search_metadata: {
          query: this.params.query,
          count: results.length,
        },
        results,
      };

      return {
        llmContent: JSON.stringify(finalJson, null, 2),
        returnDisplay: `Found ${results.length} web search results`,
      };
    } catch (error) {
      let errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      let statusCode = 'Unknown';
      let curlVersion = 'Unknown';

      if (error instanceof Error) {
        statusCode = /HTTP (\d+)/.exec(error.message)?.[1] ?? 'Unknown';
        errorMessage = error.message;
      }

      try {
        const { execSync } = await import('node:child_process');
        curlVersion = execSync('curl --version').toString().split('\n')[0];
      } catch {
        curlVersion = 'Failed to get curl version';
      }

      const fullError = `Search failed. ${errorMessage}\nCurl version: ${curlVersion}`;
      this.debugLogger.error(`[SearchWebTool] ${fullError}`, error);

      return {
        llmContent: `Error: ${fullError}`,
        returnDisplay: `Search failed (${statusCode})`,
        error: {
          message: fullError,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

/**
 * SearchWebTool implementation
 */
export class SearchWebTool extends BaseDeclarativeTool<
  SearchWebParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.SEARCH_WEB;
  private readonly config?: Config;

  constructor(config?: Config) {
    super(
      SearchWebTool.Name,
      ToolDisplayNames.SEARCH_WEB || 'Search Web',
      `Search the web using Google via SerpAPI. Configure the API key via /config (serperApiKey) or SERPAPI_API_KEY environment variable.

Tool Name: search_web
Parameters:
- query (string): Search query
- count (number): Number of results (default: 10)
- location (string): Location for search context (default: Indonesia)
- google_domain (string): Google domain to use (default: google.co.id)
- hl (string): Language code (default: id)
- gl (string): Country code (default: id)
- apiKey (string): SerpAPI key. Optional if configured in settings.`,
      Kind.Search,
      {
        properties: {
          query: { description: 'Search query', type: 'string' },
          count: {
            description: 'Number of results (default: 10)',
            type: 'number',
          },
          location: {
            description: 'Location for search context (default: Indonesia)',
            type: 'string',
          },
          google_domain: {
            description: 'Google domain to use (default: google.co.id)',
            type: 'string',
          },
          hl: { description: 'Language code (default: id)', type: 'string' },
          gl: { description: 'Country code (default: id)', type: 'string' },
          apiKey: {
            description: 'SerpAPI key. Optional if configured in settings.',
            type: 'string',
          },
        },
        required: ['query'],
        type: 'object',
      },
      true,
      false,
    );
    this.config = config;
  }

  protected createInvocation(
    params: SearchWebParams,
  ): ToolInvocation<SearchWebParams, ToolResult> {
    return new SearchWebToolInvocation(params, this.config);
  }
}
