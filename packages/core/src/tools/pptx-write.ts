/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';
import { marked } from 'marked';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { createDebugLogger, type DebugLogger } from '../utils/debugLogger.js';

/**
 * Predefined styles for PPTX
 */
const PPTX_PRESETS: Record<string, any> = {
  professional: {
    background: 'F1F1F1',
    titleColor: '002060',
    bodyColor: '333333',
    fontFace: 'Arial',
    accentColor: '0070C0'
  },
  ecommerce: {
    background: 'FFFFFF',
    titleColor: 'FF6600',
    bodyColor: '444444',
    fontFace: 'Segoe UI',
    accentColor: '0088CC'
  },
  futuristic: {
    background: '0A0A2A',
    titleColor: '00FFFF',
    bodyColor: 'E0E0E0',
    fontFace: 'Courier New',
    accentColor: 'FF00FF'
  },
  babies: {
    background: 'FFF5E1',
    titleColor: 'FF69B4',
    bodyColor: '5F9EA0',
    fontFace: 'Comic Sans MS',
    accentColor: '98FB98'
  },
  techno: {
    background: '000000',
    titleColor: '00FF00',
    bodyColor: '00CC00',
    fontFace: 'Consolas',
    accentColor: '003300'
  }
};

/**
 * Parameters for the WritePptx tool
 */
export interface WritePptxParams {
  /**
   * Path where the .pptx file will be saved.
   */
  filePath: string;
  /**
   * Markdown content to be converted to PPTX slides.
   */
  content: string;
  /**
   * Optional: Title of the presentation.
   */
  title?: string;
  /**
   * Optional: Predefined style preset.
   */
  preset?: 'professional' | 'ecommerce' | 'futuristic' | 'babies' | 'techno';
  /**
   * Optional: Custom theme configurations (overrides preset).
   */
  theme?: {
    background?: string; // hex color
    font?: string;
    titleColor?: string;
    bodyColor?: string;
  };
}

/**
 * Implementation of the WritePptx tool invocation logic
 */
class WritePptxToolInvocation extends BaseToolInvocation<
  WritePptxParams,
  ToolResult
