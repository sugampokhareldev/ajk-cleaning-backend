const fs = require('fs');
const path = require('path');

// Files to process
const htmlFiles = [
  'index.html',
  'booking.html',
  'admin.html'
];

// Function to implement lazy loading in HTML
function implementLazyLoading(content) {
  let changes = 0;
  
  // Add lazy loading CSS
  if (!content.includes('lazy-loading.css')) {
    const cssLink = '<link rel="stylesheet" href="./styles/lazy-loading.css">';
    content = content.replace('</head>', `    ${cssLink}\n</head>`);
    changes++;
  }
  
  // Add lazy loading JavaScript
  if (!content.includes('lazy-loading.js')) {
    const jsScript = '<script src="./utils/lazy-loading.js"></script>';
    content = content.replace('</body>', `    ${jsScript}\n</body>`);
    changes++;
  }
  
  // Convert regular images to lazy-loaded images
  const imagePattern = /<img([^>]*?)src="([^"]*?)"([^>]*?)>/g;
  content = content.replace(imagePattern, (match, before, src, after) => {
    // Skip if already has data-lazy attribute
    if (before.includes('data-lazy') || after.includes('data-lazy')) {
      return match;
    }
    
    // Skip critical images (logo, favicon, etc.)
    if (src.includes('logo') || src.includes('favicon') || src.includes('icon')) {
      return match;
    }
    
    // Convert to lazy-loaded image
    const lazyImg = `<img${before}data-lazy="true" data-src="${src}" data-type="image"${after}>`;
    changes++;
    return lazyImg;
  });
  
  // Convert background images to lazy-loaded
  const backgroundPattern = /background-image:\s*url\(['"]?([^'"]*?)['"]?\)/g;
  content = content.replace(backgroundPattern, (match, url) => {
    // Skip if already processed
    if (match.includes('data-lazy')) {
      return match;
    }
    
    // Convert to lazy-loaded background
    const lazyBg = `background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="0.5" fill="white" opacity="0.3"/></pattern></defs><rect width="100" height="100" fill="url(%23dots)"/></svg>'); data-lazy="true" data-src="${url}" data-type="background"`;
    changes++;
    return lazyBg;
  });
  
  // Add responsive image support
  const responsiveImagePattern = /<img([^>]*?)src="([^"]*?)"([^>]*?)class="([^"]*?)"([^>]*?)>/g;
  content = content.replace(responsiveImagePattern, (match, before, src, middle, className, after) => {
    // Skip if already has responsive attributes
    if (before.includes('data-responsive') || after.includes('data-responsive')) {
      return match;
    }
    
    // Add responsive image attributes
    const responsiveImg = `<img${before}data-responsive-image="true" data-src="${src}" data-sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"${middle}class="${className}"${after}>`;
    changes++;
    return responsiveImg;
  });
  
  return { content, changes };
}

// Function to add performance optimizations
function addPerformanceOptimizations(content) {
  let changes = 0;
  
  // Add preload for critical resources
  if (!content.includes('preload')) {
    const preloadLinks = `
    <!-- Preload critical resources -->
    <link rel="preload" as="style" href="./dist/output.css">
    <link rel="preload" as="style" href="./styles/lazy-loading.css">
    <link rel="preload" as="script" href="./utils/lazy-loading.js">
    <link rel="preload" as="image" href="./images/logo.webp">`;
    
    content = content.replace('</head>', `    ${preloadLinks}\n</head>`);
    changes++;
  }
  
  // Add resource hints
  if (!content.includes('dns-prefetch')) {
    const resourceHints = `
    <!-- Resource hints for better performance -->
    <link rel="dns-prefetch" href="//images.unsplash.com">
    <link rel="dns-prefetch" href="//upload.wikimedia.org">
    <link rel="preconnect" href="https://images.unsplash.com" crossorigin>
    <link rel="preconnect" href="https://upload.wikimedia.org" crossorigin>`;
    
    content = content.replace('</head>', `    ${resourceHints}\n</head>`);
    changes++;
  }
  
  return { content, changes };
}

// Function to process a single HTML file
function processHtmlFile(filePath) {
  try {
    console.log(`📄 Processing ${filePath}...`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} does not exist, skipping...`);
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let totalChanges = 0;
    
    // Implement lazy loading
    const lazyResult = implementLazyLoading(content);
    content = lazyResult.content;
    totalChanges += lazyResult.changes;
    
    // Add performance optimizations
    const perfResult = addPerformanceOptimizations(content);
    content = perfResult.content;
    totalChanges += perfResult.changes;
    
    if (totalChanges > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${filePath} with ${totalChanges} changes`);
    } else {
      console.log(`  No changes needed for ${filePath}`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

// Main function
function main() {
  console.log('🖼️  Implementing lazy loading and performance optimizations...');
  
  htmlFiles.forEach(file => {
    processHtmlFile(file);
  });
  
  console.log('✅ Lazy loading implementation completed!');
  console.log('📝 Next steps:');
  console.log('  1. Run "npm run optimize-images" to optimize your images');
  console.log('  2. Test the lazy loading functionality');
  console.log('  3. Monitor performance improvements');
}

if (require.main === module) {
  main();
}

module.exports = {
  implementLazyLoading,
  addPerformanceOptimizations,
  processHtmlFile
};

