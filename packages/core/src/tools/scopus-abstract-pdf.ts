/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import { getResponseText } from '../utils/partUtils.js';
import { DEFAULT_VIBE_MODEL } from '../config/models.js';
import { createDebugLogger } from '../utils/debugLogger.js';
import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult, ToolResultDisplay } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import zlib from 'node:zlib';

/**
 * Firefox-like User-Agent string for robust HTTP requests.
 * Many academic publisher servers block requests without a browser-like UA.
 */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0';

/**
 * Result from AI-based HTML scraping.
 */
interface ScrapedPaperInfo {
  abstract: string;
  pdfLink: string;
}

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
 * Makes a robust HTTP/HTTPS GET request with automatic redirect handling.
 * Follows redirects up to a maximum depth and returns the final response.
 */
async function robustHttpGet(
  urlString: string,
  maxRedirects: number = 5,
  timeoutMs: number = 20000,
): Promise<{ body: string; finalUrl: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const makeRequest = (url: string, redirectCount: number) => {
      if (redirectCount > maxRedirects) {
        reject(new Error(`Too many redirects (max: ${maxRedirects})`));
        return;
      }

      const timer = setTimeout(() => {
        req.destroy();
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const parsed = new URL(url);
      const reqClient = parsed.protocol === 'https:' ? https : http;

      const req = reqClient.get(
        url,
        {
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            Pragma: 'no-cache',
            'Cache-Control': 'no-cache',
          },
          timeout: timeoutMs,
        },
        (res) => {
          // Handle redirects (3xx status codes)
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const redirectUrl = res.headers.location.startsWith('http')
              ? res.headers.location
              : new URL(res.headers.location, url).toString();

            // Consume the redirect response body
            res.resume();
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            clearTimeout(timer);
            const fullBuffer = Buffer.concat(chunks);
            const contentEncoding = res.headers['content-encoding'];
            const bodyText = decompressBody(fullBuffer, contentEncoding);
            resolve({
              body: bodyText,
              finalUrl: url,
              statusCode: res.statusCode || 500,
            });
          });
        },
      );

      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    };

    makeRequest(urlString, 0);
  });
}

/**
 * Uses the LLM to extract abstract and PDF link from HTML content.
 */
async function scrapePaperInfoWithLLM(
  config: Config,
  html: string,
  doi: string,
  signal: AbortSignal,
): Promise<ScrapedPaperInfo> {
  const geminiClient = config.getGeminiClient();

  const prompt = `You are an expert at extracting academic paper information from HTML pages.
The following is the HTML content of a paper page from a publisher website (DOI: ${doi}).

Your task is to extract the following information and return it as a JSON object:
{
  "abstract": "The full abstract of the paper (or empty string if not found)",
  "pdfLink": "The full URL to download the PDF or fulltext version of this paper (or empty string if not found)"
}

Rules:
1. The abstract should be complete and accurate as written on the page.
2. The PDF link should be a direct download link or a link to the fulltext/PDF version.
3. Look for links containing "pdf", "download", "fulltext", or similar.
4. Convert relative URLs to absolute URLs using the base URL of the page.
5. If multiple PDF links exist, choose the most direct one.

HTML content:
---
${html.substring(0, 50000)}
---

Return ONLY a valid JSON object with the exact schema above. Do not include any other text.`;

  try {
    const result = await geminiClient.generateContent(
      [{ role: 'user', parts: [{ text: prompt }] }],
      {
        systemInstruction:
          'Extract the abstract and PDF download link from academic paper HTML pages. ' +
          'Return ONLY a valid JSON object with "abstract" and "pdfLink" fields.',
      },
      signal,
      config.getModel() || DEFAULT_VIBE_MODEL,
    );
    const resultText = getResponseText(result) || '';

    // Try to parse the JSON response
    try {
      // Sometimes the LLM wraps the JSON in markdown code blocks
      let jsonStr = resultText.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
        jsonStr = jsonStr.replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(jsonStr);
      return {
        abstract: parsed?.abstract || '',
        pdfLink: parsed?.pdfLink || '',
      };
    } catch {
      // If JSON parsing fails, try to extract using regex as fallback
      const abstractMatch = resultText.match(/"abstract"\s*:\s*"([^"]*)"/i);
      const pdfMatch = resultText.match(/"pdfLink"\s*:\s*"([^"]*)"/i);
      return {
        abstract: abstractMatch ? abstractMatch[1] : '',
        pdfLink: pdfMatch ? pdfMatch[1] : '',
      };
    }
  } catch {
    return {
      abstract: '',
      pdfLink: '',
    };
  }
}

