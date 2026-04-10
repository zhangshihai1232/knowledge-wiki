'use strict';

const fs = require('fs');
const path = require('path');

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

function listMarkdownFiles(targetDir) {
  if (!fs.existsSync(targetDir)) { return []; }
  const results = [];
  const stack = [targetDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== '.gitkeep') {
        results.push(entryPath);
      }
    }
  }
  results.sort();
  return results;
}

function writeFileAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

module.exports = { normalizePath, listMarkdownFiles, writeFileAtomic };
