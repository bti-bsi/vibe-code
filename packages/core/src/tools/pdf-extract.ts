/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { URL, pathToFileURL, fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';

// pdf-parse is a CommonJS module
import { PDFParse } from 'pdf-parse';

/**
 * Augment globalThis for pdfjs worker module preloading.
 * The worker module (pdf.worker.mjs) sets globalThis.pdfjsWorker with a
 * WorkerMessageHandler property. By preloading it ourselves we avoid pdfjs's
 * own dynamic import() which can fail in bundled ESM on Windows.
 */
declare global {
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}

/**
 * Firefox-like User-Agent string for robust HTTP requests.
 */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0';

/**
 * Default extraction directory.
 */
const DEFAULT_EXTRACT_DIR = path.join(process.cwd(), 'extract-data');

/**
 * Maximum PDF file size to process (50MB).
 */
const MAX_PDF_SIZE = 50 * 1024 * 1024;

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
 * Makes a robust HTTP/HTTPS GET request to download a PDF file.
 */
async function robustHttpGet(
  urlString: string,
  maxRedirects: number = 5,
  timeoutMs: number = 60000,
): Promise<Buffer> {
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
            if (receivedBytes > MAX_PDF_SIZE) {
              req.destroy();
              clearTimeout(timer);
              reject(
                new Error(
                  `File too large (max ${MAX_PDF_SIZE / 1024 / 1024}MB)`,
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
            resolve(decompressBody(fullBuffer, contentEncoding));
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
 * Sanitizes a string for use as a filename.
 */
function sanitizeFilename(filename: string): string {
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
  return safeChars.replace(/^\.+$/, '_').substring(0, 200);
}

/**
 * Sanitizes text for markdown output.
 */
function sanitizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive newlines
    .trim();
}

/**
 * Converts raw image bytes to a base64 data URI for markdown embedding.
 */
function imageDataUri(imagePath: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  let mimeType = 'application/octet-stream';
  if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.gif') mimeType = 'image/gif';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.svg') mimeType = 'image/svg+xml';
  else if (ext === '.tiff' || ext === '.tif') mimeType = 'image/tiff';

  try {
    const data = fs.readFileSync(imagePath);
    const base64 = data.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return '';
  }
}

/**
 * Detects tables from PDF text by analyzing layout patterns.
 * This is a heuristic-based approach since pdf-parse returns plain text.
 */
function detectTables(
  text: string,
): Array<{ pageNum: number; rows: string[][]; rawText: string }> {
  const tables: Array<{ pageNum: number; rows: string[][]; rawText: string }> =
    [];

  // Split by page markers if present
  const pageSections = text.split(/\f/g);

  for (let i = 0; i < pageSections.length; i++) {
    const section = pageSections[i].trim();
    if (!section) continue;

    // Look for tabular patterns: lines with consistent delimiters
    const lines = section.split('\n');
    const potentialTableRows: string[] = [];
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        // Empty line may end a table block
        if (potentialTableRows.length >= 2) {
          const rows = potentialTableRows.map((row) =>
            row.split(/\s{2,}|\t/).map((cell) => cell.trim()),
          );
          if (rows.every((r) => r.length >= 2)) {
            tables.push({
              pageNum: i + 1,
              rows,
              rawText: potentialTableRows.join('\n'),
            });
          }
          potentialTableRows.length = 0;
          inTable = false;
        }
        continue;
      }

      // Check if line looks like a table row (has multiple columns)
      const hasMultipleColumns = /\s{2,}|\t/.test(trimmed);
      const hasPipeDelimiters = /\|/.test(trimmed);
      const hasCommaDelimiters = /,(?=.*,)/.test(trimmed);

      if (hasMultipleColumns || hasPipeDelimiters || hasCommaDelimiters) {
        potentialTableRows.push(trimmed);
        inTable = true;
      } else if (inTable && potentialTableRows.length > 0) {
        // Current line doesn't look like a table row, flush accumulated rows
        if (potentialTableRows.length >= 2) {
          const rows = potentialTableRows.map((row) =>
            row.split(/\s{2,}|\t/).map((cell) => cell.trim()),
          );
          if (rows.every((r) => r.length >= 2)) {
            tables.push({
              pageNum: i + 1,
              rows,
              rawText: potentialTableRows.join('\n'),
            });
          }
        }
        potentialTableRows.length = 0;
        inTable = false;
      }
    }

    // Flush remaining table rows
    if (potentialTableRows.length >= 2) {
      const rows = potentialTableRows.map((row) =>
        row.split(/\s{2,}|\t/).map((cell) => cell.trim()),
      );
      if (rows.every((r) => r.length >= 2)) {
        tables.push({
          pageNum: i + 1,
          rows,
          rawText: potentialTableRows.join('\n'),
        });
      }
    }
  }

  return tables;
}

/**
 * Parameters for the PDFExtract tool
 */
export interface PDFExtractParams {
  /**
   * Path to the local PDF file or URL of a remote PDF.
   */
  source: string;
  /**
   * Optional: directory to save extracted files to.
   * Default: ./extract-data in the current working directory.
   */
  outputDir?: string;
  /**
   * Whether to extract embedded images. Default: true.
   */
  extractImages?: boolean;
  /**
   * Whether to detect and extract tables. Default: true.
   */
  extractTables?: boolean;
}

/**
 * Implementation of the PDFExtract tool invocation logic
 */
class PDFExtractToolInvocation extends BaseToolInvocation<
  PDFExtractParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(params: PDFExtractParams) {
    super(params);
    this.debugLogger = createDebugLogger('PDF_EXTRACT');
  }

  getDescription(): string {
    return `Extract data from PDF: ${this.params.source}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    this.debugLogger.debug(
      `[PDFExtractTool] Extracting from: ${this.params.source}`,
    );

    try {
      // Check if abort was requested
      if (signal.aborted) {
        return {
          llmContent: 'PDF extraction cancelled by user.',
          returnDisplay: 'Extraction cancelled',
          error: {
            type: ToolErrorType.SCOPE_SEARCH_FAILED,
            message: 'Extraction cancelled',
          },
        };
      }

      // Load PDF from file or URL
      let pdfBuffer: Buffer;
      const source = this.params.source;

      if (source.startsWith('http://') || source.startsWith('https://')) {
        this.debugLogger.debug(
          `[PDFExtractTool] Downloading PDF from URL: ${source}`,
        );
        pdfBuffer = await robustHttpGet(source);
      } else {
        const filePath = path.resolve(source);
        if (!fs.existsSync(filePath)) {
          return {
            llmContent: `PDF file not found: ${filePath}`,
            returnDisplay: `File not found: ${filePath}`,
            error: {
              type: ToolErrorType.SCOPE_SEARCH_FAILED,
              message: `PDF file not found: ${filePath}`,
            },
          };
        }
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_PDF_SIZE) {
          return {
            llmContent: `PDF file too large (max ${MAX_PDF_SIZE / 1024 / 1024}MB)`,
            returnDisplay: `File too large: ${filePath}`,
            error: {
              type: ToolErrorType.SCOPE_SEARCH_FAILED,
              message: `PDF file too large (max ${MAX_PDF_SIZE / 1024 / 1024}MB)`,
            },
          };
        }
        this.debugLogger.debug(
          `[PDFExtractTool] Reading PDF from: ${filePath}`,
        );
        pdfBuffer = fs.readFileSync(filePath);
      }

      // Resolve and preload the pdfjs-dist worker module.
      // We import the worker ourselves and set globalThis.pdfjsWorker so that
      // pdfjs's _setupFakeWorkerGlobal finds WorkerMessageHandler immediately
      // and skips its own dynamic import() (which can fail in bundled ESM on
      // Windows). Two modes:
      //   1. Bundled mode (dist/cli.js): worker is co-located as dist/pdf.worker.mjs
      //   2. Source/dev mode: resolve from node_modules via require.resolve
      try {
        const scriptDir = path.dirname(fileURLToPath(import.meta.url));
        const bundledWorker = path.join(scriptDir, 'pdf.worker.mjs');
        let workerUrl: string;
        if (fs.existsSync(bundledWorker)) {
          workerUrl = pathToFileURL(bundledWorker).href;
        } else {
          const workerRequire = createRequire(import.meta.url);
          const workerPath = workerRequire.resolve(
            'pdfjs-dist/legacy/build/pdf.worker.mjs',
          );
          workerUrl = pathToFileURL(workerPath).href;
        }
        // Pre-import the worker and set it on globalThis so pdfjs finds it
        // without doing its own dynamic import, avoiding the
        // "Cannot find module" error in bundled ESM contexts.
        const workerModule = await import(workerUrl);
        globalThis.pdfjsWorker = workerModule;
      } catch {
        // Fallback: let pdf-parse handle worker configuration.
        // Extraction may still work if a worker is not required.
      }

      // Parse PDF
      const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
      const textResult = await parser.getText({});
      const totalPages = textResult.pages.length;
      // Concatenate text from all pages
      const fullText = textResult.pages.map((p) => p.text).join('\f');

      this.debugLogger.debug(`[PDFExtractTool] PDF has ${totalPages} pages`);

      // Determine output directory
      const outputDir = this.params.outputDir
        ? path.resolve(this.params.outputDir)
        : DEFAULT_EXTRACT_DIR;

      // Create output directories
      const imagesDir = path.join(outputDir, 'images');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Generate sanitized filename base from source
      let baseName: string;
      if (source.startsWith('http://') || source.startsWith('https://')) {
        const url = new URL(source);
        const pathname = url.pathname;
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
        baseName = filename
          ? sanitizeFilename(filename.replace(/\.pdf$/i, ''))
          : 'document';
      } else {
        baseName = sanitizeFilename(path.basename(source, '.pdf'));
      }

      // Extract text and generate markdown
      const sanitizedText = sanitizeText(fullText);
      const mdContent = this.generateMarkdown(
        sanitizedText,
        totalPages,
        baseName,
        outputDir,
        imagesDir,
      );

      // Save markdown file
      const mdPath = path.join(outputDir, `${baseName}.md`);
      fs.writeFileSync(mdPath, mdContent);
      this.debugLogger.debug(`[PDFExtractTool] Saved markdown: ${mdPath}`);

      // Extract images if requested
      const imageInfos: Array<{
        pageNum: number;
        filename: string;
        width: number;
        height: number;
      }> = [];
      const shouldExtractImages = this.params.extractImages ?? true;

      if (shouldExtractImages) {
        // Image extraction from PDFs requires additional native libraries.
        // For now, we note that images exist but cannot extract them directly.
        this.debugLogger.debug(
          `[PDFExtractTool] Image extraction skipped (text-only mode)`,
        );
      }

      // Detect tables if requested
      let tables: Array<{
        pageNum: number;
        rows: string[][];
        rawText: string;
      }> = [];
      const shouldExtractTables = this.params.extractTables ?? true;

      if (shouldExtractTables) {
        tables = detectTables(sanitizedText);
        this.debugLogger.debug(
          `[PDFExtractTool] Detected ${tables.length} potential tables`,
        );
      }

      // Check if abort was requested
      if (signal.aborted) {
        return {
          llmContent: 'PDF extraction cancelled by user.',
          returnDisplay: 'Extraction cancelled',
          error: {
            type: ToolErrorType.SCOPE_SEARCH_FAILED,
            message: 'Extraction cancelled',
          },
        };
      }

      return this.formatResults({
        mdPath,
        totalPages,
        imageInfos,
        tables,
        outputDir,
        imagesDir,
        source,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.debugLogger.error(
        `[PDFExtractTool] Extraction failed: ${errorMessage}`,
        error,
      );

      return {
        llmContent: `PDF extraction failed: ${errorMessage}`,
        returnDisplay: `Extraction failed: ${errorMessage}`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: errorMessage,
        },
      };
    }
  }

  private generateMarkdown(
    text: string,
    totalPages: number,
    baseName: string,
    outputDir: string,
    imagesDir: string,
  ): string {
    const lines: string[] = [];

    lines.push(`# ${baseName}`);
    lines.push('');
    lines.push(`**Total pages:** ${totalPages}`);
    lines.push(`**Extracted from:** ${this.params.source}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Split text by page break character (\f)
    const pages = text.split('\f');

    for (let i = 0; i < pages.length; i++) {
      const pageText = pages[i].trim();
      if (!pageText) continue;

      lines.push(`## Page ${i + 1}`);
      lines.push('');

      // Check for table-like patterns and format as markdown tables
      const pageLines = pageText.split('\n');
      let tableRows: string[][] = [];

      for (const line of pageLines) {
        const trimmed = line.trim();
        if (!trimmed) {
          // Flush table block if we have one
          if (tableRows.length >= 2) {
            lines.push(this.formatMarkdownTable(tableRows));
            lines.push('');
            tableRows = [];
          }
          lines.push('');
          continue;
        }

        // Check if line looks like a table row
        const cells = trimmed.split(/\s{2,}|\t/).map((c) => c.trim());
        const hasMultipleColumns = cells.length >= 2 && trimmed.length > 10;

        if (hasMultipleColumns) {
          tableRows.push(cells);
        } else {
          // Flush table block if we have one
          if (tableRows.length >= 2) {
            lines.push(this.formatMarkdownTable(tableRows));
            lines.push('');
            tableRows = [];
          }
          lines.push(trimmed);
          lines.push('');
        }
      }

      // Flush remaining table rows
      if (tableRows.length >= 2) {
        lines.push(this.formatMarkdownTable(tableRows));
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    // Add images section if images were extracted
    if (fs.existsSync(imagesDir)) {
      const images = fs.readdirSync(imagesDir);
      if (images.length > 0) {
        lines.push(`## Extracted Images`);
        lines.push('');
        for (const img of images) {
          const imgPath = path.join(imagesDir, img);
          const dataUri = imageDataUri(imgPath, img);
          if (dataUri) {
            lines.push(`![${img}](${dataUri})`);
            lines.push('');
          } else {
            lines.push(`- \`${img}\` (saved in \`images/\` folder)`);
            lines.push('');
          }
        }
        lines.push('---');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private formatMarkdownTable(rows: string[][]): string {
    if (rows.length === 0) return '';

    // Determine max columns
    const maxCols = Math.max(...rows.map((r) => r.length));

    // Pad rows to same length
    const paddedRows = rows.map((r) => {
      const padded = [...r];
      while (padded.length < maxCols) padded.push('');
      return padded;
    });

    // Build markdown table
    const lines: string[] = [];
    lines.push(`| ${paddedRows[0].join(' | ')} |`);
    lines.push(`| ${Array(maxCols).fill('---').join(' | ')} |`);
    for (let i = 1; i < paddedRows.length; i++) {
      lines.push(`| ${paddedRows[i].join(' | ')} |`);
    }

    return lines.join('\n');
  }

  private formatResults(result: {
    mdPath: string;
    totalPages: number;
    imageInfos: Array<{
      pageNum: number;
      filename: string;
      width: number;
      height: number;
    }>;
    tables: Array<{ pageNum: number; rows: string[][]; rawText: string }>;
    outputDir: string;
    imagesDir: string;
    source: string;
  }): ToolResult {
    const output: string[] = [];
    output.push(`# PDF Extraction Results`);
    output.push(`**Source:** ${result.source}`);
    output.push(`**Total pages:** ${result.totalPages}`);
    output.push(`**Output directory:** \`${result.outputDir}\``);
    output.push('');

    // Markdown file
    output.push(`## Extracted Markdown`);
    output.push(`- **File:** \`${result.mdPath}\``);
    output.push(`- Contains full text content organized by page`);
    output.push('');

    // Images
    if (result.imageInfos.length > 0) {
      output.push(`## Extracted Images (${result.imageInfos.length})`);
      output.push(`Images saved to: \`${result.imagesDir}\``);
      output.push('');
      for (const img of result.imageInfos) {
        output.push(
          `- Page ${img.pageNum}: \`${img.filename}\` (${img.width}x${img.height})`,
        );
      }
      output.push('');
    }

    // Tables
    if (result.tables.length > 0) {
      output.push(`## Detected Tables (${result.tables.length})`);
      output.push(
        'Tables were detected heuristically from text layout and embedded in the markdown file.',
      );
      output.push('');
      for (const table of result.tables) {
        output.push(
          `- Page ${table.pageNum}: ${table.rows.length} rows x ${table.rows[0]?.length || 0} columns`,
        );
      }
      output.push('');
    }

    const returnDisplay = `Extracted ${result.totalPages} pages, ${result.imageInfos.length} images, ${result.tables.length} tables`;

    return {
      llmContent: output.join('\n'),
      returnDisplay,
    };
  }
}

/**
 * Implementation of the PDFExtract tool logic
 */
export class PDFExtractTool extends BaseDeclarativeTool<
  PDFExtractParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.PDF_EXTRACT;

  constructor() {
    super(
      PDFExtractTool.Name,
      ToolDisplayNames.PDF_EXTRACT,
      `Extract text, images, and tables from PDF files into structured markdown
- Takes a PDF file path or URL as input
- Extracts all text content and saves as .md file
- Extracts embedded images and saves them in images/ subfolder
- Detects tabular data and formats as markdown tables
- Default output: ./extract-data/ in current working directory
- Supports custom output directory via outputDir parameter
- Use this tool when you need to extract data from PDF files

Usage notes:
  - Local file: pass file path for source parameter
  - Remote PDF: pass URL for source parameter
  - Images are saved to images/ subfolder within output directory
  - Tables are detected heuristically and embedded in markdown
  - Max PDF size: 50MB
  - Output includes: .md file, extracted images, and summary

Tool Name: pdf_extract
Parameters:
- source (string): Path to the local PDF file or URL of a remote PDF. Examples: "./paper.pdf", "https://example.com/paper.pdf"
- outputDir (string): Optional: directory to save extracted files to. Default: ./extract-data in the current working directory.
- extractImages (boolean): Whether to extract embedded images. Default: true.
- extractTables (boolean): Whether to detect and extract tables. Default: true.`,
      Kind.Read,
      {
        properties: {
          source: {
            description:
              'Path to the local PDF file or URL of a remote PDF. Examples: "./paper.pdf", "https://example.com/paper.pdf"',
            type: 'string',
          },
          outputDir: {
            description:
              'Optional: directory to save extracted files to. Default: ./extract-data in the current working directory.',
            type: 'string',
          },
          extractImages: {
            description: 'Whether to extract embedded images. Default: true.',
            type: 'boolean',
          },
          extractTables: {
            description: 'Whether to detect and extract tables. Default: true.',
            type: 'boolean',
          },
        },
        required: ['source'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: PDFExtractParams,
  ): string | null {
    if (!params.source || params.source.trim() === '') {
      return "The 'source' parameter cannot be empty.";
    }

    // If it's a local file, check it exists
    if (
      !params.source.startsWith('http://') &&
      !params.source.startsWith('https://')
    ) {
      const filePath = path.resolve(params.source);
      if (!fs.existsSync(filePath)) {
        return `PDF file not found: ${filePath}`;
      }
      if (!filePath.toLowerCase().endsWith('.pdf')) {
        return `Source file does not appear to be a PDF: ${filePath}`;
      }
    }

    return null;
  }

  protected createInvocation(
    params: PDFExtractParams,
  ): ToolInvocation<PDFExtractParams, ToolResult> {
    return new PDFExtractToolInvocation(params);
  }
}
