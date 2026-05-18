/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { glob } from 'glob';
import fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const coreVendorDir = join(root, 'packages', 'core', 'vendor');
const require = createRequire(import.meta.url);

// Create the dist directory if it doesn't exist
if (!existsSync(distDir)) {
  mkdirSync(distDir);
}

// Find and copy all .sb files from packages to the root of the dist directory
const sbFiles = glob.sync('packages/**/*.sb', { cwd: root });
for (const file of sbFiles) {
  copyFileSync(join(root, file), join(distDir, basename(file)));
}

console.log('Copied sandbox profiles to dist/');

// Copy vendor directory (contains ripgrep binaries)
console.log('Copying vendor directory...');
if (existsSync(coreVendorDir)) {
  const destVendorDir = join(distDir, 'vendor');
  copyRecursiveSync(coreVendorDir, destVendorDir);
  console.log('Copied vendor directory to dist/');
} else {
  console.warn(`Warning: Vendor directory not found at ${coreVendorDir}`);
}

// Copy bundled skills (e.g. /review) so they are available at runtime.
// In the esbuild bundle, import.meta.url resolves to dist/cli.js, so
// SkillManager looks for bundled skills at dist/bundled/.
const bundledSkillsDir = join(
  root,
  'packages',
  'core',
  'src',
  'skills',
  'bundled',
);
if (existsSync(bundledSkillsDir)) {
  const destBundledDir = join(distDir, 'bundled');
  copyRecursiveSync(bundledSkillsDir, destBundledDir);
  console.log('Copied bundled skills to dist/bundled/');
} else {
  console.warn(
    `Warning: Bundled skills directory not found at ${bundledSkillsDir}`,
  );
}

// Copy user docs into qc-helper bundled skill so it can reference them at runtime.
// The qc-helper skill reads docs from a `docs/` subdirectory relative to its own
// directory. In the esbuild bundle this becomes dist/bundled/qc-helper/docs/.
const userDocsDir = join(root, 'docs', 'users');
if (existsSync(userDocsDir)) {
  const destDocsDir = join(distDir, 'bundled', 'qc-helper', 'docs');
  copyRecursiveSync(userDocsDir, destDocsDir);
  console.log('Copied docs/users/ to dist/bundled/qc-helper/docs/');
} else {
  console.warn(`Warning: User docs directory not found at ${userDocsDir}`);
}

// Copy pdfjs-dist worker file.
// pdf-parse (used by PDFExtractTool) depends on pdfjs-dist, which loads a
// worker file (pdf.worker.mjs) via dynamic import() at runtime. esbuild cannot
// bundle this dynamically-loaded module, so we copy it to dist/ so it is
// co-located with cli.js when the package is published and installed globally.
const pdfjsWorkerPath =
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
const pdfWorkerDest = join(distDir, 'pdf.worker.mjs');
copyFileSync(pdfjsWorkerPath, pdfWorkerDest);
console.log(
  `Copied pdf.worker.mjs to dist/ (${(statSync(pdfjsWorkerPath).size / 1024).toFixed(0)}KB)`,
);

console.log('\n✅ All bundle assets copied to dist/');

/**
 * Recursively copy directory
 */
function copyRecursiveSync(src, dest) {
  if (!existsSync(src)) {
    return;
  }

  const stats = statSync(src);

  if (stats.isDirectory()) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      // Skip .DS_Store files
      if (entry === '.DS_Store') {
        continue;
      }

      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      copyRecursiveSync(srcPath, destPath);
    }
  } else {
    copyFileSync(src, dest);
    // Preserve execute permissions for binaries
    const srcStats = statSync(src);
    if (srcStats.mode & 0o111) {
      fs.chmodSync(dest, srcStats.mode);
    }
  }
}
