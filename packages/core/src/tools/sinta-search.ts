/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';

/**
 * Parameters for the JournalSintaSearch tool
 */
export interface JournalSintaSearchParams {
  /**
   * The search query for journals (e.g., "sistem informasi")
   */
  query: string;
  /**
   * Number of pages to scrape (default: 1)
   */
  maxPages?: number;
  /**
   * Directly scrape a journal profile by its URL
   */
  profile_url?: string;
  /**
   * If true, fetches full details for each journal in search results (warning: slow)
   */
  fullDetail?: boolean;
}

/**
 * Metrics for a journal
 */
export interface JournalMetrics {
  impact?: number;
  h5_index?: number;
  citations_5yr?: number;
  citations?: number;
  google_citations?: number;
  current_accreditation?: string;
}

/**
 * Accreditation history item
 */
export interface AccreditationHistory {
  year: number;
  level: string;
}

/**
 * Article data
 */
export interface SintaArticle {
  title: string;
  url: string | null;
  author_affiliation: string | null;
  publication: string | null;
  journal_name?: string;
  year: number | null;
  doi: string | null;
  article_accreditation: string | null;
}

/**
 * Google Scholar citation stats
 */
export interface GSCitationStats {
  citations?: { all: number; since_2021: number };
  h_index?: { all: number; since_2021: number };
  i10_index?: { all: number; since_2021: number };
}

/**
 * Citation per year
 */
export interface CitationPerYear {
  year: number;
  citations: number;
}

/**
 * Journal data from SINTA
 */
export interface SintaJournal {
  title: string;
  profile_url: string | null;
  google_scholar_url: string | null;
  website_url: string | null;
  editor_url: string | null;
  affiliation_name: string | null;
  affiliation_url: string | null;
  p_issn: string | null;
  e_issn: string | null;
  subject_area: string | null;
  accreditation_level: string | null;
  is_scopus_indexed: boolean;
  is_garuda_indexed: boolean;
  metrics: JournalMetrics;
  cover_image_url: string | null;
  // Full details (optional)
  accreditation_history?: AccreditationHistory[];
  articles?: SintaArticle[];
  gs_citation_stats?: GSCitationStats;
  citation_per_year?: CitationPerYear[] | null;
  garuda_url?: string | null;
}

/**
 * Implementation of the JournalSintaSearch tool invocation
 */