/**
 * Fetches paper information using Scopus Abstract Retrieval API.
 */
async function fetchPaperInfoWithScopusAPI(
  doi: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<{
  abstract: string;
  pdfLink: string;
  publisherUrl: string;
} | null> {
  const url = `https://api.elsevier.com/content/abstract/doi/${doi}?view=FULL`;
  
  try {
    const response = await new Promise<string>((resolve, reject) => {
      const reqClient = https;
      const req = reqClient.get(
        url,
        {
          headers: {
            'X-ELS-APIKey': apiKey,
            'Accept': 'application/json',
          },
          signal,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        }
      );
      req.on('error', reject);
    });

    const json = JSON.parse(response);
    const coredata = json['abstracts-retrieval-response']?.['coredata'];
    const item = json['abstracts-retrieval-response']?.['item'];
    
    if (!coredata) return null;

    // Extract abstract from various possible locations in the JSON
    let abstract = coredata['dc:description'] || '';
    if (!abstract && item?.['bibrecord']?.['head']?.['abstracts']?.['abstract']) {
      const abstractObj = item['bibrecord']['head']['abstracts']['abstract'];
      const abstractArr = Array.isArray(abstractObj) ? abstractObj : [abstractObj];
      abstract = abstractArr.map((a: any) => a['ce:para'] || '').join('\n\n');
    }

    // Extract PDF link/publisher link
    const links = coredata['link'] || [];
    const scopusUrl = links.find((l: any) => l['@rel'] === 'scopus')?.['@href'] || '';
    const fullTextUrl = links.find((l: any) => l['@rel'] === 'full-text')?.['@href'] || '';

    return {
      abstract: abstract.trim(),
      pdfLink: fullTextUrl,
      publisherUrl: scopusUrl,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Main function to fetch paper information, trying Scopus API first if key is available,
 * then falling back to LLM-based scraping.
 */
async function fetchPaperInfo(
  config: Config,
  doi: string,
  signal: AbortSignal,
  apiKey?: string,
): Promise<{
  abstract: string;
  pdfLink: string;
  publisherUrl: string;
}> {
  // Try Scopus API first if we have a key
  if (apiKey) {
    const apiResult = await fetchPaperInfoWithScopusAPI(doi, apiKey, signal);
    if (apiResult && apiResult.abstract) {
      return apiResult;
    }
  }

  // Fallback to LLM scraping
  return fetchPaperInfoWithLLM(config, doi, signal);
}

/**
 * Fetches paper information from DOI URL and uses LLM to extract abstract and PDF link.
 */
async function fetchPaperInfoWithLLM(
  config: Config,
  doi: string,
  signal: AbortSignal,
): Promise<{
  abstract: string;
  pdfLink: string;
  publisherUrl: string;
}> {
  try {
    const doiUrl = `https://doi.org/${doi}`;
    const response = await robustHttpGet(doiUrl, 5, 20000);
    const publisherUrl = response.finalUrl;

    const scrapedInfo = await scrapePaperInfoWithLLM(
      config,
      response.body,
      doi,
      signal,
    );

    return {
      abstract: scrapedInfo.abstract,
      pdfLink: scrapedInfo.pdfLink,
      publisherUrl,
    };
  } catch {
    return {
      abstract: '',
      pdfLink: '',
      publisherUrl: '',
    };
  }
}

/**
 * Parameters for the ScopusAbstractPDF tool
 */
export interface ScopusAbstractPDFParams {
  /**
   * Array of DOI URLs to fetch abstracts and PDF links for.
   * Examples: ["10.1016/j.jafr.2026.102712", "10.1007/s42452-026-08292-y"]
   * Can also include full DOI URLs like "https://doi.org/10.1016/j.jafr.2026.102712"
   */
  dois: string[];
  /**
   * Optional Scopus API key. If not provided, will try to read from settings.
   */
  apiKey?: string;
}

/**
 * Result from fetching a single DOI
 */
interface DOIFetchResult {
  doi: string;
  abstract: string;
  pdfLink: string;
  publisherUrl: string;
  success: boolean;
  error?: string;
}

/**
 * Implementation of the ScopusAbstractPDF tool invocation logic
 */
class ScopusAbstractPDFToolInvocation extends BaseToolInvocation<
  ScopusAbstractPDFParams,
  ToolResult
> {
  private readonly debugLogger = createDebugLogger('SCOPUS_ABSTRACT_PDF');

  constructor(
    private readonly config: Config,
    params: ScopusAbstractPDFParams,
  ) {
    super(params);
  }

  private currentProgress: string = '';

  getDescription(): string {
    const base = `Fetch abstracts and PDF links for ${this.params.dois.length} DOIs`;
    return this.currentProgress ? `${base} - ${this.currentProgress}` : base;
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const dois = this.params.dois;
    const apiKey = this.params.apiKey || this.config?.getScopusApiKey();
    
    if (apiKey) {
      this.debugLogger.info('[ScopusAbstractPDFTool] Using Scopus API key for metadata extraction');
    }

    if (dois.length === 0) {
      return {
        llmContent:
          'No DOIs provided. Please provide at least one DOI to fetch.',
        returnDisplay: 'No DOIs provided',
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: 'No DOIs provided',
        },
      };
    }

    if (dois.length > 50) {
      return {
        llmContent: `Too many DOIs provided (${dois.length}). Maximum is 50.`,
        returnDisplay: 'Too many DOIs (max 50)',
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: `Too many DOIs: ${dois.length}, max is 50`,
        },
      };
    }

    // Clean up DOIs - extract just the DOI part if full URL is provided
    const cleanedDOIs = dois.map((doi) => {
      if (doi.startsWith('http')) {
        const parts = doi.split('/');
        return parts.slice(3).join('/');
      }
      return doi;
    });

    // Fetch all DOIs in parallel with concurrency limit
    const results = await this.fetchDOIsParallel(
      cleanedDOIs,
      signal,
      apiKey,
      5,
      updateOutput,
    );

    return this.formatResults(results);
  }

  /**
   * Fetches DOIs in parallel with a concurrency limit to avoid overwhelming the server.
   */
  private async fetchDOIsParallel(
    dois: string[],
    signal: AbortSignal,
    apiKey?: string,
    concurrency: number = 5,
    updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<DOIFetchResult[]> {
    const results: DOIFetchResult[] = [];
    let completedCount = 0;
    
    const reportProgress = (msg: string) => {
      this.currentProgress = msg;
      if (updateOutput) {
        updateOutput(msg);
      }
    };
    
    reportProgress(`Preparing to fetch ${dois.length} DOIs...`);

    // Process in batches of `concurrency` size
    for (let i = 0; i < dois.length; i += concurrency) {
      const batch = dois.slice(i, i + concurrency);
      const batchPromises = batch.map(async (doi) => {
        if (signal.aborted) {
          return {
            doi,
            abstract: '',
            pdfLink: '',
            publisherUrl: '',
            success: false,
            error: 'Aborted',
          };
        }

        try {
          const paperInfo = await fetchPaperInfo(
            this.config,
            doi,
            signal,
            apiKey,
          );

          return {
            doi,
            abstract: paperInfo.abstract || '',
            pdfLink: paperInfo.pdfLink || '',
            publisherUrl: paperInfo.publisherUrl || '',
            success: !!(paperInfo.abstract || paperInfo.pdfLink),
          };
        } catch (error) {
          return {
            doi,
            abstract: '',
            pdfLink: '',
            publisherUrl: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        } finally {
          completedCount++;
          reportProgress(`Processed ${completedCount} of ${dois.length} DOIs...`);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + concurrency < dois.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    return results;
  }

  private formatResults(results: DOIFetchResult[]): ToolResult {
    const output: string[] = [];
    output.push(`# Scopus Abstract & PDF Extraction Results`);
    output.push(`**DOIs processed:** ${results.length}`);
    output.push('');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const num = i + 1;

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      output.push(`### ${num}. DOI: ${result.doi}`);
      output.push('');
      output.push(`**Status:** ${result.success ? '✅ Success' : '❌ Failed'}`);
      output.push('');

      if (result.publisherUrl) {
        output.push(
          `**Publisher URL:** [${result.publisherUrl}](${result.publisherUrl})`,
        );
        output.push('');
      }

      if (result.success) {
        if (result.abstract) {
          output.push(`**Abstract:**`);
          output.push('');
          output.push(result.abstract);
          output.push('');
        }

        if (result.pdfLink) {
          output.push(`**[📄 Download PDF](${result.pdfLink})**`);
          output.push('');
        }

        if (!result.abstract && !result.pdfLink) {
          output.push('_No abstract or PDF link found._');
          output.push('');
        }
      } else if (result.error) {
        output.push(`**Error:** ${result.error}`);
        output.push('');
      }

      output.push('---');
      output.push('');
    }

    output.push(`**Summary:** ${successCount} succeeded, ${failCount} failed`);

    return {
      llmContent: output.join('\n'),
      returnDisplay: `Processed ${results.length} DOIs: ${successCount} succeeded, ${failCount} failed`,
    };
  }
}

/**
 * Implementation of the ScopusAbstractPDF tool logic
 */
export class ScopusAbstractPDFTool extends BaseDeclarativeTool<
  ScopusAbstractPDFParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.SCOPUS_ABSTRACT_PDF;

  constructor(private readonly config: Config) {
    super(
      ScopusAbstractPDFTool.Name,
      ToolDisplayNames.SCOPUS_ABSTRACT_PDF,
      'Extract abstracts and PDF download links from academic paper DOI URLs using AI-powered HTML scraping\n- Takes an array of DOI URLs as input\n- Accesses each DOI URL in parallel with concurrency control\n- Uses LLM to extract abstract text and PDF download links from publisher HTML pages\n- Returns structured results with abstract, PDF link, and publisher URL for each DOI\n- Handles redirects, decompression, and rate limiting automatically\n- Use this tool when you have DOI links from Scopus search results and need full abstracts and PDF links\n\nUsage notes:\n  - Provide DOIs as either plain DOIs (e.g., "10.1016/j.jafr.2026.102712") or full URLs (e.g., "https://doi.org/10.1016/j.jafr.2026.102712")\n  - Maximum 50 DOIs per request to avoid rate limiting\n  - Processing is done in parallel batches of 5 DOIs with 1.5s delay between batches\n  - Each DOI is processed independently - failures in one DOI do not affect others\n  - Results include success/failure status for each DOI\n  - Abstracts are extracted using AI scraping - quality depends on publisher HTML structure',
      Kind.Read,
      {
        properties: {
          dois: {
            description:
              'Array of DOI URLs to fetch abstracts and PDF links for. Examples: ["10.1016/j.jafr.2026.102712", "10.1007/s42452-026-08292-y"] or full URLs like "https://doi.org/10.1016/j.jafr.2026.102712"',
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        required: ['dois'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: ScopusAbstractPDFParams,
  ): string | null {
    if (!params.dois || params.dois.length === 0) {
      return "The 'dois' parameter cannot be empty. Provide at least one DOI.";
    }
    if (params.dois.length > 50) {
      return `The 'dois' parameter cannot have more than 50 DOIs. You provided ${params.dois.length}.`;
    }
    return null;
  }

  protected createInvocation(
    params: ScopusAbstractPDFParams,
  ): ToolInvocation<ScopusAbstractPDFParams, ToolResult> {
    return new ScopusAbstractPDFToolInvocation(this.config, params);
  }
}
