/**
 * Image Format Converter & Compressor - Core Client-Side Engine
 * Offline, Browser-Native Image Processing & Format Encoding
 */

class ImageConverterEngine {
  constructor() {
    this.supportedOutputFormats = [
      { id: 'webp', name: 'WEBP (Web Picture format)', ext: 'webp', mime: 'image/webp', supportsQuality: true, supportsTransparency: true },
      { id: 'png', name: 'PNG (Portable Network Graphics)', ext: 'png', mime: 'image/png', supportsQuality: false, supportsTransparency: true },
      { id: 'jpeg', name: 'JPEG (Joint Photographic Experts)', ext: 'jpg', mime: 'image/jpeg', supportsQuality: true, supportsTransparency: false },
      { id: 'avif', name: 'AVIF (AV1 Image File)', ext: 'avif', mime: 'image/avif', supportsQuality: true, supportsTransparency: true },
      { id: 'bmp', name: 'BMP (Windows Bitmap)', ext: 'bmp', mime: 'image/bmp', supportsQuality: false, supportsTransparency: false },
      { id: 'ico', name: 'ICO (Windows Icon)', ext: 'ico', mime: 'image/x-icon', supportsQuality: false, supportsTransparency: true },
      { id: 'gif', name: 'GIF (Graphics Interchange Format)', ext: 'gif', mime: 'image/gif', supportsQuality: false, supportsTransparency: true },
      { id: 'svg', name: 'SVG (Scalable Vector Wrapper)', ext: 'svg', mime: 'image/svg+xml', supportsQuality: false, supportsTransparency: true }
    ];
  }

  /**
   * Pure client-side HEIC/HEIF Decoder using standalone libheif.js
   */
  async decodeHeicToCanvas(fileOrBlob) {
    if (typeof libheif === 'undefined') {
      throw new Error('libheif library not loaded');
    }

    if (!window.__libheifModule) {
      if (typeof libheif === 'function') {
        const mod = libheif();
        if (mod && mod.ready && typeof mod.ready.then === 'function') {
          await mod.ready;
          window.__libheifModule = mod;
        } else if (mod && typeof mod.then === 'function') {
          window.__libheifModule = await mod;
        } else {
          window.__libheifModule = mod;
        }
      } else {
        window.__libheifModule = libheif;
      }
    }

    const lib = window.__libheifModule;
    if (!lib || !lib.HeifDecoder) {
      throw new Error('HeifDecoder constructor not found in libheif module');
    }

    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const decoder = new lib.HeifDecoder();
    const data = decoder.decode(arrayBuffer);

    if (!data || data.length === 0) {
      throw new Error('Failed to decode HEIF image data: No images found');
    }

    const image = data[0];
    const width = image.get_width();
    const height = image.get_height();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    await new Promise((resolve, reject) => {
      image.display(imageData, (displayData) => {
        if (!displayData) {
          reject(new Error('HEIF display callback failed'));
        } else {
          ctx.putImageData(displayData, 0, 0);
          resolve();
        }
      });
    });

    return canvas;
  }

