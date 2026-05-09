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
import https from 'node:https';
import zlib from 'node:zlib';

const SCOPUS_API_BASE_URL = 'https://api.elsevier.com/content/search/scopus';
const SCOPUS_API_TIMEOUT_MS = 30000;
const DEFAULT_COUNT = 10;
const MAX_COUNT = 25;

/**
 * Firefox-like User-Agent string for robust HTTP requests.
 * Many academic publisher servers block requests without a browser-like UA.
 */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0';

/**
 * Decompresses gzip/br/deflate encoded response body.
 */
function decompressBody(body: Buffer, encoding: string | undefined): string {
  if (!encoding) return body.toString('utf-8');

  try {
    if (encoding.includes('br')) {
      return zlib.brotliDecompressSync(body).toString('utf-8');
    }
    if (encoding.includes('gzip')) {
      return zlib.gunzipSync(body).toString('utf-8');
    }
    if (encoding.includes('deflate')) {
      return zlib.inflateSync(body).toString('utf-8');
    }
  } catch {
    // Fallback to raw body if decompression fails
  }
  return body.toString('utf-8');
}

/**
 * Makes a GET request to the Scopus API using native https module.
 * Uses browser-like headers to avoid being blocked by the API server.
 */
async function scopusGet(
  url: string,
  apiKey: string,
  timeoutMs: number = SCOPUS_API_TIMEOUT_MS,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/json',
          'X-ELS-APIKey': apiKey,
          'User-Agent': BROWSER_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          clearTimeout(timer);
          const fullBuffer = Buffer.concat(chunks);
          const contentEncoding = res.headers['content-encoding'];
          const bodyText = decompressBody(fullBuffer, contentEncoding);
          resolve(
            new Response(bodyText, {
              status: res.statusCode || 500,
              statusText: res.statusMessage || '',
              headers: {
                'Content-Type':
                  res.headers['content-type'] || 'application/json',
              },
            }),
          );
        });
      },
    );

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      clearTimeout(timer);
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
  });
}

/**
 * Parses authors from various Scopus response formats.
 */
function parseAuthors(creator: unknown): string {
  if (!creator) return 'Unknown authors';

  if (Array.isArray(creator)) {
    const names = creator
      .map((a: string | { $?: string }) =>
        typeof a === 'string' ? a : a?.['$'],
      )
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Unknown authors';
  }

  if (typeof creator === 'string') {
    return creator;
  }

  if (typeof creator === 'object') {
    const c = creator as Record<string, unknown>;
    if (Array.isArray(c['text-item'])) {
      const names = (c['text-item'] as Array<{ $?: string }>)
        .map((a) => a['$'])
        .filter(Boolean);
      return names.length > 0 ? names.join(', ') : 'Unknown authors';
    }
    if (c['$'] && typeof c['$'] === 'string') {
      return c['$'];
    }
  }

  return 'Unknown authors';
}

/**
 * Parameters for the ScopusSearch tool
 */
export interface ScopusSearchParams {
  /**
   * The search query using Scopus boolean logic
   * Examples: "machine learning", "TITLE-ABS-KEY(artificial intelligence)", "authlname(Einstein)"
   */
  query: string;
  /**
   * Scopus API key for authentication
   * Get one from https://dev.elsevier.com/
   */
  apiKey: string;
  /**
   * Maximum number of results to return (default: 10, max: 25)
   */
  count?: number;
  /**
   * Starting offset for pagination (default: 0)
   */
  start?: number;
  /**
   * Sort order for results
   * Default: -coverDate (newest papers first)
   * Options: relevancy, coverDate, citedby-count, creator, publicationName, pubyear
   * Prefix with + for ascending, - for descending
   */
  sort?: string;
}

/**
 * Scopus search result entry
 */
interface ScopusSearchResult {
  'dc:identifier': string;
  'prism:url': string;
  'dc:title': string;
  'dc:creator'?: unknown;
  'prism:publicationName': string;
  'prism:coverDate': string;
  'prism:doi': string;
  'citedby-count': string;
  link: Array<{
    '@_ref': string;
    '@_href': string;
    '@_type': string;
  }>;
}

