const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Image optimization configuration
const imageConfig = {
  // WebP settings
  webp: {
    quality: 85,
    effort: 6
  },
  // JPEG settings
  jpeg: {
    quality: 85,
    progressive: true,
    mozjpeg: true
  },
  // PNG settings
  png: {
    quality: 90,
    compressionLevel: 9,
    progressive: true
  },
  // Sizes for responsive images
  sizes: [
    { width: 320, suffix: '-sm' },
    { width: 640, suffix: '-md' },
    { width: 1024, suffix: '-lg' },
    { width: 1920, suffix: '-xl' }
  ]
};

// Supported image formats
const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp'];

// Function to optimize a single image
async function optimizeImage(inputPath, outputDir) {
  try {
    const filename = path.basename(inputPath, path.extname(inputPath));
    const ext = path.extname(inputPath).toLowerCase();
    
    console.log(`🖼️  Optimizing ${inputPath}...`);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const results = [];
    
    // Generate WebP version
    const webpPath = path.join(outputDir, `${filename}.webp`);
    await sharp(inputPath)
      .webp(imageConfig.webp)
      .toFile(webpPath);
    results.push({ format: 'webp', path: webpPath });
    
    // Generate responsive sizes
    for (const size of imageConfig.sizes) {
      const outputPath = path.join(outputDir, `${filename}${size.suffix}.webp`);
      await sharp(inputPath)
        .resize(size.width, null, { withoutEnlargement: true })
        .webp(imageConfig.webp)
        .toFile(outputPath);
      results.push({ format: 'webp', path: outputPath, width: size.width });
    }
    
    // Generate fallback JPEG
    const jpegPath = path.join(outputDir, `${filename}.jpg`);
    await sharp(inputPath)
      .jpeg(imageConfig.jpeg)
      .toFile(jpegPath);
    results.push({ format: 'jpeg', path: jpegPath });
    
    console.log(`✅ Optimized ${inputPath} -> ${results.length} variants`);
    return results;
    
  } catch (error) {
    console.error(`❌ Error optimizing ${inputPath}:`, error.message);
    return [];
  }
}

