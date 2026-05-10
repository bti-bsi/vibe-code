import fs from 'node:fs';
import path from 'node:path';

const baseDir = 'c:/Development/vibe-code/vibe-code';

function processDir(dir) {
  if (dir.includes('node_modules') || dir.includes('dist') || dir.includes('.git') || dir.includes('coverage')) {
    return;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (e) {
      continue;
    }
    
    if (stats.isDirectory()) {
      processDir(filePath);
    } else {
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (e) {
        continue;
      }
      
      const newContent = content
        .replace(/Vibe Code/g, 'Vibe Code')
        .replace(/Vibe code/g, 'Vibe code')
        .replace(/vibe code/g, 'vibe code')
        .replace(/VIBE\.md/g, 'VIBE\.md')
        .replace(/Vibe OAuth/g, 'Vibe OAuth')
        .replace(/Vibe/g, 'Vibe')
        .replace(/vibe-code/g, 'vibe-code')
        .replace(/vibe auth/g, 'vibe auth')
        .replace(/\.vibe/g, '.vibe')
        .replace(/vibe-oauth/g, 'vibe-oauth')
        .replace(/VIBE_/g, 'VIBE_')
        .replace(/vibe_/g, 'vibe_')
        .replace(/vibe/g, 'vibe')
        .replace(/\bQWEN\b/g, 'VIBE');
        
      if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated content of ${path.relative(baseDir, filePath)}`);
      }

      // Rename file if it contains Vibe
      const fileNameLower = file.toLowerCase();
      if (fileNameLower.includes('vibe')) {
        const newFile = file
          .replace(/VIBE/g, 'VIBE')
          .replace(/Vibe/g, 'Vibe')
          .replace(/vibe/g, 'vibe');
        const newFilePath = path.join(dir, newFile);
        if (filePath !== newFilePath) {
          try {
            fs.renameSync(filePath, newFilePath);
            console.log(`Renamed file ${file} to ${newFile}`);
          } catch (e) {
            console.error(`Failed to rename ${file}: ${e.message}`);
          }
        }
      }
    }
  }
}

processDir(baseDir);
console.log('Final Universal Rebrand Complete!');
