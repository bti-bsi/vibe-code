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

const SCOPUS_API_BASE_URL = 'https://api.elsevier.com/content/search/scopus';
const SCOPUS_API_TIMEOUT_MS = 30000;

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0';

interface ScopusEntryResult {
  judul: string;
  tahun: string;
  penulis: string;
  sitasi: number;
  kata_kunci: string[];
  abstrak: string;
}

interface ProcessedEntries {
  daftarArtikel: ScopusEntryResult[];
  penghitungTahun: Record<string, number>;
  penghitungKataKunci: Record<string, number>;
}

function formatPenulis(penulisArray: string[]): string {
  if (penulisArray.length === 0) return 'Penulis tidak diketahui';
  if (penulisArray.length <= 3) return penulisArray.join(', ');
  return `${penulisArray.slice(0, 3).join(', ')} dkk.`;
}

function strVal(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v || fallback;
  if (typeof v === 'number') return String(v);
  return fallback;
}

function processEntries(entries: Array<Record<string, unknown>>): ProcessedEntries {
  const daftarArtikel: ScopusEntryResult[] = [];
  const penghitungTahun: Record<string, number> = {};
  const penghitungKataKunci: Record<string, number> = {};

  for (const item of entries) {
    const judul = strVal(item['dc:title'], 'Tidak ada judul');
    const coverDate = strVal(item['prism:coverDate']);
    const tahun = coverDate ? coverDate.substring(0, 4) : 'Tidak diketahui';
    const sitasi = Number.parseInt(strVal(item['citedby-count'], '0'), 10);
    const abstrakRaw =
      strVal(item['dc:description']) ||
      strVal(item['abstract']) ||
      'Tidak ada abstrak';
    const abstrak =
      abstrakRaw.length > 200
        ? `${abstrakRaw.substring(0, 200)}...`
        : abstrakRaw;

    const penulis = formatPenulis(parseAuthors(item['dc:creator']));

    const daftarKataKunci = strVal(item['authkeywords'])
      .split('|')
      .map((k) => k.trim())
      .filter(Boolean);

    if (tahun !== 'Tidak diketahui') {
      penghitungTahun[tahun] = (penghitungTahun[tahun] || 0) + 1;
    }
    for (const kk of daftarKataKunci) {
      const kkl = kk.toLowerCase();
      penghitungKataKunci[kkl] = (penghitungKataKunci[kkl] || 0) + 1;
    }

    daftarArtikel.push({
      judul,
      tahun,
      penulis,
      sitasi,
      kata_kunci: daftarKataKunci,
      abstrak,
    });
  }

  return { daftarArtikel, penghitungTahun, penghitungKataKunci };
}

function parseAuthors(creator: unknown): string[] {
  if (!creator) return [];

  if (Array.isArray(creator)) {
    const names = creator
      .map((a: string | { $?: string }) =>
        typeof a === 'string' ? a : a?.['$'],
      )
      .filter(Boolean) as string[];
    return names;
  }

  if (typeof creator === 'string') {
    return [creator];
  }

  if (typeof creator === 'object') {
    const c = creator as Record<string, unknown>;
    if (Array.isArray(c['text-item'])) {
      const names = (c['text-item'] as Array<{ $?: string }>)
        .map((a) => a['$'])
        .filter(Boolean) as string[];
      return names;
    }
    if (c['$'] && typeof c['$'] === 'string') {
      return [c['$']];
    }
  }

  return [];
}

export interface ScopusAnalyticTrendParams {
  kataKunci: string;
  apiKey?: string;
  maksHasil?: number;
}

