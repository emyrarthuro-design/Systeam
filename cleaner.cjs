const fs = require('fs');
const path = require('path');

function processFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processFiles(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Rule 1: Remove console.log
      let newContent = "";
      let i = 0;
      while (i < content.length) {
        let idx = content.indexOf('console.log(', i);
        if (idx === -1) {
          newContent += content.slice(i);
          break;
        }
        
        // Ignore if commented out entirely (simple check - skip logic if needed, but we just remove it anyway)
        
        // Find start of indentation
        let startOfLine = idx;
        while (startOfLine > i && (content[startOfLine - 1] === ' ' || content[startOfLine - 1] === '\t')) {
          startOfLine--;
        }
        
        newContent += content.slice(i, startOfLine);
        
        // Find matching parenthesis
        let openCount = 0;
        let j = idx + 'console.log'.length;
        let commentOrString = false;
        let charType = null;
        for (; j < content.length; j++) {
           if (!commentOrString) {
             if (content[j] === "'" || content[j] === '"' || content[j] === '`') {
               commentOrString = true;
               charType = content[j];
             } else if (content[j] === '(') {
               openCount++;
             } else if (content[j] === ')') {
               openCount--;
               if (openCount === 0) {
                 j++;
                 break;
               }
             }
           } else {
             if (content[j] === charType && content[j-1] !== '\\') {
               commentOrString = false;
             }
           }
        }
        
        if (content[j] === ';') j++;
        if (content[j] === '\r' && content[j+1] === '\n') j += 2;
        else if (content[j] === '\n') j++;
        
        i = j;
      }
      
      // Rule 2: console.error -> if (import.meta.env.DEV) console.error
      newContent = newContent.replace(/(?<!if\s*\(\s*import\.meta\.env\.DEV\s*\)\s*)console\.error\(/g, 'if (import.meta.env.DEV) console.error(');
      
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
      }
    }
  }
}

processFiles('./src');
console.log("Cleanup complete!");
