/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import _AdmZip from 'adm-zip';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AdmZip = (_AdmZip as any).default || _AdmZip;
import { XMLParser } from 'fast-xml-parser';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';

/**
 * Parameters for the DocxReadStyle tool
 */
export interface DocxReadStyleParams {
  /**
   * Path to the .docx file to read styles from.
   */
  filePath: string;
}

/**
 * Implementation of the DocxReadStyle tool invocation logic
 */
class DocxReadStyleToolInvocation extends BaseToolInvocation<
  DocxReadStyleParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly config: Config,
    params: DocxReadStyleParams,
  ) {
    super(params);
    this.debugLogger = createDebugLogger('DOCX_READ_STYLE');
    this.debugLogger.debug(
      `Initializing DocxReadStyleToolInvocation for ${this.config.getTargetDir()}`,
    );
  }

  getDescription(): string {
    return `Read styles from DOCX file: ${this.params.filePath}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    this.debugLogger.debug(
      `[DocxReadStyleTool] Reading styles from: ${this.params.filePath}`,
    );

    try {
      const filePath = path.resolve(this.params.filePath);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const zip = new AdmZip(filePath);
      const stylesEntry = zip.getEntry('word/styles.xml');
      if (!stylesEntry) {
        throw new Error('Could not find word/styles.xml in the DOCX file.');
      }

      const stylesXml = zip.readAsText(stylesEntry);
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      const jsonObj = parser.parse(stylesXml);

      const styles = [];
      const rawStyles = jsonObj['w:styles']?.['w:style'];

      if (rawStyles) {
        const styleArray = Array.isArray(rawStyles) ? rawStyles : [rawStyles];
        for (const s of styleArray) {
          const styleId = s['@_w:styleId'];
          const type = s['@_w:type'];
          const name = s['w:name']?.['@_w:val'];

          // Try to extract some basic formatting
          const rPr = s['w:rPr'];
          const font =
            rPr?.['w:rFonts']?.['@_w:ascii'] ||
            rPr?.['w:rFonts']?.['@_w:hAnsi'];
          const size = rPr?.['w:sz']?.['@_w:val'];
          const color = rPr?.['w:color']?.['@_w:val'];
          const bold = rPr?.['w:b'] !== undefined;
          const italic = rPr?.['w:i'] !== undefined;

          styles.push({
            id: styleId,
            name,
            type,
            formatting: {
              font,
              size: size ? parseInt(size, 10) : undefined,
              color,
              bold,
              italic,
            },
          });
        }
      }

      const output = {
        filePath: this.params.filePath,
        stylesCount: styles.length,
        styles,
      };

      return {
        llmContent: JSON.stringify(output, null, 2),
        returnDisplay: `Read ${styles.length} styles from ${this.params.filePath}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.debugLogger.error(
        `[DocxReadStyleTool] Reading styles failed: ${errorMessage}`,
        error,
      );
      return {
        llmContent: `Reading styles failed: ${errorMessage}`,
        returnDisplay: `Reading styles failed: ${errorMessage}`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: errorMessage,
        },
      };
    }
  }
}

/**
 * Implementation of the DocxReadStyle tool logic
 */
export class DocxReadStyleTool extends BaseDeclarativeTool<
  DocxReadStyleParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.READ_STYLE_DOCX;

  constructor(private readonly config: Config) {
    super(
      DocxReadStyleTool.Name,
      ToolDisplayNames.READ_STYLE_DOCX,
      `Read style definitions from an existing .docx file
- Extracts style IDs, names, and basic formatting (font, size, color)
- Useful for understanding the available styles in a template document
- Helps in maintaining consistency when generating new documents based on a template

Tool Name: read_style_docx
Parameters:
- filePath (string): Path to the .docx file to read styles from.`,
      Kind.Read,
      {
        properties: {
          filePath: {
            description: 'Path to the .docx file to read styles from.',
            type: 'string',
          },
        },
        required: ['filePath'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: DocxReadStyleParams,
  ): string | null {
    if (!params.filePath || params.filePath.trim() === '') {
      return "The 'filePath' parameter cannot be empty.";
    }
    if (!params.filePath.toLowerCase().endsWith('.docx')) {
      return "The 'filePath' must end with '.docx'.";
    }
    return null;
  }

  protected createInvocation(
    params: DocxReadStyleParams,
  ): ToolInvocation<DocxReadStyleParams, ToolResult> {
    return new DocxReadStyleToolInvocation(this.config, params);
  }
}
