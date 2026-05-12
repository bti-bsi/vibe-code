const fs = require('fs');
const path = 'c:/Development/qwen-code/qwen-code/packages/core/src/tools/docx-write.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/result = this\.tokenToDocxElement/g, 'result = await this.tokenToDocxElement');
code = code.replace(/private tokenToDocxElement/g, 'private async tokenToDocxElement');
code = code.replace(/this\.renderInline\(token\.tokens, styles\)/g, 'await this.renderInline(token.tokens, styles)');
code = code.replace(/this\.renderInline\(t\.tokens, styles\)/g, 'await this.renderInline(t.tokens, styles)');
code = code.replace(/this\.renderInline\(cell\.tokens, cellStyles\)/g, 'await this.renderInline(cell.tokens, cellStyles)');
code = code.replace(/this\.renderInline\(cell\.tokens, styles\)/g, 'await this.renderInline(cell.tokens, styles)');
code = code.replace(/this\.renderInline\(token\.tokens, linkStyle\)/g, 'await this.renderInline(token.tokens, linkStyle)');
code = code.replace(/this\.renderInline\(token\.tokens, \{ \.\.\.styles, bold: true \}\)/g, 'await this.renderInline(token.tokens, { ...styles, bold: true })');
code = code.replace(/this\.renderInline\(token\.tokens, \{ \.\.\.styles, italics: true \}\)/g, 'await this.renderInline(token.tokens, { ...styles, italics: true })');
code = code.replace(/imgRun = this\.loadImageRun/g, 'imgRun = await this.loadImageRun');
code = code.replace(/private renderInline/g, 'private async renderInline');
code = code.replace(/private parseTextForImages/g, 'private async parseTextForImages');
code = code.replace(/private inlineTokenToDocxRun/g, 'private async inlineTokenToDocxRun');
code = code.replace(/private loadImageRun\(token: any, _styles: any\): any \{/g, 'private async loadImageRun(token: any, _styles: any): Promise<any> {');
code = code.replace(/run = this\.inlineTokenToDocxRun/g, 'run = await this.inlineTokenToDocxRun');
code = code.replace(/return this\.parseTextForImages/g, 'return await this.parseTextForImages');

// Replace loops for async
code = code.replace(
  /token\.items\.forEach\(\(item: any\) => \{/g,
  'for (const item of token.items) {'
);
code = code.replace(
  /item\.tokens\.forEach\(\(t: any\) => \{/g,
  'for (const t of item.tokens) {'
);
code = code.replace(
  /\}\);\n\n          if \(nestedElements\.length > 0\)/g,
  '}\n\n          if (nestedElements.length > 0)'
);
code = code.replace(
  /\}\);\n\n        return listItems;/g,
  '}\n\n        return listItems;'
);

code = code.replace(
  /const headerCells = token\.header\.map\(\(cell: any\) => \{/g,
  'const headerCells = await Promise.all(token.header.map(async (cell: any) => {'
);
code = code.replace(
  /\}\);\n        rows\.push\(new TableRow\(\{ children: headerCells \}\)\);/g,
  '}));\n        rows.push(new TableRow({ children: headerCells }));'
);

code = code.replace(
  /token\.rows\.forEach\(\(row: any\) => \{/g,
  'for (const row of token.rows) {'
);
code = code.replace(
  /const bodyCells = row\.map\(\(cell: any\) => \{/g,
  'const bodyCells = await Promise.all(row.map(async (cell: any) => {'
);
code = code.replace(
  /\}\);\n          rows\.push\(new TableRow\(\{ children: bodyCells \}\)\);\n        \}\);/g,
  '}));\n          rows.push(new TableRow({ children: bodyCells }));\n        }'
);

// Add fetch logic to loadImageRun
const newLoadImageRun = `
  private async loadImageRun(token: any, _styles: any): Promise<any> {
    const href: string = token.href || token.src || '';
    if (!href) {
      this.debugLogger.warn(\`[DocxWriteTool] Image token has no href/src\`);
      return new TextRun({ text: '[Image: missing path]', color: 'FF0000' });
    }

    if (href.startsWith('http://') || href.startsWith('https://')) {
      try {
        const response = await fetch(href);
        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const data = Buffer.from(arrayBuffer);
        
        return new ImageRun({
          data,
          transformation: { width: 450, height: 338 },
        } as any);
      } catch (e) {
        this.debugLogger.error(
          \`[DocxWriteTool] Error fetching remote image "\${href}": \${e}\`,
        );
        return new TextRun({
          text: \`[Image Error: \${href}]\`,
          color: 'FF0000',
        });
      }
    }

    // Candidate paths in priority order`;

code = code.replace(
  /private async loadImageRun\(token: any, _styles: any\): Promise<any> \{\s*const href: string = token\.href \|\| token\.src \|\| '';\s*if \(!href\) \{\s*this\.debugLogger\.warn\(`\[DocxWriteTool\] Image token has no href\/src`\);\s*return new TextRun\(\{ text: '\[Image: missing path\]', color: 'FF0000' \}\);\s*\}\s*\/\/ Candidate paths in priority order/,
  newLoadImageRun.trim()
);

fs.writeFileSync('c:/Development/qwen-code/qwen-code/packages/core/src/tools/docx-write-patched.ts', code);
console.log('Done');
