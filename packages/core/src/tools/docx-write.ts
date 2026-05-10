/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  ImageRun, 
  HeadingLevel, 
  AlignmentType,
  ExternalHyperlink,
  LevelFormat,
  WidthType,
  BorderStyle,
} from 'docx';
import { marked } from 'marked';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';

/**
 * Parameters for the DocxWrite tool
 */
export interface DocxWriteParams {
  /**
   * Path where the .docx file will be saved.
   */
  filePath: string;
  /**
   * Markdown content to be converted to DOCX.
   */
  content: string;
  /**
   * Optional: Title of the document.
   */
  title?: string;
  /**
   * Optional: Style configurations.
   */
  styles?: {
    font?: string;
    fontSize?: number; // In half-points (e.g., 24 for 12pt)
    headingFont?: string;
    styleMap?: {
      h1?: string;
      h2?: string;
      h3?: string;
      paragraph?: string;
    };
  };
}

/**
 * Implementation of the DocxWrite tool invocation logic
 */
class DocxWriteToolInvocation extends BaseToolInvocation<
  DocxWriteParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly config: Config,
    params: DocxWriteParams
  ) {
    super(params);
    this.debugLogger = createDebugLogger('DOCX_WRITE');
    this.debugLogger.debug(`Initializing DocxWriteToolInvocation for ${this.config.getTargetDir()}`);
  }

  getDescription(): string {
    return `Write DOCX file: ${this.params.filePath}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    this.debugLogger.debug(
      `[DocxWriteTool] Writing to: ${this.params.filePath}`,
    );

    try {
      if (signal.aborted) {
        return {
          llmContent: 'DOCX writing cancelled by user.',
          returnDisplay: 'Writing cancelled',
          error: {
            type: ToolErrorType.SCOPE_SEARCH_FAILED,
            message: 'Writing cancelled',
          },
        };
      }

      const filePath = path.resolve(this.params.filePath);
      const outputDir = path.dirname(filePath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const tokens = marked.lexer(this.params.content);
      const sections: any[] = [];

      // Default styles
      const font = this.params.styles?.font || 'Calibri';
      const fontSize = this.params.styles?.fontSize || 22; // 11pt
      const headingFont = this.params.styles?.headingFont || font;

      if (this.params.title) {
        sections.push(
          new Paragraph({
            text: this.params.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          })
        );
      }

      for (const token of tokens) {
        const result = this.tokenToDocxElement(token, { font, fontSize, headingFont, styleMap: this.params.styles?.styleMap });
        if (result) {
          if (Array.isArray(result)) {
            sections.push(...result);
          } else {
            sections.push(result);
          }
        }
      }

      const doc = new Document({
        styles: {
          default: {
            heading1: {
              run: { font: headingFont, size: 32, bold: true, color: '2E74B5' },
              paragraph: { spacing: { before: 240, after: 120 } },
            },
            heading2: {
              run: { font: headingFont, size: 28, bold: true, color: '2E74B5' },
              paragraph: { spacing: { before: 240, after: 120 } },
            },
            listParagraph: {
              run: { font, size: fontSize },
            }
          },
        },
        numbering: {
          config: [
            {
              reference: 'multi-level-numbering',
              levels: [
                { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                { level: 1, format: LevelFormat.DECIMAL, text: '%1.%2.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
              ],
            },
          ],
        },
        sections: [{
          properties: {},
          children: sections,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);

      return {
        llmContent: `Successfully wrote DOCX file to ${filePath}`,
        returnDisplay: `Wrote ${filePath}`,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.debugLogger.error(`[DocxWriteTool] Writing failed: ${errorMessage}`, error);
      return {
        llmContent: `DOCX writing failed: ${errorMessage}`,
        returnDisplay: `Writing failed: ${errorMessage}`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: errorMessage,
        },
      };
    }
  }

  private tokenToDocxElement(token: any, styles: any): any {
    switch (token.type) {
      case 'heading': {
        let level: any;
        let style: string | undefined;
        switch (token.depth) {
          case 1: 
            level = HeadingLevel.HEADING_1; 
            style = styles.styleMap?.h1;
            break;
          case 2: 
            level = HeadingLevel.HEADING_2; 
            style = styles.styleMap?.h2;
            break;
          case 3: 
            level = HeadingLevel.HEADING_3; 
            style = styles.styleMap?.h3;
            break;
          case 4: level = HeadingLevel.HEADING_4; break;
          case 5: level = HeadingLevel.HEADING_5; break;
          case 6: level = HeadingLevel.HEADING_6; break;
          default: level = HeadingLevel.HEADING_1;
        }
        return new Paragraph({
          text: token.text,
          heading: style ? undefined : level,
          style: style,
        });
      }

      case 'paragraph': {
        const children: any[] = [];
        
        // Handle inline tokens
        if (token.tokens) {
          for (const subToken of token.tokens) {
            const run = this.inlineTokenToDocxRun(subToken, styles);
            if (run) {
              if (Array.isArray(run)) children.push(...run);
              else children.push(run);
            }
          }
        } else {
          children.push(new TextRun({ text: token.text, font: styles.font, size: styles.fontSize }));
        }

        return new Paragraph({ 
          children,
          style: styles.styleMap?.paragraph,
        });
      }

      case 'list': {
        const items: Paragraph[] = [];
        token.items.forEach((item: any) => {
          const itemChildren: any[] = [];
          if (item.tokens) {
            item.tokens.forEach((t: any) => {
               if (t.type === 'text') {
                 if (t.tokens) {
                    t.tokens.forEach((st: any) => {
                        const run = this.inlineTokenToDocxRun(st, styles);
                        if (run) {
                          if (Array.isArray(run)) itemChildren.push(...run);
                          else itemChildren.push(run);
                        }
                    });
                 } else {
                    itemChildren.push(new TextRun({ text: t.text, font: styles.font, size: styles.fontSize }));
                 }
               }
            });
          }
          items.push(new Paragraph({
            children: itemChildren,
            bullet: token.ordered ? undefined : { level: 0 },
            numbering: token.ordered ? { reference: 'multi-level-numbering', level: 0 } : undefined,
          }));
        });
        return items;
      }

      case 'table': {
        const rows = [];
        
        // Header
        const headerCells = token.header.map((cell: any) => {
          return new TableCell({
            children: [
                new Paragraph({ 
                    children: [new TextRun({ text: cell.text || cell, bold: true, font: styles.font, size: styles.fontSize })] 
                })
            ],
            shading: { fill: 'F2F2F2' },
          });
        });
        rows.push(new TableRow({ children: headerCells }));

        // Body
        token.rows.forEach((row: any) => {
          const bodyCells = row.map((cell: any) => {
            return new TableCell({
              children: [
                  new Paragraph({ 
                      children: [new TextRun({ text: cell.text || cell, font: styles.font, size: styles.fontSize })] 
                  })
              ],
            });
          });
          rows.push(new TableRow({ children: bodyCells }));
        });

        return new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          }
        });
      }

      case 'blockquote': {
        return new Paragraph({
          text: token.text,
          indent: { left: 720 },
          border: { left: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 24 } }
        });
      }

      case 'code': {
        return new Paragraph({
          children: [new TextRun({ text: token.text, font: 'Courier New', size: styles.fontSize - 2 })],
          shading: { fill: 'F4F4F4' },
        });
      }

      case 'space': return null;

      default:
        this.debugLogger.debug(`[DocxWriteTool] Unsupported token type: ${token.type}`);
        return new Paragraph({ text: token.raw });
    }
  }

  private inlineTokenToDocxRun(token: any, styles: any): any {
    switch (token.type) {
      case 'text':
        return new TextRun({ text: token.text, font: styles.font, size: styles.fontSize });
      case 'strong':
        return new TextRun({ text: token.text, bold: true, font: styles.font, size: styles.fontSize });
      case 'em':
        return new TextRun({ text: token.text, italics: true, font: styles.font, size: styles.fontSize });
      case 'codespan':
        return new TextRun({ text: token.text, font: 'Courier New', size: styles.fontSize - 2, shading: { fill: 'F4F4F4' } });
      case 'link':
        return new ExternalHyperlink({
          children: [new TextRun({ text: token.text, color: '0563C1', underline: {}, font: styles.font, size: styles.fontSize })],
          link: token.href,
        });
      case 'image': {
        try {
          const imagePath = path.resolve(token.href);
          if (fs.existsSync(imagePath)) {
            const data = fs.readFileSync(imagePath);
            return new ImageRun({
              data,
              transformation: { width: 400, height: 300 },
            } as any);
          }
        } catch (e) {
          return new TextRun({ text: `[Image Error: ${token.href}]`, color: 'FF0000' });
        }
        return new TextRun({ text: `[Image Not Found: ${token.href}]`, color: 'FF0000' });
      }
      case 'br':
        return new TextRun({ break: 1 });
      
      // LaTeX support
      case 'escape':
        if (token.text.startsWith('$') || token.text.includes('\\')) {
            return new TextRun({ text: token.text, font: 'Cambria Math', size: styles.fontSize });
        }
        return new TextRun({ text: token.text, font: styles.font, size: styles.fontSize });

      default:
        if (token.raw.startsWith('$') && token.raw.endsWith('$')) {
            const latex = token.raw.slice(1, -1);
            return new TextRun({ text: latex, font: 'Cambria Math', size: styles.fontSize, italics: true });
        }
        return new TextRun({ text: token.text || token.raw, font: styles.font, size: styles.fontSize });
    }
  }
}

/**
 * Implementation of the DocxWrite tool logic
 */
export class DocxWriteTool extends BaseDeclarativeTool<
  DocxWriteParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.WRITE_DOCX;

  constructor(private readonly config: Config) {
    super(
      DocxWriteTool.Name,
      ToolDisplayNames.WRITE_DOCX,
      'Create a .docx file from markdown content\n- Supports headings, paragraphs, lists, tables, and images\n- Supports basic styling (font, font size)\n- Supports numbered subheadings\n- Supports inserting images from local paths\n- Supports LaTeX-like equations (uses Cambria Math font)\n- Ideal for generating reports or documents from markdown data',
      Kind.Edit,
      {
        properties: {
          filePath: {
            description: 'Path where the .docx file will be saved. Example: "./report.docx"',
            type: 'string',
          },
          content: {
            description: 'Markdown content to be converted to DOCX.',
            type: 'string',
          },
          title: {
            description: 'Optional: Title of the document.',
            type: 'string',
          },
          styles: {
            description: 'Optional: Style configurations.',
            type: 'object',
            properties: {
              font: { type: 'string', description: 'Body font family (default: Calibri)' },
              fontSize: { type: 'number', description: 'Font size in half-points (e.g., 24 for 12pt)' },
              headingFont: { type: 'string', description: 'Heading font family' },
              styleMap: {
                type: 'object',
                description: 'Optional: Map Markdown elements to DOCX style IDs.',
                properties: {
                  h1: { type: 'string', description: 'Style ID for H1' },
                  h2: { type: 'string', description: 'Style ID for H2' },
                  h3: { type: 'string', description: 'Style ID for H3' },
                  paragraph: { type: 'string', description: 'Style ID for paragraphs' },
                }
              }
            }
          },
        },
        required: ['filePath', 'content'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: DocxWriteParams,
  ): string | null {
    if (!params.filePath || params.filePath.trim() === '') {
      return "The 'filePath' parameter cannot be empty.";
    }
    if (!params.content || params.content.trim() === '') {
      return "The 'content' parameter cannot be empty.";
    }

    if (!params.filePath.toLowerCase().endsWith('.docx')) {
      return "The 'filePath' must end with '.docx'.";
    }

    return null;
  }

  protected createInvocation(
    params: DocxWriteParams,
  ): ToolInvocation<DocxWriteParams, ToolResult> {
    return new DocxWriteToolInvocation(this.config, params);
  }
}
