const fs = require('fs');
const path = require('path');

// Files to process with their types
const filesToProcess = [
  { file: 'server.js', type: 'javascript' },
  { file: 'index.html', type: 'html' },
  { file: 'booking.html', type: 'html' },
  { file: 'admin.html', type: 'html' }
];

// JavaScript console log patterns to replace
const jsConsolePatterns = [
  {
    pattern: /console\.log\(([^)]+)\);?/g,
    replacement: 'logger.info($1);'
  },
  {
    pattern: /console\.error\(([^)]+)\);?/g,
    replacement: 'logger.error($1);'
  },
  {
    pattern: /console\.warn\(([^)]+)\);?/g,
    replacement: 'logger.warn($1);'
  },
  {
    pattern: /console\.info\(([^)]+)\);?/g,
    replacement: 'logger.info($1);'
  }
];

// HTML console log patterns (only in script tags)
const htmlConsolePatterns = [
  {
    pattern: /(<script[^>]*>[\s\S]*?)console\.log\(([^)]+)\);?([\s\S]*?<\/script>)/g,
    replacement: '$1logger.info($2);$3'
  },
  {
    pattern: /(<script[^>]*>[\s\S]*?)console\.error\(([^)]+)\);?([\s\S]*?<\/script>)/g,
    replacement: '$1logger.error($2);$3'
  },
  {
    pattern: /(<script[^>]*>[\s\S]*?)console\.warn\(([^)]+)\);?([\s\S]*?<\/script>)/g,
    replacement: '$1logger.warn($2);$3'
  }
];

// Debug patterns that should be removed in production
const debugPatterns = [
  /console\.log\(['"`]🔍.*?['"`]\);?/g,
  /console\.log\(['"`]📄.*?['"`]\);?/g,
  /console\.log\(['"`]🔧.*?['"`]\);?/g,
  /console\.log\(['"`]🚀.*?['"`]\);?/g,
  /console\.log\(['"`]✅.*?['"`]\);?/g,
  /console\.log\(['"`]⚠️.*?['"`]\);?/g,
  /console\.log\(['"`]🔄.*?['"`]\);?/g,
  /console\.log\(['"`]📧.*?['"`]\);?/g,
  /console\.log\(['"`]❌.*?['"`]\);?/g,
  /console\.log\(['"`]ℹ️.*?['"`]\);?/g
];

function processFile(filePath, fileType) {
  try {
    console.log(`Processing ${filePath} (${fileType})...`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} does not exist, skipping...`);
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;
    
    if (fileType === 'javascript') {
      // Process JavaScript files
      jsConsolePatterns.forEach(({ pattern, replacement }) => {
        const matches = content.match(pattern);
        if (matches) {
          content = content.replace(pattern, replacement);
          changes += matches.length;
          console.log(`  Replaced ${matches.length} ${pattern.source} patterns`);
        }
      });
      
      // Add logger import if not present
      if (content.includes('logger.') && !content.includes('const logger = require')) {
        const loggerImport = "const { logger } = require('./utils/logger');\n";
        
        // Find the best place to insert the import
        if (content.includes('require(')) {
          const lastRequireIndex = content.lastIndexOf('require(');
          const endOfLine = content.indexOf('\n', lastRequireIndex);
          content = content.slice(0, endOfLine + 1) + loggerImport + content.slice(endOfLine + 1);
        } else {
          content = loggerImport + content;
        }
        changes++;
        console.log(`  Added logger import`);
      }
      
    } else if (fileType === 'html') {
      // Process HTML files - only replace console.log in script tags
      htmlConsolePatterns.forEach(({ pattern, replacement }) => {
        const matches = content.match(pattern);
        if (matches) {
          content = content.replace(pattern, replacement);
          changes += matches.length;
          console.log(`  Replaced ${matches.length} console patterns in script tags`);
        }
      });
      
      // Add logger import in script tags if needed
      if (content.includes('logger.') && !content.includes('const logger = require')) {
        const scriptTagPattern = /(<script[^>]*>)/g;
        const firstScriptMatch = content.match(scriptTagPattern);
        if (firstScriptMatch) {
          const loggerImport = 'const { logger } = require(\'./utils/logger\');\n';
          content = content.replace(firstScriptMatch[0], firstScriptMatch[0] + '\n' + loggerImport);
          changes++;
          console.log(`  Added logger import to script tag`);
        }
      }
    }
    
    // Remove debug patterns in production
    if (process.env.NODE_ENV === 'production') {
      debugPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          content = content.replace(pattern, '');
          changes += matches.length;
          console.log(`  Removed ${matches.length} debug patterns`);
        }
      });
    }
    
    if (changes > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${filePath} with ${changes} changes`);
    } else {
      console.log(`  No changes needed for ${filePath}`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

function main() {
  console.log('🧹 Starting console log cleanup...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  filesToProcess.forEach(({ file, type }) => {
    processFile(file, type);
  });
  
  console.log('✅ Console log cleanup completed!');
}

if (require.main === module) {
  main();
}

module.exports = { processFile, consolePatterns, debugPatterns };