  /**
   * Loads an image file or blob into an Image element/Bitmap/Canvas and extracts dimensions
   */
  async loadImage(fileOrBlob) {
    const isHeic = (fileOrBlob.name && /\.(heic|heif)$/i.test(fileOrBlob.name)) ||
                   (fileOrBlob.type && (fileOrBlob.type.includes('heic') || fileOrBlob.type.includes('heif')));

    if (isHeic) {
      try {
        const canvas = await this.decodeHeicToCanvas(fileOrBlob);
        return {
          element: canvas,
          width: canvas.width,
          height: canvas.height,
          objectUrl: null,
          originalMime: fileOrBlob.type || 'image/heic',
          originalSize: fileOrBlob.size || 0,
          originalName: fileOrBlob.name || 'image.heic'
        };
      } catch (err) {
        console.warn('Direct libheif decode error:', err);
      }
    }

    // 1. Direct FileReader to DataURL (Rock solid across all standard image formats)
    const loadViaFileReader = () => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const img = new Image();
          img.onload = () => {
            resolve({
              element: img,
              width: img.naturalWidth || img.width || 300,
              height: img.naturalHeight || img.height || 300,
              objectUrl: null,
              originalMime: fileOrBlob.type || 'image/unknown',
              originalSize: fileOrBlob.size || 0,
              originalName: fileOrBlob.name || 'image'
            });
          };
          img.onerror = (err) => reject(new Error('HTMLImageElement decode error'));
          img.src = dataUrl;
        };
        reader.onerror = (err) => reject(new Error('FileReader read error'));
        reader.readAsDataURL(fileOrBlob);
      });
    };

    // 2. Hardware-accelerated createImageBitmap
    const loadViaBitmap = async () => {
      if (typeof window.createImageBitmap === 'function') {
        const bitmap = await window.createImageBitmap(fileOrBlob);
        return {
          element: bitmap,
          width: bitmap.width || 300,
          height: bitmap.height || 300,
          objectUrl: null,
          originalMime: fileOrBlob.type || 'image/unknown',
          originalSize: fileOrBlob.size || 0,
          originalName: fileOrBlob.name || 'image'
        };
      }
      throw new Error('createImageBitmap unavailable');
    };

    // 3. Fallback to ObjectURL
    const loadViaObjectURL = () => {
      return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(fileOrBlob);
        const img = new Image();
        img.onload = () => {
          resolve({
            element: img,
            width: img.naturalWidth || img.width || 300,
            height: img.naturalHeight || img.height || 300,
            objectUrl: objectUrl,
            originalMime: fileOrBlob.type || 'image/unknown',
            originalSize: fileOrBlob.size || 0,
            originalName: fileOrBlob.name || 'image'
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('ObjectURL decode error'));
        };
        img.src = objectUrl;
      });
    };

    // 4. Dynamic HEIC fallback if not detected by filename/MIME
    const loadViaHeicFallback = async () => {
      const canvas = await this.decodeHeicToCanvas(fileOrBlob);
      return {
        element: canvas,
        width: canvas.width,
        height: canvas.height,
        objectUrl: null,
        originalMime: fileOrBlob.type || 'image/heic',
        originalSize: fileOrBlob.size || 0,
        originalName: fileOrBlob.name || 'image.heic'
      };
    };

    try {
      return await loadViaFileReader();
    } catch (e1) {
      try {
        return await loadViaBitmap();
      } catch (e2) {
        try {
          return await loadViaObjectURL();
        } catch (e3) {
          try {
            return await loadViaHeicFallback();
          } catch (e4) {
            throw new Error(`Failed to decode image: ${fileOrBlob.name || 'file'}`);
          }
        }
      }
    }
  }

  /**
   * Computes target dimensions based on scale or custom options
   */
  calculateDimensions(originalWidth, originalHeight, options = {}) {
    const origW = Math.max(1, parseInt(originalWidth, 10) || 300);
    const origH = Math.max(1, parseInt(originalHeight, 10) || 300);

    const {
      resizeMode = 'original', // 'original' | 'scale' | 'custom'
      scalePercent = 100,
      customWidth = null,
      customHeight = null,
      keepAspectRatio = true
    } = options;

    if (resizeMode === 'scale') {
      const factor = Math.max(0.01, (parseInt(scalePercent, 10) || 100) / 100);
      return {
        width: Math.max(1, Math.round(origW * factor)),
        height: Math.max(1, Math.round(origH * factor))
      };
    }

    if (resizeMode === 'custom') {
      let targetW = parseInt(customWidth, 10);
      let targetH = parseInt(customHeight, 10);

      if (isNaN(targetW) || targetW <= 0) targetW = origW;
      if (isNaN(targetH) || targetH <= 0) targetH = origH;

      if (keepAspectRatio) {
        const ratio = origW / origH;
        if (options.primaryDimension === 'height') {
          targetW = Math.max(1, Math.round(targetH * ratio));
        } else {
          targetH = Math.max(1, Math.round(targetW / ratio));
        }
      }

      return {
        width: Math.max(1, targetW),
        height: Math.max(1, targetH)
      };
    }

    return {
      width: origW,
      height: origH
    };
  }

  /**
   * Renders the source image onto a canvas with background handling
   */
  renderCanvas(imageElement, targetWidth, targetHeight, options = {}) {
    const width = Math.max(1, parseInt(targetWidth, 10) || 300);
    const height = Math.max(1, parseInt(targetHeight, 10) || 300);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Canvas 2D context initialization failed.');
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const targetFormat = (options.format || 'png').toLowerCase();
    const formatMeta = this.supportedOutputFormats.find(f => f.id === targetFormat) || {};
    const supportsTransparency = formatMeta.supportsTransparency ?? true;

    // Background color filling
    let bg = options.backgroundColor || 'transparent';
    if (!supportsTransparency && (bg === 'transparent' || !bg)) {
      bg = '#ffffff'; // Default to white background for non-alpha formats (JPEG, BMP)
    }

    if (bg && bg !== 'transparent') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }

    // Draw image
    ctx.drawImage(imageElement, 0, 0, width, height);
    return canvas;
  }

  /**
   * Converts a canvas into target format Blob
   */
  async exportCanvasToBlob(canvas, format, quality = 0.85) {
    const fmt = (format || 'png').toLowerCase();
    let blob = null;

    if (fmt === 'png') {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    } else if (fmt === 'jpeg' || fmt === 'jpg') {
      const q = Math.max(0.01, Math.min(1.0, quality));
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', q));
    } else if (fmt === 'webp') {
      const q = Math.max(0.01, Math.min(1.0, quality));
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', q));
    } else if (fmt === 'avif') {
      const q = Math.max(0.01, Math.min(1.0, quality));
      blob = await new Promise((resolve) => {
        try {
          canvas.toBlob((b) => {
            if (b && b.type === 'image/avif') {
              resolve(b);
            } else {
              canvas.toBlob(resolve, 'image/webp', q);
            }
          }, 'image/avif', q);
        } catch (e) {
          canvas.toBlob(resolve, 'image/webp', q);
        }
      });
    } else if (fmt === 'gif') {
      blob = await new Promise(resolve => {
        try {
          canvas.toBlob((b) => {
            if (b && (b.type === 'image/gif' || b.type === 'image/png')) {
              resolve(b);
            } else {
              canvas.toBlob(resolve, 'image/png');
            }
          }, 'image/gif');
        } catch (e) {
          canvas.toBlob(resolve, 'image/png');
        }
      });
    } else if (fmt === 'bmp') {
      blob = this.encodeBMP(canvas);
    } else if (fmt === 'ico') {
      blob = await this.encodeICO(canvas);
    } else if (fmt === 'svg') {
      blob = await this.encodeSVG(canvas);
    }

    if (!blob) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    if (!blob) {
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      blob = await res.blob();
    }

    return blob;
  }

  /**
   * Pure Client-Side Binary 24-bit / 32-bit BMP Generator
   */
  encodeBMP(canvas) {
    const width = Math.max(1, canvas.width);
    const height = Math.max(1, canvas.height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const bytesPerPixel = 3;
    const rowSize = Math.floor((bytesPerPixel * width + 3) / 4) * 4;
    const pixelArraySize = rowSize * height;
    const fileHeaderSize = 14;
    const dibHeaderSize = 40;
    const fileSize = fileHeaderSize + dibHeaderSize + pixelArraySize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    view.setUint8(0, 0x42); // 'B'
    view.setUint8(1, 0x4D); // 'M'
    view.setUint32(2, fileSize, true); // Total file size
    view.setUint16(6, 0, true); // Reserved 1
    view.setUint16(8, 0, true); // Reserved 2
    view.setUint32(10, fileHeaderSize + dibHeaderSize, true); // Pixel array offset (54)

    view.setUint32(14, dibHeaderSize, true); // Header size (40)
    view.setInt32(18, width, true); // Image width
    view.setInt32(22, height, true); // Image height (positive = bottom-up)
    view.setUint16(26, 1, true); // Color planes (1)
    view.setUint16(28, 24, true); // Bits per pixel (24-bit RGB)
    view.setUint32(30, 0, true); // Compression (0 = BI_RGB uncompressed)
    view.setUint32(34, pixelArraySize, true); // Image data size
    view.setInt32(38, 2835, true); // Horizontal resolution (72 DPI ~ 2835 ppm)
    view.setInt32(42, 2835, true); // Vertical resolution (72 DPI ~ 2835 ppm)
    view.setUint32(46, 0, true); // Palette colors
    view.setUint32(50, 0, true); // Important colors

    let offset = fileHeaderSize + dibHeaderSize;
    const padding = rowSize - (width * 3);

    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const srcIndex = (y * width + x) * 4;
        const r = data[srcIndex];
        const g = data[srcIndex + 1];
        const b = data[srcIndex + 2];

        view.setUint8(offset++, b);
        view.setUint8(offset++, g);
        view.setUint8(offset++, r);
      }
      for (let p = 0; p < padding; p++) {
        view.setUint8(offset++, 0);
      }
    }

    return new Blob([buffer], { type: 'image/bmp' });
  }

  /**
   * Pure Client-Side Binary ICO Generator (PNG-compressed Windows Icon)
   */
  async encodeICO(canvas, multiResolution = false) {
    const resolutions = multiResolution 
      ? [16, 32, 48, 64, 128, 256] 
      : [Math.min(256, Math.max(16, canvas.width))];

    const entries = [];
    let imageBuffers = [];

    for (const size of resolutions) {
      let targetCanvas = canvas;
      if (canvas.width !== size || canvas.height !== size) {
        targetCanvas = document.createElement('canvas');
        targetCanvas.width = size;
        targetCanvas.height = size;
        const ctx = targetCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, size, size);
      }

      const pngBlob = await new Promise(res => targetCanvas.toBlob(res, 'image/png'));
      const pngBuffer = await pngBlob.arrayBuffer();

      entries.push({
        width: size >= 256 ? 0 : size,
        height: size >= 256 ? 0 : size,
        size: pngBuffer.byteLength
      });
      imageBuffers.push(pngBuffer);
    }

    const headerSize = 6;
    const entrySize = 16;
    const numImages = entries.length;
    let currentOffset = headerSize + (entrySize * numImages);

    let totalSize = currentOffset;
    for (const img of entries) {
      img.offset = currentOffset;
      currentOffset += img.size;
      totalSize += img.size;
    }

    const icoBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(icoBuffer);

    view.setUint16(0, 0, true); // Reserved
    view.setUint16(2, 1, true); // Type (1 = ICO)
    view.setUint16(4, numImages, true); // Image count

    let entryOffset = 6;
    for (let i = 0; i < numImages; i++) {
      const entry = entries[i];
      view.setUint8(entryOffset + 0, entry.width);
      view.setUint8(entryOffset + 1, entry.height);
      view.setUint8(entryOffset + 2, 0); // Color count
      view.setUint8(entryOffset + 3, 0); // Reserved
      view.setUint16(entryOffset + 4, 1, true); // Color planes
      view.setUint16(entryOffset + 6, 32, true); // Bits per pixel
      view.setUint32(entryOffset + 8, entry.size, true); // Image byte size
      view.setUint32(entryOffset + 12, entry.offset, true); // Image offset in file
      entryOffset += 16;
    }

    const icoUint8 = new Uint8Array(icoBuffer);
    for (let i = 0; i < numImages; i++) {
      const entry = entries[i];
      const imgBytes = new Uint8Array(imageBuffers[i]);
      icoUint8.set(imgBytes, entry.offset);
    }

    return new Blob([icoBuffer], { type: 'image/x-icon' });
  }

  /**
   * Generates an SVG raster-vector wrapper
   */
  async encodeSVG(canvas) {
    const width = Math.max(1, canvas.width);
    const height = Math.max(1, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');

    const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1">
  <image width="${width}" height="${height}" xlink:href="${dataUrl}" />
</svg>`;

    return new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  }

  /**
   * Main Conversion Workflow: Single Image execution
   */
  async processImage(fileOrBlob, options = {}) {
    let loadedImage = null;
    try {
      loadedImage = await this.loadImage(fileOrBlob);
      const dims = this.calculateDimensions(loadedImage.width, loadedImage.height, options);
      const canvas = this.renderCanvas(loadedImage.element, dims.width, dims.height, options);

      const targetFormat = (options.format || 'png').toLowerCase();
      const quality = typeof options.quality === 'number' ? options.quality : 0.85;
      const convertedBlob = await this.exportCanvasToBlob(canvas, targetFormat, quality);

      if (!convertedBlob) {
        throw new Error('Failed to encode image blob');
      }

      const targetMeta = this.supportedOutputFormats.find(f => f.id === targetFormat) || { ext: targetFormat };
      const newFileName = this.getConvertedFileName(loadedImage.originalName, targetMeta.ext);

      return {
        success: true,
        blob: convertedBlob,
        name: newFileName,
        originalName: loadedImage.originalName,
        originalSize: loadedImage.originalSize,
        convertedSize: convertedBlob.size || 0,
        originalWidth: loadedImage.width,
        originalHeight: loadedImage.height,
        convertedWidth: dims.width,
        convertedHeight: dims.height,
        format: targetFormat,
        compressionRatio: loadedImage.originalSize > 0 
          ? ((1 - (convertedBlob.size / loadedImage.originalSize)) * 100).toFixed(1)
          : '0.0',
        previewUrl: URL.createObjectURL(convertedBlob)
      };
    } finally {
      if (loadedImage?.objectUrl) {
        URL.revokeObjectURL(loadedImage.objectUrl);
      }
    }
  }

  /**
   * Replaces file extension with target extension
   */
  getConvertedFileName(originalName, newExtension) {
    if (!originalName) return `converted.${newExtension}`;
    const dotIndex = originalName.lastIndexOf('.');
    const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
    return `${baseName}.${newExtension}`;
  }

  /**
   * Utility to format bytes into human-readable string
   */
  static formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

// Attach engine globally
window.ImageConverterEngine = ImageConverterEngine;
