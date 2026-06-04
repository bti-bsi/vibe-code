/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { ToolErrorType } from './tool-error.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';

const SOURCE_DOMAINS = ['https://beallslist.net', 'https://beallslist.com'];
const SOURCE_PAGES = [
  { path: '/', category: 'publisher' },
  { path: '/standalone-journals/', category: 'standalone_journal' },
  { path: '/hijacked-journals/', category: 'hijacked_journal' },
] as const;

type BeallsCategory = (typeof SOURCE_PAGES)[number]['category'];
type BeallsListType = 'original_list' | 'update_list';

export interface BeallsListParams {
  /**
   * Journal or publisher name to check. Partial names are accepted.
   */
  query?: string;
  /**
   * Multiple journal or publisher names to check in one call.
   */
  journals?: string[];
  /**
   * Maximum matches to return. Defaults to 25.
   */
  maxResults?: number;
}

interface BeallsEntry {
  name: string;
  url: string | null;
  category: BeallsCategory;
  list_type: BeallsListType;
  source_page: string;
  source_domain: string;
}

interface BeallsMatch extends BeallsEntry {
  matched_query: string;
  match_type: 'exact' | 'partial' | 'url';
  score: number;
}

interface BeallsPageResult {
  entries: BeallsEntry[];
  source_page: string;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveUrl(
  href: string | undefined,
  sourcePage: string,
): string | null {
  if (!href) return null;
  try {
    return new URL(href, sourcePage).toString();
  } catch {
    return href;
  }
}

function listTypeFromHeading(text: string): BeallsListType | null {
  const normalized = normalizeText(text);
  if (normalized === 'original list') return 'original_list';
  if (normalized === 'update') return 'update_list';
  return null;
}

function extractEntriesFromHtml(
  html: string,
  sourcePage: string,
  sourceDomain: string,
  category: BeallsCategory,
): BeallsEntry[] {
  const $ = cheerio.load(html);
  const entries: BeallsEntry[] = [];

  $('h2').each((_, heading) => {
    const listType = listTypeFromHeading($(heading).text());
    if (!listType) return;

    $(heading)
      .nextUntil('h2')
      .find('li')
      .each((__, element) => {
        const name = cleanName($(element).text());
        if (!name) return;

        const firstLink = $(element).find('a').first().attr('href');
        entries.push({
          name,
          url: resolveUrl(firstLink, sourcePage),
          category,
          list_type: listType,
          source_page: sourcePage,
          source_domain: sourceDomain,
        });
      });
  });

  return entries;
}

function matchEntry(entry: BeallsEntry, query: string): BeallsMatch | null {
  const normalizedName = normalizeText(entry.name);
  const normalizedQuery = normalizeText(query);
  const normalizedUrl = normalizeText(entry.url ?? '');

  if (!normalizedQuery) return null;

  if (normalizedName === normalizedQuery) {
    return {
      ...entry,
      matched_query: query,
      match_type: 'exact',
      score: 100,
    };
  }

  if (normalizedName.includes(normalizedQuery)) {
    return {
      ...entry,
      matched_query: query,
      match_type: 'partial',
      score: 80,
    };
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (
    queryTokens.length > 1 &&
    queryTokens.every((token) => normalizedName.includes(token))
  ) {
    return {
      ...entry,
      matched_query: query,
      match_type: 'partial',
      score: 60,
    };
  }

  if (normalizedUrl.includes(normalizedQuery)) {
    return {
      ...entry,
      matched_query: query,
      match_type: 'url',
      score: 70,
    };
  }

  return null;
}

function dedupeEntries(entries: BeallsEntry[]): BeallsEntry[] {
  const seen = new Set<string>();
  const unique: BeallsEntry[] = [];

  for (const entry of entries) {
    const key = [
      entry.category,
      entry.list_type,
      normalizeText(entry.name),
      entry.url ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

function dedupeMatches(matches: BeallsMatch[]): BeallsMatch[] {
  const seen = new Set<string>();
  const unique: BeallsMatch[] = [];

  for (const match of matches) {
    const key = [
      normalizeText(match.matched_query),
      match.category,
      match.list_type,
      normalizeText(match.name),
      match.url ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(match);
  }

  return unique;
}

class BeallsListInvocation extends BaseToolInvocation<
  BeallsListParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(params: BeallsListParams) {
    super(params);
    this.debugLogger = createDebugLogger('BEALLS_LIST');
  }

  override getDescription(): string {
    const queries = this.getQueries();
    return `Check Beall's List for: ${queries.join(', ')}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const queries = this.getQueries();
    const maxResults = this.params.maxResults ?? 25;

    if (queries.length === 0) {
      return {
        llmContent: 'Error: Provide "query" or "journals".',
        returnDisplay: 'Error: Provide "query" or "journals".',
        error: {
          message: "Missing Beall's List query.",
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    try {
      const pages = await this.fetchAllPages(signal);
      const entries = dedupeEntries(pages.flatMap((page) => page.entries));
      const matches = dedupeMatches(
        queries.flatMap((query) =>
          entries
            .map((entry) => matchEntry(entry, query))
            .filter((match): match is BeallsMatch => Boolean(match)),
        ),
      )
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, maxResults);

      const result = {
        metadata: {
          timestamp: new Date().toISOString(),
          queries,
          sources_checked: pages.map((page) => page.source_page),
          total_entries_loaded: entries.length,
          total_matches: matches.length,
          note:
            "Beall's List is a potential predatory journals/publishers list. " +
            'A publisher match means journals from that publisher may need ' +
            'additional verification.',
        },
        matches,
      };

      return {
        llmContent: JSON.stringify(result, null, 2),
        returnDisplay:
          matches.length > 0
            ? `Found ${matches.length} Beall's List match(es).`
            : "No Beall's List matches found.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.debugLogger.error(`Beall's List check failed: ${message}`);
      return {
        llmContent: `Error checking Beall's List: ${message}`,
        returnDisplay: `Error checking Beall's List: ${message}`,
        error: {
          message,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }

  private getQueries(): string[] {
    return [...(this.params.journals ?? []), this.params.query ?? '']
      .map((query) => query.trim())
      .filter((query) => query.length > 0);
  }

  private async fetchAllPages(
    signal: AbortSignal,
  ): Promise<BeallsPageResult[]> {
    const results: BeallsPageResult[] = [];
    const errors: string[] = [];

    for (const page of SOURCE_PAGES) {
      let pageLoaded = false;
      for (const domain of SOURCE_DOMAINS) {
        const sourcePage = new URL(page.path, domain).toString();
        try {
          const response = await axios.get<string>(sourcePage, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal,
            timeout: 15000,
          });
          results.push({
            entries: extractEntriesFromHtml(
              response.data,
              sourcePage,
              domain,
              page.category,
            ),
            source_page: sourcePage,
          });
          pageLoaded = true;
          break;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push(`${sourcePage}: ${message}`);
        }
      }

      if (!pageLoaded) {
        this.debugLogger.warn(`Unable to load Beall's page: ${page.path}`);
      }
    }

    if (results.length === 0) {
      throw new Error(
        `Unable to load Beall's List pages. ${errors.join('; ')}`,
      );
    }

    return results;
  }
}

export class BeallsListTool extends BaseDeclarativeTool<
  BeallsListParams,
  ToolResult
> {
  static readonly Name = ToolNames.BEALLS_LIST;

  constructor() {
    super(
      BeallsListTool.Name,
      ToolDisplayNames.BEALLS_LIST,
      "Checks journal or publisher names against Beall's List from beallslist.net/beallslist.com. " +
              'Fetches the current original and update lists, then returns exact, partial, or URL matches.' + `

Tool Name: bealls_list
Parameters:
- query (string): Journal or publisher name to check. Partial names are accepted.
- journals (array): Multiple journal or publisher names to check in one call.
- maxResults (integer): Maximum matches to return.`,
      Kind.Fetch,
      {
        properties: {
          query: {
            description:
              'Journal or publisher name to check. Partial names are accepted.',
            type: 'string',
          },
          journals: {
            description:
              'Multiple journal or publisher names to check in one call.',
            items: { type: 'string' },
            type: 'array',
          },
          maxResults: {
            default: 25,
            description: 'Maximum matches to return.',
            type: 'integer',
          },
        },
        type: 'object',
      },
    );
  }

  protected override createInvocation(
    params: BeallsListParams,
  ): ToolInvocation<BeallsListParams, ToolResult> {
    return new BeallsListInvocation(params);
  }
}

export const testExports = {
  extractEntriesFromHtml,
  matchEntry,
  normalizeText,
};