> {
  private readonly debugLogger: DebugLogger;

  constructor(
    private readonly config: Config,
    params: WritePptxParams
  ) {
    super(params);
    this.debugLogger = createDebugLogger('WRITE_PPTX');
    this.debugLogger.debug(`Initializing WritePptxToolInvocation for ${this.config.getTargetDir()}`);
  }

  getDescription(): string {
    return `Write PPTX file: ${this.params.filePath}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    this.debugLogger.debug(
      `[WritePptxTool] Writing to: ${this.params.filePath}`,
    );

    try {
      if (signal.aborted) {
        return {
          llmContent: 'PPTX writing cancelled by user.',
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

      // @ts-ignore
      const pres = new pptxgen();
      
      // Select preset or default
      const style = PPTX_PRESETS[this.params.preset || 'professional'];
      const bg = this.params.theme?.background || style.background;
      const font = this.params.theme?.font || style.fontFace;
      const titleColor = this.params.theme?.titleColor || style.titleColor;
      const bodyColor = this.params.theme?.bodyColor || style.bodyColor;

      if (this.params.title) {
        pres.title = this.params.title;
        // Create title slide
        const slide = pres.addSlide();
        if (bg) slide.background = { fill: bg };
        slide.addText(this.params.title, {
          x: '10%', y: '40%', w: '80%', h: '20%',
          fontSize: 44, align: pres.AlignH.center, bold: true,
          color: titleColor, fontFace: font
        });
      }

      const tokens = marked.lexer(this.params.content);
      let currentSlide: any = null;
      let yOffset = 0.5;

      const addSlide = (slideTitle: string) => {
        currentSlide = pres.addSlide();
        if (bg) currentSlide.background = { fill: bg };
        
        // Add a small accent line or shape for some presets
        if (this.params.preset === 'techno') {
           currentSlide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: style.accentColor } });
        }

        currentSlide.addText(slideTitle, {
          x: 0.5, y: 0.3, w: '90%', h: 0.8,
          fontSize: 28, bold: true, color: titleColor,
          fontFace: font
        });
        yOffset = 1.2;
      };

      for (const token of tokens) {
        if (token.type === 'heading') {
          if (token.depth <= 2) {
            addSlide(token.text);
          } else {
            if (!currentSlide) addSlide('Slide');
            currentSlide.addText(token.text, {
              x: 0.5, y: yOffset, w: '90%', h: 0.4,
              fontSize: 20, bold: true, color: titleColor,
              fontFace: font
            });
            yOffset += 0.5;
          }
        } else if (token.type === 'paragraph') {
          if (!currentSlide) addSlide('Slide');
          
          // Handle images in paragraph
          const images = token.tokens?.filter((t: any) => t.type === 'image');
          if (images && images.length > 0) {
            for (const imgToken of images) {
              const img = imgToken as any;
              try {
                const imgPath = path.resolve(img.href);
                if (fs.existsSync(imgPath)) {
                  const data = fs.readFileSync(imgPath, { encoding: 'base64' });
                  currentSlide!.addImage({
                    data: `data:image/png;base64,${data}`,
                    x: 0.5, y: yOffset, w: 4, h: 3
                  });
                  yOffset += 3.2;
                }
              } catch (e) {
                this.debugLogger.warn(`Failed to add image: ${img.href}`);
              }
            }
          } else {
            currentSlide!.addText(token.text, {
              x: 0.5, y: yOffset, w: '90%', h: 1,
              fontSize: 16, color: bodyColor, align: pres.AlignH.left,
              valign: pres.AlignV.top, fontFace: font
            });
            yOffset += 1.2;
          }
        } else if (token.type === 'list') {
          if (!currentSlide) addSlide('Slide');
          const listItems = token.items.map((item: any) => {
              return { text: item.text, options: { bullet: true, color: bodyColor, fontFace: font } };
          });
          currentSlide!.addText(listItems, {
            x: 0.5, y: yOffset, w: '90%', h: 2,
            fontSize: 14,
            valign: pres.AlignV.top
          });
          yOffset += 2.2;
        }

        // Auto-create new slide if yOffset exceeds limit
        if (yOffset > 6.5) {
          addSlide('Continued...');
        }
      }

      await pres.writeFile({ fileName: filePath });

      return {
        llmContent: `Successfully wrote PPTX file to ${filePath} using preset ${this.params.preset || 'professional'}`,
        returnDisplay: `Wrote ${filePath} (${this.params.preset || 'professional'})`,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.debugLogger.error(`[WritePptxTool] Writing failed: ${errorMessage}`, error);
      return {
        llmContent: `PPTX writing failed: ${errorMessage}`,
        returnDisplay: `Writing failed: ${errorMessage}`,
        error: {
          type: ToolErrorType.SCOPE_SEARCH_FAILED,
          message: errorMessage,
        },
      };
    }
  }
}

/**
 * Implementation of the WritePptx tool logic
 */
export class WritePptxTool extends BaseDeclarativeTool<
  WritePptxParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.WRITE_PPTX;

  constructor(private readonly config: Config) {
    super(
      WritePptxTool.Name,
      ToolDisplayNames.WRITE_PPTX,
      'Create a .pptx presentation from markdown content with professional presets\n- Presets: professional, ecommerce, futuristic, babies, techno\n- Supports headings (as slide titles), paragraphs, and lists\n- Supports basic image insertion from local paths\n- Automatically creates slides based on heading structure',
      Kind.Edit,
      {
        properties: {
          filePath: {
            description: 'Path where the .pptx file will be saved. Example: "./presentation.pptx"',
            type: 'string',
          },
          content: {
            description: 'Markdown content to be converted to PPTX.',
            type: 'string',
          },
          title: {
            description: 'Optional: Title of the presentation.',
            type: 'string',
          },
          preset: {
            description: 'Optional: Predefined style preset.',
            type: 'string',
            enum: ['professional', 'ecommerce', 'futuristic', 'babies', 'techno']
          },
          theme: {
            description: 'Optional: Theme configurations (overrides preset).',
            type: 'object',
            properties: {
              background: { type: 'string', description: 'Background hex color (e.g., "FFFFFF")' },
              font: { type: 'string', description: 'Font family' },
              titleColor: { type: 'string', description: 'Title text color' },
              bodyColor: { type: 'string', description: 'Body text color' },
            }
          },
        },
        required: ['filePath', 'content'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: WritePptxParams,
  ): string | null {
    if (!params.filePath || params.filePath.trim() === '') {
      return "The 'filePath' parameter cannot be empty.";
    }
    if (!params.content || params.content.trim() === '') {
      return "The 'content' parameter cannot be empty.";
    }

    if (!params.filePath.toLowerCase().endsWith('.pptx')) {
      return "The 'filePath' must end with '.pptx'.";
    }

    return null;
  }

  protected createInvocation(
    params: WritePptxParams,
  ): ToolInvocation<WritePptxParams, ToolResult> {
    return new WritePptxToolInvocation(this.config, params);
  }
}