class JournalSintaSearchInvocation extends BaseToolInvocation<
  JournalSintaSearchParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(params: JournalSintaSearchParams) {
    super(params);
    this.debugLogger = createDebugLogger('SINTA_SEARCH');
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const {
      query,
      profile_url,
      maxPages = 1,
      fullDetail = false,
    } = this.params;

    if (profile_url) {
      this.debugLogger.debug(`Scraping profile: ${profile_url}`);
      try {
        const profileData = await this.fetchAndExtractProfile(
          profile_url,
          signal,
        );
        return {
          llmContent: JSON.stringify(profileData, null, 2),
          returnDisplay: `Successfully scraped profile for ${profileData.title || profile_url}.`,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          llmContent: `Error scraping profile: ${msg}`,
          returnDisplay: `Error scraping profile: ${msg}`,
        };
      }
    }

    if (!query) {
      return {
        llmContent: 'Error: Either "query" or "profile_url" must be provided.',
        returnDisplay:
          'Error: Either "query" or "profile_url" must be provided.',
      };
    }

    const queries = this.getQueryVariations(query);
    this.debugLogger.debug(`Expanded queries: ${queries.join(', ')}`);

    try {
      const searchTasks = queries.map((q) =>
        this.performSearch(q, maxPages, signal),
      );
      const searchResults = await Promise.all(searchTasks);

      // Merge and deduplicate
      const journalMap = new Map<string, SintaJournal>();
      for (const results of searchResults) {
        for (const journal of results) {
          const key = journal.profile_url || journal.title;
          if (!journalMap.has(key)) {
            journalMap.set(key, journal);
          }
        }
      }

      const allJournals = Array.from(journalMap.values());

      // Fetch full details if requested
      if (fullDetail) {
        this.debugLogger.debug(
          `Fetching full details for ${allJournals.length} journals...`,
        );
        // Process in chunks to avoid overwhelming
        const chunkSize = 3;
        for (let i = 0; i < allJournals.length; i += chunkSize) {
          if (signal.aborted) break;
          const chunk = allJournals.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (journal) => {
              if (journal.profile_url) {
                try {
                  const details = await this.fetchAndExtractProfile(
                    journal.profile_url,
                    signal,
                  );
                  Object.assign(journal, details);
                } catch (_e) {
                  this.debugLogger.warn(
                    `Failed to fetch details for ${journal.title}`,
                  );
                }
              }
            }),
          );
          // Small delay between chunks
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      const result = {
        metadata: {
          timestamp: new Date().toISOString(),
          search_query: query,
          expanded_queries: queries,
          total_journals_found: allJournals.length,
        },
        journals: allJournals,
      };

      return {
        llmContent: JSON.stringify(result, null, 2),
        returnDisplay: `Successfully found ${allJournals.length} unique journals for query variations.`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.debugLogger.error(`SINTA Search failed: ${msg}`);
      return {
        llmContent: `Error during SINTA search: ${msg}`,
        returnDisplay: `Error during SINTA search: ${msg}`,
      };
    }
  }

  private getQueryVariations(query: string): string[] {
    const variations = new Set<string>();
    variations.add(query);

    const parts = query.split(/\s+/).filter((p) => p.length > 2);
    if (parts.length > 1) {
      // Add individual words
      parts.forEach((p) => variations.add(p));
      // Add pairs if any
      for (let i = 0; i < parts.length - 1; i++) {
        variations.add(`${parts[i]} ${parts[i + 1]}`);
      }
    }

    return Array.from(variations).slice(0, 5); // Limit to 5 queries
  }

  private async performSearch(
    query: string,
    maxPages: number,
    signal: AbortSignal,
  ): Promise<SintaJournal[]> {
    const baseUrl = 'https://sinta.kemdiktisaintek.go.id/journals/';
    const journals: SintaJournal[] = [];
    let totalPages = 1;

    for (let page = 1; page <= maxPages; page++) {
      if (signal.aborted) break;

      const url = `${baseUrl}?q=${encodeURIComponent(query)}&page=${page}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
        signal,
      });

      const $ = cheerio.load(response.data);

      if (page === 1) {
        const pagination = this.extractPaginationInfo($);
        totalPages = pagination.total_pages || 1;
      }

      const pageJournals = this.extractJournalsFromPage($);
      journals.push(...pageJournals);

      if (page >= totalPages) break;

      if (page < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return journals;
  }

  private extractJournalsFromPage($: cheerio.CheerioAPI): SintaJournal[] {
    const journals: SintaJournal[] = [];

    $('.list-item').each((_, element) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const journal: any = {};

      const nameEl = $(element).find('.affil-name a');
      journal.title = nameEl.text().trim();
      journal.profile_url = nameEl.attr('href')
        ? 'https://sinta.kemdiktisaintek.go.id' + nameEl.attr('href')
        : null;

      const extLinks = $(element).find('.affil-abbrev a');
      journal.google_scholar_url =
        extLinks.eq(0).attr('href') !== '#'
          ? extLinks.eq(0).attr('href')
          : null;
      journal.website_url =
        extLinks.eq(1).attr('href') !== '#'
          ? extLinks.eq(1).attr('href')
          : null;
      journal.editor_url =
        extLinks.eq(2).attr('href') !== '#'
          ? extLinks.eq(2).attr('href')
          : null;

      const affilEl = $(element).find('.affil-loc a');
      journal.affiliation_name = affilEl.text().trim() || null;
      journal.affiliation_url = affilEl.attr('href')
        ? 'https://sinta.kemdiktisaintek.go.id' + affilEl.attr('href')
        : null;

      const profileText = $(element).find('.profile-id').text();
      journal.p_issn = this.extractIssn(profileText, 'P-ISSN');
      journal.e_issn = this.extractIssn(profileText, 'E-ISSN');
      journal.subject_area = this.extractSubjectArea(profileText);

      journal.accreditation_level = this.extractAccreditationLevel($(element));
      journal.is_scopus_indexed = $(element).find('.scopus-indexed').length > 0;
      journal.is_garuda_indexed = $(element).find('.garuda-indexed').length > 0;

      journal.metrics = this.extractMetrics($, $(element));

      const coverImg = $(element).find('.journal-cover').attr('src');
      journal.cover_image_url =
        coverImg && !coverImg.includes('cover-journal-big') ? coverImg : null;

      if (journal.title) {
        journals.push(journal as SintaJournal);
      }
    });

    return journals;
  }

  private async fetchAndExtractProfile(
    url: string,
    signal: AbortSignal,
  ): Promise<Partial<SintaJournal>> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
      signal,
    });

    const $ = cheerio.load(response.data);
    return this.extractJournalProfile($);
  }

  private extractJournalProfile($: cheerio.CheerioAPI): Partial<SintaJournal> {
    const journalData: Partial<SintaJournal> = {
      metrics: {},
      accreditation_history: [],
      articles: [],
      gs_citation_stats: {},
      citation_per_year: [],
    };

    // ========== 1. BASIC JOURNAL INFORMATION ==========
    journalData.title = $('.univ-name h3').text().trim();

    const coverImg = $('.univ-logo-main').attr('src');
    journalData.cover_image_url =
      coverImg && !coverImg.includes('cover-journal-big') ? coverImg : null;

    journalData.affiliation_name = $('.affil-loc').first().text().trim();

    const issnText = $('.affil-code').text();
    const pIssnMatch = issnText.match(/P-ISSN\s*:\s*(\d+)/i);
    const eIssnMatch = issnText.match(/E-ISSN\s*:\s*(\d+)/i);
    journalData.p_issn = pIssnMatch ? pIssnMatch[1] : null;
    journalData.e_issn = eIssnMatch ? eIssnMatch[1] : null;

    const subjectMatch = issnText.match(/Subject Area\s*:\s*(.+?)(?:\n|$)/i);
    journalData.subject_area = subjectMatch ? subjectMatch[1].trim() : null;

    // ========== 2. METRICS CARDS ==========
    $('.stat-card .card').each((_, card) => {
      const statNum = $(card).find('.stat-num').text().trim();
      const statText = $(card).find('.stat-text').text().trim();

      if (statText === 'Impact') {
        journalData.metrics!.impact = parseFloat(statNum) || 0;
      } else if (statText === 'Google Citations') {
        journalData.metrics!.google_citations =
          parseInt(statNum.replace(/\./g, ''), 10) || 0;
      } else if (statText === 'Current Acreditation') {
        journalData.metrics!.current_accreditation = statNum;
      }
    });

    // ========== 3. ACCREDITATION HISTORY ==========
    const historyYears: string[] = [];
    const historyLevels: string[] = [];

    $('table.table td.text-center small').each((_, el) => {
      historyYears.push($(el).text().trim());
    });

    $('table.table td[class*="bg-s"]').each((_, el) => {
      const classAttr = $(el).attr('class');
      const levelMatch = classAttr?.match(/bg-(s\d+)/i);
      if (levelMatch) {
        historyLevels.push(levelMatch[1].toUpperCase());
      }
    });

    for (let i = 0; i < historyYears.length && i < historyLevels.length; i++) {
      if (historyYears[i] && historyLevels[i]) {
        journalData.accreditation_history!.push({
          year: parseInt(historyYears[i], 10),
          level: historyLevels[i],
        });
      }
    }

    // ========== 4. EXTERNAL LINKS ==========
    $('.affil-loc.text-center a').each((_, link) => {
      const href = $(link).attr('href');
      const text = $(link).text().trim();

      if (text.includes('Google Scholar')) {
        journalData.google_scholar_url = href || null;
      } else if (text.includes('Garuda')) {
        journalData.garuda_url = href || null;
      } else if (text.includes('Website')) {
        journalData.website_url = href || null;
      } else if (text.includes('Editor URL')) {
        journalData.editor_url = href || null;
      }
    });

    // ========== 5. ARTICLES ==========
    $('.ar-list-item').each((_, article) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const articleData: any = {};

      const titleLink = $(article).find('.ar-title a');
      articleData.title = titleLink.text().trim();
      articleData.url = titleLink.attr('href') || null;

      const authorAffil = $(article).find('.ar-meta:first-child a:first-child');
      articleData.author_affiliation = authorAffil.text().trim();

      const pubInfo = $(article).find('.ar-pub').text().trim();
      articleData.publication = pubInfo;

      const pubMatch = pubInfo.match(/(.+?)(?:\s+Vol\.|\()/);
      if (pubMatch) {
        articleData.journal_name = pubMatch[1].trim();
      }

      const yearEl = $(article).find('.ar-year');
      const yearMatch = yearEl.text().match(/(\d{4})/);
      articleData.year = yearMatch ? parseInt(yearMatch[1], 10) : null;

      const doiEl = $(article).find('.ar-cited');
      const doiMatch = doiEl.text().match(/DOI:\s*(.+)/i);
      articleData.doi = doiMatch ? doiMatch[1].trim() : null;

      const quartileEl = $(article).find('.ar-quartile');
      const accMatch = quartileEl.text().match(/Accred\s*:\s*(.+)/i);
      articleData.article_accreditation = accMatch ? accMatch[1].trim() : null;

      journalData.articles!.push(articleData as SintaArticle);
    });

    // ========== 6. GOOGLE SCHOLAR CITATION STATS ==========
    $('.card.bg-card-simple table.table tbody tr').each((_, row) => {
      const label = $(row).find('td:first-child').text().trim();
      const allValue = $(row).find('td:nth-child(2)').text().trim();
      const since2021Value = $(row).find('td:nth-child(3)').text().trim();

      if (label === 'Citation') {
        journalData.gs_citation_stats!.citations = {
          all: parseInt(allValue.replace(/\./g, ''), 10) || 0,
          since_2021: parseInt(since2021Value.replace(/\./g, ''), 10) || 0,
        };
      } else if (label === 'h-index') {
        journalData.gs_citation_stats!.h_index = {
          all: parseInt(allValue, 10) || 0,
          since_2021: parseInt(since2021Value, 10) || 0,
        };
      } else if (label === 'i10-index') {
        journalData.gs_citation_stats!.i10_index = {
          all: parseInt(allValue, 10) || 0,
          since_2021: parseInt(since2021Value, 10) || 0,
        };
      }
    });

    // ========== 7. CITATION PER YEAR (from chart data) ==========
    const scriptContent = $(
      'script:contains("option_gs_citation_peryear")',
    ).html();
    if (scriptContent) {
      const yearsExtract = scriptContent.match(
        /xAxis:\s*\{\s*type:\s*'category',\s*data:\s*\[([^\]]+)\]/s,
      );
      const valuesExtract = scriptContent.match(
        /series:\s*\[\s*\{\s*data:\s*\[([^\]]+)\]/s,
      );

      if (yearsExtract && valuesExtract) {
        const years = yearsExtract[1]
          .split(',')
          .map((y) => y.trim().replace(/['"]/g, ''))
          .filter((y) => y && !isNaN(parseInt(y, 10)));

        const values = valuesExtract[1]
          .split(',')
          .map((v) => parseInt(v.trim(), 10) || 0);

        for (let i = 0; i < years.length && i < values.length; i++) {
          if (years[i] && !isNaN(parseInt(years[i], 10))) {
            journalData.citation_per_year!.push({
              year: parseInt(years[i], 10),
              citations: values[i],
            });
          }
        }
      }
    }

    return journalData;
  }

  private extractIssn(text: string, type: string): string | null {
    const regex = new RegExp(`${type}\\s*:\\s*(\\d+)`, 'i');
    const match = text.match(regex);
    return match ? match[1] : null;
  }

  private extractSubjectArea(text: string): string | null {
    const match = text.match(/Subject Area\s*:\s*(.+?)(?:\n|$)/i);
    return match ? match[1].trim() : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractAccreditationLevel(el: cheerio.Cheerio<any>): string | null {
    const accText = el.find('.accredited').text();
    const match = accText.match(/(S\d+)/);
    return match ? match[0] : null;
  }

  private extractMetrics(
    $: cheerio.CheerioAPI,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    el: cheerio.Cheerio<any>,
  ): JournalMetrics {
    const metrics: JournalMetrics = {};
    el.find('.stat-profile .row .pr-ic').each((_, ic) => {
      const parent = $(ic).parent();
      const value = parent.find('.pr-num').text().trim();
      const label = parent.find('.pr-txt').text().trim();

      if (label === 'Impact') metrics.impact = parseFloat(value) || 0;
      if (label === 'H5-index') metrics.h5_index = parseInt(value, 10) || 0;
      if (label === 'Citations 5yr')
        metrics.citations_5yr = parseInt(value.replace(/\./g, ''), 10) || 0;
      if (label === 'Citations')
        metrics.citations = parseInt(value.replace(/\./g, ''), 10) || 0;
    });
    return metrics;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractPaginationInfo($: cheerio.CheerioAPI): any {
    const paginationText = $('.pagination-text small').text();
    const pageMatch = paginationText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
    const totalMatch = paginationText.match(/Total Records\s+(\d+)/i);

    return {
      current_page: pageMatch ? parseInt(pageMatch[1], 10) : 1,
      total_pages: pageMatch ? parseInt(pageMatch[2], 10) : 1,
      total_records: totalMatch ? parseInt(totalMatch[1], 10) : 0,
    };
  }

  override getDescription(): string {
    return `Searching SINTA journals for query "${this.params.query}" (max pages: ${this.params.maxPages ?? 1})`;
  }
}

/**
 * Tool for searching SINTA journals and their accreditation levels
 */
export class JournalSintaSearchTool extends BaseDeclarativeTool<
  JournalSintaSearchParams,
  ToolResult
> {
  static readonly Name = ToolNames.JOURNAL_SINTA_SEARCH;

  constructor() {
    super(
      JournalSintaSearchTool.Name,
      ToolDisplayNames.JOURNAL_SINTA_SEARCH,
      'Searches for journals on SINTA or scrapes a specific journal profile.\n' +
        'Returns journal titles, accreditation levels (S1-S6), history, articles, and citation metrics.\n' +
        'Use "query" to search or "profile_url" to get details for a specific journal.',
      Kind.Fetch,
      {
        properties: {
          query: {
            description: 'The search keyword for journals',
            type: 'string',
          },
          profile_url: {
            description:
              'Direct SINTA profile URL to scrape (e.g. https://sinta.kemdiktisaintek.go.id/journals/profile/123)',
            type: 'string',
          },
          maxPages: {
            default: 1,
            description: 'Maximum number of pages to scrape during search',
            type: 'integer',
          },
          fullDetail: {
            default: false,
            description:
              'If true, fetches full details for each journal in search results (warning: slow)',
            type: 'boolean',
          },
        },
        type: 'object',
      },
    );
  }

  protected override createInvocation(
    params: JournalSintaSearchParams,
  ): ToolInvocation<JournalSintaSearchParams, ToolResult> {
    return new JournalSintaSearchInvocation(params);
  }
}
