/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';

/**
 * Default extraction directory.
 */
const DEFAULT_EXTRACT_DIR = path.join(process.cwd(), 'extract-doc');

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
 * Parameters for the DocxExtract tool
 */
export interface DocxExtractParams {
  /**
   * Path to the local .docx file.
   */
  source: string;
  /**
   * Optional: directory to save extracted files to.
   * Default: ./extract-doc in the current working directory.
   */
  outputDir?: string;
  /**
   * Whether to extract embedded images. Default: true.
   */
  extractImages?: boolean;
}

/**
 * Implementation of the DocxExtract tool invocation logic
 */
class DocxExtractToolInvocation extends BaseToolInvocation<
  DocxExtractParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(params: DocxExtractParams) {
    super(params);
    this.debugLogger = createDebugLogger('DOCX_EXTRACT');
  }

  getDescription(): string {
    return `Extract data from DOCX: ${this.params.source}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    this.debugLogger.debug(
      `[DocxExtractTool] Extracting from: ${this.params.source}`,
    );

    try {
      if (signal.aborted) {
        return {
          llmContent: 'DOCX extraction cancelled by user.',
          returnDisplay: 'Extraction cancelled',
          error: {
            type: ToolErrorType.SCOPE_SEARCH_FAILED,
            message: 'Extraction cancelled',
          },
        };
      }

      const sourcePath = path.resolve(this.params.source);
      if (!fs.existsSync(sourcePath)) {
        return {
          llmContent: `DOCX file not found: ${sourcePath}`,
          returnDisplay: `File not found: ${sourcePath}`,
          error: {
            type: ToolErrorType.SCOPE_SEARCH_FAILED,
            message: `DOCX file not found: ${sourcePath}`,
          },
        };
      }

      const outputDir = this.params.outputDir
        ? path.resolve(this.params.outputDir)
        : DEFAULT_EXTRACT_DIR;

      const imagesDir = path.join(outputDir, 'images');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const baseName = sanitizeFilename(path.basename(sourcePath, '.docx'));
      const imageInfos: Array<{ filename: string; contentType: string }> = [];
      let imageCounter = 0;

      const options: any = {};
      if (this.params.extractImages !== false) {
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }
        options.convertImage = (mammoth.images as any).inline((element: any) => {
          imageCounter++;
          const extension = element.contentType.split('/')[1] || 'png';
          const imageName = `${baseName}_image_${imageCounter}.${extension}`;
          const imagePath = path.join(imagesDir, imageName);
          
          return element.read().then((imageBuffer: Buffer) => {
            fs.writeFileSync(imagePath, imageBuffer);
            imageInfos.push({ filename: imageName, contentType: element.contentType });
            // Return empty src as we'll handle image references in markdown manually if needed
            // Or we can return a relative path
            return {
              src: `images/${imageName}`
            };
          });
        });
      }

      const result = await mammoth.convertToHtml({ path: sourcePath }, options);
      const html = result.value;
      const messages = result.messages;

      // Basic HTML to Markdown conversion (since we don't want to add more deps like turndown)
      // This is a simplified version, but mammoth's HTML is quite clean.
      let markdown = html
        .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<h4>(.*?)<\/h4>/gi, '#### $1\n\n')
        .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<b>(.*?)<\/b>/gi, '**$1**')
        .replace(/<em>(.*?)<\/em>/gi, '*$1*')
        .replace(/<i>(.*?)<\/i>/gi, '*$1*')
        .replace(/<ul>(.*?)<\/ul>/gis, '$1\n')
        .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<ol>(.*?)<\/ol>/gis, '$1\n')
        .replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<img src="(.*?)" \/>/gi, '![]($1)\n\n')
        // Table conversion
        .replace(/<table>(.*?)<\/table>/gis, (match, tableContent) => {
           let tableMd = '\n';
           const rows = tableContent.match(/<tr>(.*?)<\/tr>/gis) || [];
           rows.forEach((row: string, index: number) => {
             const cells = row.match(/<(td|th)>(.*?)<\/\1>/gis) || [];
             const cellTexts = cells.map((cell: string) => {
               return cell.replace(/<(td|th)>(.*?)<\/\1>/gis, '$2').trim();
             });
             tableMd += `| ${cellTexts.join(' | ')} |\n`;
             if (index === 0) {
               tableMd += `| ${cellTexts.map(() => '---').join(' | ')} |\n`;
             }
           });
           return tableMd + '\n';
        })
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');

      const mdPath = path.join(outputDir, `${baseName}.md`);
      fs.writeFileSync(mdPath, markdown);

      const llmOutput: string[] = [];
      llmOutput.push(`# DOCX Extraction Results`);
      llmOutput.push(`**Source:** ${this.params.source}`);
      llmOutput.push(`**Output directory:** \`${outputDir}\``);
      llmOutput.push(`**Markdown file:** \`${mdPath}\``);
      if (imageInfos.length > 0) {
        llmOutput.push(`**Images extracted:** ${imageInfos.length}`);
      }
      if (messages.length > 0) {
        llmOutput.push(`\n### Messages/Warnings:`);
        messages.forEach((m: any) => llmOutput.push(`- [${m.type}] ${m.message}`));
      }

      return {
        llmContent: llmOutput.join('\n'),
        returnDisplay: `Extracted ${baseName}.md and ${imageInfos.length} images`,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        llmContent: `DOCX extraction failed: ${errorMessage}`,
        returnDisplay: `Extraction failed: ${errorMessage}`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: errorMessage,
        },
      };
    }
  }
}

/**
 * Implementation of the DocxExtract tool logic
 */
export class DocxExtractTool extends BaseDeclarativeTool<
  DocxExtractParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.DOCX_EXTRACT;

  constructor() {
    super(
      DocxExtractTool.Name,
      ToolDisplayNames.DOCX_EXTRACT,
      'Extract text, images, and tables from DOCX files into structured markdown\n- Takes a .docx file path as input\n- Extracts all text content and saves as .md file\n- Extracts embedded images and saves them in images/ subfolder\n- Converts tables to markdown format\n- Default output: ./extract-doc/ in current working directory\n- Supports custom output directory via outputDir parameter',
      Kind.Read,
      {
        properties: {
          source: {
            description: 'Path to the local .docx file.',
            type: 'string',
          },
          outputDir: {
            description: 'Optional: directory to save extracted files to. Default: ./extract-doc',
            type: 'string',
          },
          extractImages: {
            description: 'Whether to extract embedded images. Default: true.',
            type: 'boolean',
          },
        },
        required: ['source'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: DocxExtractParams,
  ): string | null {
    if (!params.source || params.source.trim() === '') {
      return "The 'source' parameter cannot be empty.";
    }

    const filePath = path.resolve(params.source);
    if (!fs.existsSync(filePath)) {
      return `DOCX file not found: ${filePath}`;
    }
    if (!filePath.toLowerCase().endsWith('.docx')) {
      return `Source file does not appear to be a .docx: ${filePath}`;
    }

    return null;
  }

  protected createInvocation(
    params: DocxExtractParams,
  ): ToolInvocation<DocxExtractParams, ToolResult> {
    return new DocxExtractToolInvocation(params);
  }
}