class ScopusAnalyticTrendToolInvocation extends BaseToolInvocation<
  ScopusAnalyticTrendParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;
  private readonly config?: Config;

  constructor(params: ScopusAnalyticTrendParams, config?: Config) {
    super(params);
    this.config = config;
    this.debugLogger = createDebugLogger('SCOPUS_ANALYTIC_TREND');
  }

  getDescription(): string {
    return `Analyze Scopus trends for: ${this.params.kataKunci}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const apiKey = this.params.apiKey || this.config?.getScopusApiKey();

    if (!apiKey) {
      const errorMessage =
        'Scopus API key is missing. Please configure it via the /config command or provide it in the tool parameters.';
      this.debugLogger.error(`[ScopusAnalyticTrendTool] ${errorMessage}`);
      return {
        llmContent: JSON.stringify({ error: errorMessage }),
        returnDisplay: `Scopus analytic failed: Missing API Key`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: errorMessage,
        },
      };
    }

    const { kataKunci, maksHasil = 50 } = this.params;
    const url = new URL(SCOPUS_API_BASE_URL);
    // Explicitly handle kataKunci query to ensure Scopus syntax compatibility
    url.searchParams.set('query', kataKunci);
    url.searchParams.set('count', String(maksHasil));
    url.searchParams.set('sort', '-coverDate');
    url.searchParams.set('view', 'STANDARD');
    url.searchParams.set('httpAccept', 'application/json');

    this.debugLogger.debug(
      `[ScopusAnalyticTrendTool] Analyzing trends for: ${kataKunci}`,
    );

    try {
      const { statusCode, body: responseBody } = await request(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-ELS-APIKey': apiKey,
          'User-Agent': BROWSER_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.5',
        },
        bodyTimeout: SCOPUS_API_TIMEOUT_MS,
        headersTimeout: SCOPUS_API_TIMEOUT_MS,
      });

      if (statusCode < 200 || statusCode >= 300) {
        const errorText = await responseBody.text();
        let errorMessage = `Scopus API request failed with status ${statusCode}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson?.['service-error']?.['status']?.[0]) {
            const status = errorJson['service-error']['status'][0];
            errorMessage = `Scopus API error: ${status['statusText']} - ${status['statusDescription'] || status['message'] || 'Unknown error'}`;
          }
        } catch {
          errorMessage += `: ${errorText.substring(0, 200)}`;
        }

        this.debugLogger.error(`[ScopusAnalyticTrendTool] ${errorMessage}`);

        return {
          llmContent: JSON.stringify({
            error: errorMessage,
            status: statusCode,
          }),
          returnDisplay: `Scopus analytic failed: ${statusCode}`,
          error: {
            type: ToolErrorType.SCOPE_SEARCH_FAILED,
            message: errorMessage,
          },
        };
      }

      const data = await responseBody.json();
      const searchResults =
        ((data as Record<string, unknown>)['search-results'] as Record<
          string,
          unknown
        >) || {};
      const entries = (searchResults['entry'] || []) as Array<Record<
        string,
        unknown
      >>;
      const totalHasilDiDatabase = Number.parseInt(
        strVal(searchResults['opensearch:totalResults'], '0'),
        10,
      );

      const { daftarArtikel, penghitungTahun, penghitungKataKunci } =
        processEntries(entries);

      const trenTahunBerurutan = Object.entries(penghitungTahun)
        .sort(([tahunA], [tahunB]) => tahunA.localeCompare(tahunB))
        .map(([tahun, jumlah]) => ({ tahun, jumlah }));

      const topKataKunci = Object.entries(penghitungKataKunci)
        .sort(([, jumlahA], [, jumlahB]) => jumlahB - jumlahA)
        .slice(0, 10)
        .map(([kataKunci, jumlah]) => ({ kataKunci, jumlah }));

      const sampelArtikelTeratas = daftarArtikel.slice(0, 5);

      const hasilAnalisis = {
        kata_kunci_pencarian: kataKunci,
        total_artikel_ditemukan_di_scopus: totalHasilDiDatabase,
        jumlah_artikel_dianalisis: daftarArtikel.length,
        tren_publikasi_per_tahun: trenTahunBerurutan,
        kata_kunci_terpopuler: topKataKunci,
        sampel_artikel_teratas: sampelArtikelTeratas,
      };

      const resultJson = JSON.stringify(hasilAnalisis, null, 2);

      return {
        llmContent: resultJson,
        returnDisplay: `Successfully analyzed trends for ${kataKunci}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during Scopus analytic trend';

      this.debugLogger.error(
        `[ScopusAnalyticTrendTool] ${errorMessage}`,
        error,
      );

      return {
        llmContent: JSON.stringify({ error: errorMessage }),
        returnDisplay: `Scopus analytic failed: ${errorMessage}`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: errorMessage,
        },
      };
    }
  }
}

export class ScopusAnalyticTrendTool extends BaseDeclarativeTool<
  ScopusAnalyticTrendParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.SCOPUS_ANALYTIC_TREND;
  private readonly config?: Config;

  constructor(config?: Config) {
    super(
      ScopusAnalyticTrendTool.Name,
      ToolDisplayNames.SCOPUS_ANALYTIC_TREND,
      'Perform Scopus Analytic Trend. Takes kataKunci and maksHasil to analyze publication trends, top keywords, and top sample articles.',
      Kind.Read,
      {
        properties: {
          kataKunci: {
            description: 'Topic or keyword to search for',
            type: 'string',
          },
          apiKey: {
            description:
              'Scopus API key for authentication. Optional if configured in settings.',
            type: 'string',
          },
          maksHasil: {
            description: 'Maximum number of articles to process (Default: 50)',
            type: 'number',
          },
        },
        required: ['kataKunci'],
        type: 'object',
      },
    );
    this.config = config;
  }

  protected override validateToolParamValues(
    params: ScopusAnalyticTrendParams,
  ): string | null {
    if (!params.kataKunci || params.kataKunci.trim() === '') {
      return "The 'kataKunci' parameter cannot be empty.";
    }
    return null;
  }

  protected createInvocation(
    params: ScopusAnalyticTrendParams,
  ): ToolInvocation<ScopusAnalyticTrendParams, ToolResult> {
    return new ScopusAnalyticTrendToolInvocation(params, this.config);
  }
}
