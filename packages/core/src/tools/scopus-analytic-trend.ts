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
import type { Config } from '../config/config.js';

const SCOPUS_API_BASE_URL = 'https://api.elsevier.com/content/search/scopus';
const SCOPUS_API_TIMEOUT_MS = 30000;

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0';

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
      const errorMessage = 'Scopus API key is missing. Please configure it via the /config command or provide it in the tool parameters.';
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
      const response = await scopusGet(
        url.toString(),
        apiKey,
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

        this.debugLogger.error(`[ScopusAnalyticTrendTool] ${errorMessage}`);

        return {
          llmContent: JSON.stringify({ error: errorMessage, status: response.status }),
          returnDisplay: `Scopus analytic failed: ${response.status}`,
          error: {
            type: ToolErrorType.SCOPE_SEARCH_FAILED,
            message: errorMessage,
          },
        };
      }

      const data = await response.json();
      const searchResults = data['search-results'] || {};
      const entries = searchResults.entry || [];
      const totalHasilDiDatabase = parseInt(searchResults['opensearch:totalResults'] || '0', 10);

      const daftarArtikel: any[] = [];
      const penghitungTahun: Record<string, number> = {};
      const penghitungKataKunci: Record<string, number> = {};

      for (const item of entries) {
        const judul = item['dc:title'] || 'Tidak ada judul';
        const coverDate = item['prism:coverDate'] || '';
        const tahun = coverDate ? coverDate.substring(0, 4) : 'Tidak diketahui';
        const sitasi = parseInt(item['citedby-count'] || '0', 10);
        const abstrak = item['dc:description'] || item['abstract'] || 'Tidak ada abstrak';
        
        const penulisArray = parseAuthors(item['dc:creator']);
        let penulisBerformat = '';
        if (penulisArray.length > 0) {
          if (penulisArray.length <= 3) {
            penulisBerformat = penulisArray.join(', ');
          } else {
            penulisBerformat = `${penulisArray.slice(0, 3).join(', ')} dkk.`;
          }
        } else {
          penulisBerformat = 'Penulis tidak diketahui';
        }

        let abstrakBerformat = abstrak;
        if (abstrakBerformat.length > 200) {
          abstrakBerformat = abstrakBerformat.substring(0, 200) + '...';
        }

        const authkeywordsStr = item['authkeywords'] || '';
        const daftarKataKunci = authkeywordsStr
          .split('|')
          .map((k: string) => k.trim())
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
          penulis: penulisBerformat,
          sitasi,
          kata_kunci: daftarKataKunci,
          abstrak: abstrakBerformat
        });
      }

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
        sampel_artikel_teratas: sampelArtikelTeratas
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

      this.debugLogger.error(`[ScopusAnalyticTrendTool] ${errorMessage}`, error);

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
  private config?: Config;

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
            description: 'Scopus API key for authentication. Optional if configured in settings.',
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