/**
 * Scopus API search response structure
 */
interface ScopusSearchResponse {
  'search-results'?: {
    'opensearch:totalResults'?: string;
    entry?: ScopusSearchResult[];
  };
}

/**
 * Implementation of the ScopusSearch tool invocation logic
 */
class ScopusSearchToolInvocation extends BaseToolInvocation<
  ScopusSearchParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(params: ScopusSearchParams) {
    super(params);
    this.debugLogger = createDebugLogger('SCOPUS_SEARCH');
  }

  getDescription(): string {
    return `Search Scopus for: ${this.params.query}`;
  }

  private buildQueryUrl(): string {
    const params = new URLSearchParams();
    params.set('query', this.params.query);
    params.set(
      'count',
      String(Math.min(this.params.count ?? DEFAULT_COUNT, MAX_COUNT)),
    );
    params.set('start', String(this.params.start ?? 0));
    params.set('httpAccept', 'application/json');

    // Default to newest papers first
    const sort = this.params.sort || '-coverDate';
    params.set('sort', sort);

    return `${SCOPUS_API_BASE_URL}?${params.toString()}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const queryUrl = this.buildQueryUrl();

    this.debugLogger.debug(
      `[ScopusSearchTool] Searching Scopus: ${this.params.query}`,
    );

    try {
      const response = await scopusGet(
        queryUrl,
        this.params.apiKey,
        SCOPUS_API_TIMEOUT_MS,
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Scopus API request failed with status ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson?.['service-error']?.['status']?.[0]) {
            const status = errorJson['service-error']['status'][0];
            errorMessage = `Scopus API error: ${status['statusText']} - ${status['statusDescription'] || status['message'] || 'Unknown error'}`;
          }
        } catch {
          errorMessage += `: ${errorText.substring(0, 200)}`;
        }

        this.debugLogger.error(`[ScopusSearchTool] ${errorMessage}`);

        return {
          llmContent: `Error searching Scopus: ${errorMessage}`,
          returnDisplay: `Scopus search failed: ${response.status}`,
          error: {
            type: ToolErrorType.SCOPE_SEARCH_FAILED,
            message: errorMessage,
          },
        };
      }

      const data = await response.json();
      this.debugLogger.debug(
        `[ScopusSearchTool] Successfully fetched Scopus results`,
      );

      return this.formatSearchResults(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during Scopus search';

      this.debugLogger.error(`[ScopusSearchTool] ${errorMessage}`, error);

      return {
        llmContent: `Error searching Scopus: ${errorMessage}`,
        returnDisplay: `Scopus search failed: ${errorMessage}`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: errorMessage,
        },
      };
    }
  }

  private formatSearchResults(data: ScopusSearchResponse): ToolResult {
    const searchResults = data?.['search-results'];
    if (!searchResults) {
      return {
        llmContent: 'No search results found in Scopus response',
        returnDisplay: 'No results found',
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: 'Invalid Scopus response structure',
        },
      };
    }

    const totalResults = parseInt(
      searchResults['opensearch:totalResults'] || '0',
      10,
    );
    const items = searchResults.entry || [];

    if (items.length === 0) {
      return {
        llmContent: `Scopus search returned 0 results. Total matches in database: ${totalResults}`,
        returnDisplay: `No results found (total matches: ${totalResults})`,
      };
    }

    const results: string[] = [];
    results.push(`# Scopus Search Results`);
    results.push(`**Total results:** ${totalResults}`);
    results.push(`**Showing:** ${items.length} results`);
    results.push(`**Query:** ${this.params.query}`);
    results.push(
      `**Abstracts:** Not included (use scopus_abstract_pdf tool to fetch)`,
    );
    results.push('');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const title = item['dc:title'] || 'No title';
      const authors = parseAuthors(item['dc:creator']);
      const publication = item['prism:publicationName'] || '';
      const coverDate = item['prism:coverDate'] || '';
      const year = coverDate ? coverDate.substring(0, 4) : '';
      const citedBy = item['citedby-count'] || '0';
      const doi = item['prism:doi'] || '';

      const escapedAuthors = authors.replace(/\|/g, '\\|');
      const escapedPublication = publication.replace(/\|/g, '\\|');

      results.push(`### ${i + 1}. ${title}`);
      results.push('');
      results.push(`**Penulis:** ${escapedAuthors}`);
      results.push('');
      results.push(`**Tahun:** ${year}`);
      results.push('');
      results.push(`**Publisher:** ${escapedPublication}`);
      results.push('');
      results.push(`**Sitasi:** ${citedBy}`);
      results.push('');
      if (doi) {
        results.push(`**DOI:** [${doi}](https://doi.org/${doi})`);
        results.push('');
      }
      results.push('---');
      results.push('');
    }

    return {
      llmContent: results.join('\n'),
      returnDisplay: `Found ${items.length} results (total: ${totalResults})`,
    };
  }
}

