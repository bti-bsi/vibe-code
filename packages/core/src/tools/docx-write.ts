/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  ThematicBreak,
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
  private listCounter = 0;
  private numberingConfigs: any[] = [];

  constructor(
    private readonly config: Config,
    params: DocxWriteParams,
  ) {
    super(params);
    this.debugLogger = createDebugLogger('DOCX_WRITE');
    this.debugLogger.debug(
      `Initializing DocxWriteToolInvocation for ${this.config.getTargetDir()}`,
    );
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
      const font = this.params.styles?.font || 'Times New Roman';
      const fontSize = this.params.styles?.fontSize || 24; // 12pt
      const headingFont = this.params.styles?.headingFont || font;

      if (this.params.title) {
        sections.push(
          new Paragraph({
            text: this.params.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
        );
      }

      this.listCounter = 0;
      this.numberingConfigs = [];

      for (const token of tokens) {
        const result = await this.tokenToDocxElement(token, {
          font,
          fontSize,
          headingFont,
          styleMap: this.params.styles?.styleMap,
        });
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
            document: {
              run: {
                font,
                size: fontSize,
              },
              paragraph: {
                alignment: AlignmentType.JUSTIFIED,
              },
            },
            heading1: {
              run: { font: headingFont, size: 32, bold: true, color: '2E74B5' },
              paragraph: {
                spacing: { before: 240, after: 120 },
                alignment: AlignmentType.START,
              },
            },
            heading2: {
              run: { font: headingFont, size: 28, bold: true, color: '2E74B5' },
              paragraph: {
                spacing: { before: 240, after: 120 },
                alignment: AlignmentType.START,
              },
            },
            listParagraph: {
              run: { font, size: fontSize },
              paragraph: {
                alignment: AlignmentType.START,
              },
            },
          },
        },
        numbering: {
          config: this.numberingConfigs,
        },
        sections: [
          {
            properties: {},
            children: sections,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);

      return {
        llmContent: `Successfully wrote DOCX file to ${filePath}`,
        returnDisplay: `Wrote ${filePath}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.debugLogger.error(
        `[DocxWriteTool] Writing failed: ${errorMessage}`,
        error,
      );
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

  private async tokenToDocxElement(
    token: any,
    styles: any,
    listContext?: { reference?: string; level: number },
  ): Promise<any> {
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
          case 4:
            level = HeadingLevel.HEADING_4;
            break;
          case 5:
            level = HeadingLevel.HEADING_5;
            break;
          case 6:
            level = HeadingLevel.HEADING_6;
            break;
          default:
            level = HeadingLevel.HEADING_1;
        }
        return new Paragraph({
          children: token.tokens
            ? await this.renderInline(token.tokens, styles)
            : [
                new TextRun({
                  text: token.text,
                  font: styles.font,
                  size: styles.fontSize,
                }),
              ],
          heading: style ? undefined : level,
          style,
        });
      }

      case 'paragraph': {
        // Detect if this paragraph contains only image token(s)
        // In that case, render each image as its own standalone paragraph
        if (token.tokens && this.isImageOnlyParagraph(token.tokens)) {
          const imageResults: any[] = [];
          for (const t of token.tokens) {
            if (t.type === 'image') {
              const imgRun = await this.loadImageRun(t, styles);
              if (this.isImageRun(imgRun)) {
                // Image paragraph - centered
                imageResults.push(
                  new Paragraph({
                    children: [imgRun],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 120, after: 60 },
                  }),
                );
                // Optional caption using alt text
                if (t.text) {
                  imageResults.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: t.text,
                          font: styles.font,
                          size: styles.fontSize - 2,
                          italics: true,
                          color: '666666',
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 120 },
                    }),
                  );
                }
              } else {
                // Fallback: image not found, render as text
                imageResults.push(new Paragraph({ children: [imgRun] }));
              }
            }
          }
          return imageResults;
        }

        return new Paragraph({
          children: token.tokens
            ? await this.renderInline(token.tokens, styles)
            : [
                new TextRun({
                  text: token.text,
                  font: styles.font,
                  size: styles.fontSize,
                }),
              ],
          style: styles.styleMap?.paragraph,
        });
      }

      case 'list': {
        const listItems: Paragraph[] = [];
        const isOrdered = token.ordered;
        const currentLevel = listContext?.level || 0;

        // Use a new numbering instance for each top-level list to ensure numbering restarts.
        // For nested lists, we share the same instance but increase the level.
        let reference = listContext?.reference;
        if (isOrdered && !reference) {
          this.listCounter++;
          reference = `ordered-list-${this.listCounter}`;
          this.numberingConfigs.push({
            reference,
            levels: Array.from({ length: 9 }).map((_, i) => ({
              level: i,
              format: LevelFormat.DECIMAL,
              text:
                i === 0
                  ? '%1.'
                  : Array.from({ length: i + 1 })
                      .map((_, j) => `%${j + 1}`)
                      .join('.') + '.',
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720 * (i + 1), hanging: 360 },
                },
              },
            })),
          });
        }

        for (const item of token.items) {
          const itemChildren: any[] = [];
          const nestedElements: any[] = [];

          if (item.tokens) {
            for (const t of item.tokens) {
              if (t.type === 'text') {
                if (t.tokens) {
                  itemChildren.push(
                    ...(await this.renderInline(t.tokens, styles)),
                  );
                } else {
                  itemChildren.push(
                    new TextRun({
                      text: t.text,
                      font: styles.font,
                      size: styles.fontSize,
                    }),
                  );
                }
              } else if (t.type === 'list') {
                const nested = await this.tokenToDocxElement(t, styles, {
                  reference: t.ordered ? reference : undefined,
                  level: currentLevel + 1,
                });
                if (Array.isArray(nested)) {
                  nestedElements.push(...nested);
                } else {
                  nestedElements.push(nested);
                }
              }
            }
          }

          listItems.push(
            new Paragraph({
              children: itemChildren,
              bullet: isOrdered ? undefined : { level: currentLevel },
              numbering: isOrdered
                ? { reference: reference!, level: currentLevel }
                : undefined,
            }),
          );

          if (nestedElements.length > 0) {
            listItems.push(...nestedElements);
          }
        }

        return listItems;
      }

      case 'table': {
        const rows = [];

        // Header
        const headerCells = await Promise.all(
          token.header.map(async (cell: any) => {
            const cellStyles = { ...styles, bold: true };
            const children = cell.tokens
              ? await this.renderInline(cell.tokens, cellStyles)
              : [
                  new TextRun({
                    text: cell.text || cell,
                    bold: true,
                    font: styles.font,
                    size: styles.fontSize,
                  }),
                ];

            return new TableCell({
              children: [new Paragraph({ children })],
              shading: { fill: 'F2F2F2' },
            });
          }),
        );
        rows.push(new TableRow({ children: headerCells }));

        // Body
        for (const row of token.rows) {
          const bodyCells = await Promise.all(
            row.map(async (cell: any) => {
              const children = cell.tokens
                ? await this.renderInline(cell.tokens, styles)
                : [
                    new TextRun({
                      text: cell.text || cell,
                      font: styles.font,
                      size: styles.fontSize,
                    }),
                  ];

              return new TableCell({
                children: [new Paragraph({ children })],
              });
            }),
          );
          rows.push(new TableRow({ children: bodyCells }));
        }

        return new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        });
      }

      case 'blockquote': {
        const children = token.tokens
          ? await this.renderInline(token.tokens, styles)
          : [
              new TextRun({
                text: token.text,
                font: styles.font,
                size: styles.fontSize,
              }),
            ];
        return new Paragraph({
          children,
          indent: { left: 720 },
          border: {
            left: {
              color: 'CCCCCC',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 24,
            },
          },
        });
      }

      case 'code': {
        return new Paragraph({
          children: [
            new TextRun({
              text: token.text,
              font: 'Courier New',
              size: styles.fontSize - 2,
            }),
          ],
          shading: { fill: 'F4F4F4' },
        });
      }

      case 'hr': {
        return new ThematicBreak();
      }

      case 'image': {
        // Block-level image (e.g. if marked parses it directly)
        const imgRun = await this.loadImageRun(token, styles);
        return new Paragraph({
          children: [imgRun],
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
        });
      }

      case 'space':
        return null;

      default:
        this.debugLogger.debug(
          `[DocxWriteTool] Unsupported token type: ${token.type}`,
        );
        return new Paragraph({ text: token.raw });
    }
  }

  /**
   * Detects whether a list of inline tokens represents a paragraph
   * that contains only image(s) — possibly with whitespace.
   */
  private isImageOnlyParagraph(tokens: any[]): boolean {
    const meaningful = tokens.filter(
      (t) => !(t.type === 'text' && t.text.trim() === ''),
    );
    return meaningful.length > 0 && meaningful.every((t) => t.type === 'image');
  }

  /**
   * Checks whether an element is an ImageRun by duck-typing.
   * More reliable than instanceof ImageRun in bundled/esbuild contexts.
   */
  private isImageRun(element: any): boolean {
    return (
      element &&
      typeof element === 'object' &&
      ('Data' in element ||
        'imageData' in element ||
        'Transformation' in element)
    );
  }

  /**
   * Loads an image from disk and returns an ImageRun, or a TextRun fallback.
   * Tries multiple paths:
   *   1. Direct path.resolve(href) — relative to CWD
   *   2. path.join(targetDir, href) — relative to project target
   *   3. path.join(outputDir, href) — relative to the output .docx file's directory
   */
  private async loadImageRun(token: any, _styles: any): Promise<any> {
    let href: string = token.href || token.src || '';
    if (!href) {
      this.debugLogger.warn(`[DocxWriteTool] Image token has no href/src`);
      return new TextRun({ text: '[Image: missing path]', color: 'FF0000' });
    }

    if (href.startsWith('data:image/')) {
      try {
        const base64Data = href.split(',')[1];
        if (base64Data) {
          const data = Buffer.from(base64Data, 'base64');
          return new ImageRun({
            data,
            transformation: { width: 450, height: 338 },
          } as any);
        }
      } catch (e) {
        this.debugLogger.error(
          `[DocxWriteTool] Error parsing base64 image: ${e}`,
        );
      }
    }

    if (href.startsWith('file://')) {
      try {
        const { fileURLToPath } = await import('node:url');
        href = fileURLToPath(href);
      } catch (_e) {
        href = href.replace(/^file:\/\//, '');
      }
    }

    if (href.startsWith('http://') || href.startsWith('https://')) {
      try {
        const response = await fetch(href);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const data = Buffer.from(arrayBuffer);

        return new ImageRun({
          data,
          transformation: { width: 450, height: 338 },
        } as any);
      } catch (e) {
        this.debugLogger.error(
          `[DocxWriteTool] Error fetching remote image "${href}": ${e}`,
        );
        return new TextRun({
          text: `[Image Error: ${href}]`,
          color: 'FF0000',
        });
      }
    }

    // Remove query parameters or hashes that might exist in markdown local links
    const cleanHref = href.split('?')[0].split('#')[0];

    // Candidate paths in priority order
    const candidates = [
      path.resolve(cleanHref),
      path.resolve(process.cwd(), cleanHref),
      path.join(this.config.getTargetDir(), cleanHref),
      path.join(path.dirname(path.resolve(this.params.filePath)), cleanHref),
    ];

    // Deduplicate normalized paths
    const seen = new Set<string>();
    const uniqueCandidates: string[] = [];
    for (const c of candidates) {
      const normalized = path.resolve(c);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueCandidates.push(normalized);
      }
    }

    let resolvedPath: string | null = null;
    for (const candidate of uniqueCandidates) {
      if (fs.existsSync(candidate)) {
        resolvedPath = candidate;
        break;
      }
    }

    if (!resolvedPath) {
      this.debugLogger.warn(
        `[DocxWriteTool] Image not found: "${href}" tried: ${uniqueCandidates.join(', ')}`,
      );
      return new TextRun({
        text: `[Image Not Found: ${href}]`,
        color: 'FF0000',
      });
    }

    try {
      const data = fs.readFileSync(resolvedPath);
      this.debugLogger.debug(
        `[DocxWriteTool] Embedding image: ${resolvedPath} (${data.length} bytes)`,
      );

      return new ImageRun({
        data,
        transformation: { width: 450, height: 338 }, // ~4:3 default aspect
      } as any);
    } catch (e) {
      this.debugLogger.error(
        `[DocxWriteTool] Error reading image "${resolvedPath}": ${e}`,
      );
      return new TextRun({
        text: `[Image Error: ${href}]`,
        color: 'FF0000',
      });
    }
  }

  private async renderInline(tokens: any[], styles: any): Promise<any[]> {
    const children: any[] = [];
    for (const token of tokens) {
      const run = await this.inlineTokenToDocxRun(token, styles);
      if (run) {
        if (Array.isArray(run)) {
          children.push(...run);
        } else {
          children.push(run);
        }
      }
    }
    return children;
  }

  private async parseTextForImages(
    text: string,
    styles: any,
    inherited: any,
  ): Promise<any[]> {
    const results: any[] = [];
    // Match markdown images ![alt](url) or the custom text (Gambar alt: Lihat url)
    const regex =
      /!\[([^\]]*)\]\(([^)]+)\)|\(Gambar\s+(.*?):\s*Lihat\s+(.*?)\)/gi;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        results.push(
          new TextRun({
            ...inherited,
            text: text.substring(lastIndex, match.index),
          }),
        );
      }

      const alt = match[1] !== undefined ? match[1] : match[3] || '';
      const href = match[2] !== undefined ? match[2] : match[4] || '';

      const imgRun = await this.loadImageRun(
        { href: href.trim(), text: alt.trim() },
        styles,
      );
      results.push(imgRun);

      lastIndex = regex.lastIndex;
    }

    if (lastIndex === 0) {
      // No matches, just return the whole text
      return [new TextRun({ ...inherited, text })];
    }

    if (lastIndex < text.length) {
      results.push(
        new TextRun({
          ...inherited,
          text: text.substring(lastIndex),
        }),
      );
    }

    return results;
  }

  private async inlineTokenToDocxRun(token: any, styles: any): Promise<any> {
    const inherited = {
      font: styles.font,
      size: styles.fontSize,
      bold: styles.bold || false,
      italics: styles.italics || false,
      color: styles.color,
      underline: styles.underline,
    };

    switch (token.type) {
      case 'text':
        return await this.parseTextForImages(token.text, styles, inherited);
      case 'strong':
        if (token.tokens) {
          return await this.renderInline(token.tokens, {
            ...styles,
            bold: true,
          });
        }
        return new TextRun({
          ...inherited,
          text: token.text,
          bold: true,
        });
      case 'em':
        if (token.tokens) {
          return await this.renderInline(token.tokens, {
            ...styles,
            italics: true,
          });
        }
        return new TextRun({
          ...inherited,
          text: token.text,
          italics: true,
        });
      case 'codespan':
        return new TextRun({
          ...inherited,
          text: token.text,
          font: 'Courier New',
          size: styles.fontSize - 2,
          shading: { fill: 'F4F4F4' },
        });
      case 'link': {
        const linkStyle = {
          ...styles,
          color: '0563C1',
          underline: {},
        };
        return new ExternalHyperlink({
          children: token.tokens
            ? await this.renderInline(token.tokens, linkStyle)
            : [
                new TextRun({
                  ...inherited,
                  text: token.text,
                  color: '0563C1',
                  underline: {},
                }),
              ],
          link: token.href,
        });
      }
      case 'image': {
        // Delegate to loadImageRun for consistent path resolution
        const imgRun = await this.loadImageRun(token, styles);
        return imgRun;
      }
      case 'br':
        return new TextRun({ break: 1 });

      // LaTeX support
      case 'escape':
        if (token.text.startsWith('$') || token.text.includes('\\')) {
          return new TextRun({
            ...inherited,
            text: token.text,
            font: 'Cambria Math',
          });
        }
        return new TextRun({
          ...inherited,
          text: token.text,
        });

      default:
        if (token.raw && token.raw.startsWith('$') && token.raw.endsWith('$')) {
          const latex = token.raw.slice(1, -1);
          return new TextRun({
            ...inherited,
            text: latex,
            font: 'Cambria Math',
            italics: true,
          });
        }
        return new TextRun({
          ...inherited,
          text: token.text || token.raw,
        });
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
      `Create a .docx file from markdown content
- Supports headings, paragraphs, lists, tables, and images
- Supports basic styling (font, font size)
- Supports numbered subheadings
- Supports inserting images from local paths
- Supports LaTeX-like equations (uses Cambria Math font)
- Ideal for generating reports or documents from markdown data

Tool Name: write_docx
Parameters:
- filePath (string): Path where the .docx file will be saved. Example: "./report.docx"
- content (string): Markdown content to be converted to DOCX.
- title (string): Optional: Title of the document.
- styles (object): Optional: Style configurations.`,
      Kind.Edit,
      {
        properties: {
          filePath: {
            description:
              'Path where the .docx file will be saved. Example: "./report.docx"',
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
              font: {
                type: 'string',
                description: 'Body font family (default: Calibri)',
              },
              fontSize: {
                type: 'number',
                description: 'Font size in half-points (e.g., 24 for 12pt)',
              },
              headingFont: {
                type: 'string',
                description: 'Heading font family',
              },
              styleMap: {
                type: 'object',
                description:
                  'Optional: Map Markdown elements to DOCX style IDs.',
                properties: {
                  h1: { type: 'string', description: 'Style ID for H1' },
                  h2: { type: 'string', description: 'Style ID for H2' },
                  h3: { type: 'string', description: 'Style ID for H3' },
                  paragraph: {
                    type: 'string',
                    description: 'Style ID for paragraphs',
                  },
                },
              },
            },
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