// Function to process all images in a directory
async function processDirectory(inputDir, outputDir) {
  try {
    console.log(`📁 Processing directory: ${inputDir}`);
    
    if (!fs.existsSync(inputDir)) {
      console.log(`Directory ${inputDir} does not exist, skipping...`);
      return;
    }
    
    const files = fs.readdirSync(inputDir);
    const imageFiles = files.filter(file => 
      supportedFormats.includes(path.extname(file).toLowerCase())
    );
    
    console.log(`Found ${imageFiles.length} images to optimize`);
    
    const allResults = [];
    
    for (const file of imageFiles) {
      const inputPath = path.join(inputDir, file);
      const results = await optimizeImage(inputPath, outputDir);
      allResults.push(...results);
    }
    
    // Generate manifest file
    const manifest = {
      generated: new Date().toISOString(),
      totalImages: allResults.length,
      images: allResults.map(result => ({
        path: result.path.replace(outputDir, ''),
        format: result.format,
        width: result.width || 'original'
      }))
    };
    
    const manifestPath = path.join(outputDir, 'images-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`✅ Image optimization completed!`);
    console.log(`📊 Generated ${allResults.length} optimized images`);
    console.log(`📄 Manifest saved to ${manifestPath}`);
    
    return manifest;
    
  } catch (error) {
    console.error(`❌ Error processing directory:`, error.message);
    return null;
  }
}

// Function to create responsive image component
function generateResponsiveImageComponent() {
  return `
// Responsive Image Component
class ResponsiveImage {
  constructor(element) {
    this.element = element;
    this.src = element.dataset.src;
    this.alt = element.dataset.alt || '';
    this.sizes = element.dataset.sizes || '100vw';
    this.loading = element.dataset.loading || 'lazy';
    
    this.init();
  }
  
  init() {
    if (this.loading === 'lazy') {
      this.setupIntersectionObserver();
    } else {
      this.loadImage();
    }
  }
  
  setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage();
            observer.unobserve(this.element);
          }
        });
      }, {
        rootMargin: '50px'
      });
      
      observer.observe(this.element);
    } else {
      // Fallback for older browsers
      this.loadImage();
    }
  }
  
  loadImage() {
    // Create picture element with responsive sources
    const picture = document.createElement('picture');
    
    // WebP sources
    const webpSource = document.createElement('source');
    webpSource.type = 'image/webp';
    webpSource.srcset = this.generateSrcSet('webp');
    picture.appendChild(webpSource);
    
    // JPEG fallback
    const img = document.createElement('img');
    img.src = this.src.replace(/\\.webp$/, '.jpg');
    img.alt = this.alt;
    img.loading = this.loading;
    img.decoding = 'async';
    img.sizes = this.sizes;
    img.srcset = this.generateSrcSet('jpg');
    
    picture.appendChild(img);
    
    // Replace the placeholder
    this.element.parentNode.replaceChild(picture, this.element);
  }
  
  generateSrcSet(format) {
    const baseName = this.src.replace(/\\.[^.]+$/, '');
    const sizes = ['320', '640', '1024', '1920'];
    
    return sizes.map(size => 
      \`\${baseName}-\${size === '320' ? 'sm' : size === '640' ? 'md' : size === '1024' ? 'lg' : 'xl'}.\${format} \${size}w\`
    ).join(', ');
  }
}

// Initialize responsive images
document.addEventListener('DOMContentLoaded', () => {
  const responsiveImages = document.querySelectorAll('[data-responsive-image]');
  responsiveImages.forEach(element => new ResponsiveImage(element));
});
`;
}

// Function to create lazy loading utility
function generateLazyLoadingUtility() {
  return `
// Lazy Loading Utility
class LazyLoader {
  constructor() {
    this.observer = null;
    this.init();
  }
  
  init() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadElement(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.1
      });
      
      this.observeElements();
    } else {
      // Fallback for older browsers
      this.loadAllElements();
    }
  }
  
  observeElements() {
    const lazyElements = document.querySelectorAll('[data-lazy]');
    lazyElements.forEach(element => {
      this.observer.observe(element);
    });
  }
  
  loadElement(element) {
    const src = element.dataset.src;
    const type = element.dataset.type || 'image';
    
    if (type === 'image') {
      this.loadImage(element, src);
    } else if (type === 'background') {
      this.loadBackground(element, src);
    }
  }
  
  loadImage(element, src) {
    element.src = src;
    element.classList.add('loaded');
    element.removeAttribute('data-lazy');
    element.removeAttribute('data-src');
  }
  
  loadBackground(element, src) {
    element.style.backgroundImage = \`url(\${src})\`;
    element.classList.add('loaded');
    element.removeAttribute('data-lazy');
    element.removeAttribute('data-src');
  }
  
  loadAllElements() {
    const lazyElements = document.querySelectorAll('[data-lazy]');
    lazyElements.forEach(element => this.loadElement(element));
  }
}

// Initialize lazy loading
document.addEventListener('DOMContentLoaded', () => {
  new LazyLoader();
});
`;
}

// Main function
async function main() {
  console.log('🖼️  Starting image optimization...');
  
  // Check if sharp is available
  try {
    require('sharp');
  } catch (error) {
    console.log('📦 Installing sharp for image optimization...');
    const { execSync } = require('child_process');
    execSync('npm install sharp', { stdio: 'inherit' });
  }
  
  // Process images directory
  const inputDir = path.join(__dirname, '..', 'images');
  const outputDir = path.join(__dirname, '..', 'images', 'optimized');
  
  const manifest = await processDirectory(inputDir, outputDir);
  
  if (manifest) {
    // Generate utility files
    const utilsDir = path.join(__dirname, '..', 'utils');
    if (!fs.existsSync(utilsDir)) {
      fs.mkdirSync(utilsDir, { recursive: true });
    }
    
    // Save responsive image component
    const responsiveImagePath = path.join(utilsDir, 'responsive-image.js');
    fs.writeFileSync(responsiveImagePath, generateResponsiveImageComponent());
    
    // Save lazy loading utility
    const lazyLoadingPath = path.join(utilsDir, 'lazy-loading.js');
    fs.writeFileSync(lazyLoadingPath, generateLazyLoadingUtility());
    
    console.log('✅ Image optimization utilities generated!');
    console.log(`📁 Optimized images saved to: ${outputDir}`);
    console.log(`🔧 Utilities saved to: ${utilsDir}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  optimizeImage,
  processDirectory,
  generateResponsiveImageComponent,
  generateLazyLoadingUtility
};