/**
 * Implementation of the ScopusSearch tool logic
 */
export class ScopusSearchTool extends BaseDeclarativeTool<
  ScopusSearchParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.SCOPUS_SEARCH;

  constructor() {
    super(
      ScopusSearchTool.Name,
      ToolDisplayNames.SCOPUS_SEARCH,
      'Search Scopus database for academic papers by title, abstract, keywords, or author\n- Takes a search query and API key as input\n- Searches the Scopus academic database\n- Returns paper titles, authors, publication info, citations, and DOI links\n- Supports boolean queries and field-specific searches\n- Returns results in card-like markdown format with sequential numbering\n- Default sort: newest papers first (-coverDate)\n- Use this tool when you need to find academic literature\n- To fetch abstracts and PDF links, use the scopus_abstract_pdf tool with DOI links from search results\n\nUsage notes:\n  - You MUST have a valid Scopus API key from https://dev.elsevier.com/\n  - Default returns 10 results, max 25 per request\n  - Query examples:\n    - "machine learning" (searches title/abstract/keywords)\n    - "TITLE-ABS-KEY(artificial intelligence)"\n    - "authlname(Einstein)" (search by author)\n    - "machine learning AND deep learning" (boolean)\n  - Sort options: relevancy, coverDate, citedby-count, creator, publicationName, pubyear (default: -coverDate)\n  - Results table format include: No., title, authors, year, publisher, citations, DOI link',
      Kind.Read,
      {
        properties: {
          query: {
            description:
              'The search query using Scopus boolean logic. Examples: "machine learning", "TITLE-ABS-KEY(artificial intelligence)", "authlname(Einstein)"',
            type: 'string',
          },
          apiKey: {
            description:
              'Scopus API key for authentication. Get one from https://dev.elsevier.com/',
            type: 'string',
          },
          count: {
            description:
              'Maximum number of results to return (default: 10, max: 25)',
            type: 'number',
          },
          start: {
            description: 'Starting offset for pagination (default: 0)',
            type: 'number',
          },
          sort: {
            description:
              'Sort order: relevancy, coverDate, citedby-count, creator, publicationName, pubyear. Default: -coverDate (newest first). Prefix with + for ascending, - for descending',
            type: 'string',
          },
        },
        required: ['query', 'apiKey'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: ScopusSearchParams,
  ): string | null {
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    if (!params.apiKey || params.apiKey.trim() === '') {
      return "The 'apiKey' parameter cannot be empty. Get a free API key from https://dev.elsevier.com/";
    }
    if (
      params.count !== undefined &&
      (params.count < 1 || params.count > MAX_COUNT)
    ) {
      return `The 'count' parameter must be between 1 and ${MAX_COUNT}.`;
    }
    if (params.start !== undefined && params.start < 0) {
      return "The 'start' parameter must be a non-negative number.";
    }
    return null;
  }

  protected createInvocation(
    params: ScopusSearchParams,
  ): ToolInvocation<ScopusSearchParams, ToolResult> {
    return new ScopusSearchToolInvocation(params);
  }
}
