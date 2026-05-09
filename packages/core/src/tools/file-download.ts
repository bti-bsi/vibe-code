/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import zlib from 'node:zlib';
import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';

/**
 * Firefox-like User-Agent string for robust HTTP requests.
 * Many academic publisher servers block requests without a browser-like UA.
 */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0';

/**
 * Default directory where files are saved if not specified by user.
 * Uses current working directory at runtime.
 */
const DEFAULT_SAVE_DIR = process.cwd();

/**
 * Maximum file size to download (100MB).
 */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Decompresses gzip/br/deflate encoded response body.
 */
function decompressBody(body: Buffer, encoding: string | undefined): Buffer {
  if (!encoding) return body;

  try {
    if (encoding.includes('br')) {
      return zlib.brotliDecompressSync(body);
    }
    if (encoding.includes('gzip')) {
      return zlib.gunzipSync(body);
    }
    if (encoding.includes('deflate')) {
      return zlib.inflateSync(body);
    }
  } catch {
    // Fallback to raw body if decompression fails
  }
  return body;
}

/**
 * Extracts filename from URL path or Content-Disposition header.
 */
function extractFilename(
  urlString: string,
  contentDisposition?: string,
): string {
  // Try Content-Disposition header first
  if (contentDisposition) {
    const match = contentDisposition.match(
      /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i,
    );
    if (match && match[1]) {
      return match[1].replace(/['"]/g, '');
    }
  }

  // Fall back to URL path
  const parsed = new URL(urlString);
  const pathname = parsed.pathname;
  const filename = pathname.substring(pathname.lastIndexOf('/') + 1);

  // If no filename in URL, generate one from hostname + path
  if (!filename || filename === '') {
    const host = parsed.hostname || 'download';
    const pathParts = pathname.split('/').filter(Boolean);
    const identifier =
      pathParts.length > 0 ? pathParts[pathParts.length - 1] : host;
    return identifier || 'downloaded-file';
  }

  return decodeURIComponent(filename);
}

/**
 * Makes a robust HTTP/HTTPS GET request with automatic redirect handling.
 * Downloads binary content and returns it as a Buffer.
 */
async function robustHttpDownload(
  urlString: string,
  maxRedirects: number = 5,
  timeoutMs: number = 60000,
): Promise<{
  body: Buffer;
  filename: string;
  contentType: string;
  contentDisposition?: string;
  finalUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const makeRequest = (url: string, redirectCount: number) => {
      if (redirectCount > maxRedirects) {
        reject(new Error(`Too many redirects (max: ${maxRedirects})`));
        return;
      }

      let receivedBytes = 0;

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
            Accept: '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
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

            res.resume();
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }

          // Check for error status
          if (!res.statusCode || res.statusCode >= 400) {
            clearTimeout(timer);
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${res.statusMessage || 'Error'}`,
              ),
            );
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            receivedBytes += chunk.length;
            if (receivedBytes > MAX_FILE_SIZE) {
              req.destroy();
              clearTimeout(timer);
              reject(
                new Error(
                  `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
                ),
              );
              return;
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            clearTimeout(timer);
            const fullBuffer = Buffer.concat(chunks);
            const contentEncoding = res.headers['content-encoding'];
            const decompressedBuffer = decompressBody(
              fullBuffer,
              contentEncoding,
            );
            const filename = extractFilename(
              url,
              res.headers['content-disposition'],
            );
            const contentType =
              res.headers['content-type'] || 'application/octet-stream';

            resolve({
              body: decompressedBuffer,
              filename,
              contentType,
              contentDisposition: res.headers['content-disposition'],
              finalUrl: url,
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
 * Parameters for the FileDownload tool
 */
export interface FileDownloadParams {
  /**
   * URL(s) of the file(s) to download.
   * Can be a single URL string or an array of URLs for batch downloads.
   */
  urls: string | string[];
  /**
   * Optional: directory to save the file(s) to.
   * If not specified, files are saved to the current working directory.
   * Relative paths are resolved against the current working directory.
   */
  saveDir?: string;
}

/**
 * Download result entry
 */
interface DownloadResult {
  url: string;
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

/**
 * Implementation of the FileDownload tool invocation logic
 */
class FileDownloadToolInvocation extends BaseToolInvocation<
  FileDownloadParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(params: FileDownloadParams) {
    super(params);
    this.debugLogger = createDebugLogger('FILE_DOWNLOAD');
  }

  getDescription(): string {
    const urlCount = Array.isArray(this.params.urls)
      ? this.params.urls.length
      : 1;
    return `Download ${urlCount} file(s) from ${urlCount === 1 ? this.params.urls : 'multiple URLs'}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const urls = Array.isArray(this.params.urls)
      ? this.params.urls
      : [this.params.urls];
    const saveDir = this.params.saveDir
      ? path.resolve(this.params.saveDir)
      : DEFAULT_SAVE_DIR;

    this.debugLogger.debug(
      `[FileDownloadTool] Downloading ${urls.length} file(s) to ${saveDir}`,
    );

    // Check if abort was requested
    if (signal.aborted) {
      return {
        llmContent: 'Download cancelled by user.',
        returnDisplay: 'Download cancelled',
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: 'Download cancelled',
        },
      };
    }

    // Ensure save directory exists
    try {
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
        this.debugLogger.debug(
          `[FileDownloadTool] Created directory: ${saveDir}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        llmContent: `Failed to create save directory: ${errorMessage}`,
        returnDisplay: `Failed to create directory: ${saveDir}`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: `Failed to create save directory: ${errorMessage}`,
        },
      };
    }

    const results: DownloadResult[] = [];

    // Download files (sequentially to avoid overwhelming the network)
    for (const url of urls) {
      const result = await this.downloadFile(url, saveDir, signal);
      results.push(result);

      // Check if abort was requested
      if (signal.aborted) {
        break;
      }
    }

    return this.formatResults(results, saveDir);
  }

  private async downloadFile(
    url: string,
    saveDir: string,
    signal: AbortSignal,
  ): Promise<DownloadResult> {
    try {
      this.debugLogger.debug(`[FileDownloadTool] Downloading: ${url}`);

      const { body, filename } = await robustHttpDownload(url);

      // Check if abort was requested during download
      if (signal.aborted) {
        return {
          url,
          success: false,
          error: 'Download cancelled',
        };
      }

      // Sanitize filename for cross-platform compatibility
      const sanitizedFilename = this.sanitizeFilename(filename);
      const filePath = path.join(saveDir, sanitizedFilename);

      // Handle duplicate filenames by appending a counter
      let finalFilePath = filePath;
      let counter = 1;
      while (fs.existsSync(finalFilePath)) {
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        finalFilePath = path.join(saveDir, `${base}_${counter}${ext}`);
        counter++;
      }

      // Write file to disk
      fs.writeFileSync(finalFilePath, body);

      this.debugLogger.debug(
        `[FileDownloadTool] Saved: ${finalFilePath} (${body.length} bytes)`,
      );

      return {
        url,
        success: true,
        filePath: finalFilePath,
        fileSize: body.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.debugLogger.error(
        `[FileDownloadTool] Failed to download ${url}: ${errorMessage}`,
      );

      return {
        url,
        success: false,
        error: errorMessage,
      };
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace characters that are invalid in filenames on Windows/macOS/Linux
    const safeChars = filename
      .split('')
      .map((ch) => {
        const code = ch.charCodeAt(0);
        // Control characters (0-31) or invalid filename chars
        if (code < 32 || /[<>:"/\\|?*]/.test(ch)) {
          return '_';
        }
        return ch;
      })
      .join('');
    return safeChars
      .replace(/^\.+$/, '_') // Handle filenames that are only dots
      .substring(0, 255); // Limit filename length
  }

  private formatResults(
    results: DownloadResult[],
    saveDir: string,
  ): ToolResult {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    const output: string[] = [];
    output.push(`# File Download Results`);
    output.push(`**Total files:** ${results.length}`);
    output.push(`**Successful:** ${successful.length}`);
    output.push(`**Failed:** ${failed.length}`);
    output.push(`**Save directory:** \`${saveDir}\``);
    output.push('');

    if (successful.length > 0) {
      output.push('## Downloaded Files');
      output.push('');
      for (const result of successful) {
        const sizeInKB = ((result.fileSize ?? 0) / 1024).toFixed(1);
        output.push(
          `- **${path.basename(result.filePath!)}** (${sizeInKB} KB)`,
        );
        output.push(`  - URL: ${result.url}`);
        output.push(`  - Path: \`${result.filePath}\``);
        output.push('');
      }
    }

    if (failed.length > 0) {
      output.push('## Failed Downloads');
      output.push('');
      for (const result of failed) {
        output.push(`- **${result.url}**`);
        output.push(`  - Error: ${result.error}`);
        output.push('');
      }
    }

    const returnDisplay =
      successful.length === results.length
        ? `Successfully downloaded ${successful.length} file(s)`
        : `Downloaded ${successful.length}/${results.length} file(s) successfully`;

    return {
      llmContent: output.join('\n'),
      returnDisplay,
    };
  }
}

/**
 * Implementation of the FileDownload tool logic
 */
export class FileDownloadTool extends BaseDeclarativeTool<
  FileDownloadParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.FILE_DOWNLOAD;

  constructor() {
    super(
      FileDownloadTool.Name,
      ToolDisplayNames.FILE_DOWNLOAD,
      'Download files from URLs to a specified directory\n- Takes one or more URLs and an optional save directory\n- Uses browser-like HTTP GET with Firefox User-Agent\n- Handles redirects, gzip/br/deflate compression automatically\n- Saves files to the current working directory by default\n- Supports custom save directory (relative or absolute path)\n- Handles duplicate filenames by appending counters\n- Use this tool when the user asks you to download files\n\nUsage notes:\n  - Single URL: pass a string for urls parameter\n  - Multiple URLs: pass an array of strings for urls parameter\n  - Custom directory: set saveDir to the target folder path\n  - Supports HTTP and HTTPS URLs\n  - Max file size: 100MB per file\n  - Automatically sanitizes filenames for cross-platform compatibility\n  - Works well with PDF links from Scopus search results',
      Kind.Read,
      {
        properties: {
          urls: {
            description:
              'URL(s) of the file(s) to download. Can be a single URL string or an array of URLs for batch downloads. Examples: "https://example.com/file.pdf", ["https://example.com/file1.pdf", "https://example.com/file2.pdf"]',
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          saveDir: {
            description:
              'Optional: directory to save the file(s) to. If not specified, files are saved to the current working directory. Relative paths are resolved against cwd.',
            type: 'string',
          },
        },
        required: ['urls'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: FileDownloadParams,
  ): string | null {
    const urls = Array.isArray(params.urls) ? params.urls : [params.urls];

    if (urls.length === 0) {
      return "The 'urls' parameter cannot be empty. Provide at least one URL to download.";
    }

    // Validate URLs
    for (const url of urls) {
      try {
        new URL(url);
      } catch {
        return `Invalid URL: ${url}`;
      }
    }

    return null;
  }

  protected createInvocation(
    params: FileDownloadParams,
  ): ToolInvocation<FileDownloadParams, ToolResult> {
    return new FileDownloadToolInvocation(params);
  }
}
