/**
 * Image Format Converter & Compressor - Application Controller
 * Handles UI interactions, batch queue processing, settings management, live preview surface, and file/folder import
 */

(function () {
  'use strict';

  // Instantiate Core Engine
  const engine = new ImageConverterEngine();

  // Application State
  const state = {
    queue: [], // Array of { id, file, status, convertedResult, thumbUrl, originalWidth, originalHeight, errorMessage }
    selectedItemId: null,
    isProcessingAll: false,
    globalSettings: {
      format: 'webp',
      quality: 0.85,
      resizeMode: 'original', // 'original' | 'scale' | 'custom'
      scalePercent: 100,
      customWidth: null,
      customHeight: null,
      keepAspectRatio: true,
      backgroundColor: 'transparent'
    }
  };

  // DOM Elements
  const dom = {
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    folderInput: document.getElementById('folder-input'),
    browseBtn: document.getElementById('browse-btn'),
    queueList: document.getElementById('queue-list'),
    emptyState: document.getElementById('empty-state'),

    // Dropzone Preview & Hover Actions
    dropzoneDefaultContent: document.getElementById('dropzone-default-content'),
    dropzonePreviewContent: document.getElementById('dropzone-preview-content'),
    dropzonePreviewImg: document.getElementById('dropzone-preview-img'),
    dropzonePreviewBadge: document.getElementById('dropzone-preview-badge'),
    btnImportFiles: document.getElementById('btn-import-files'),
    btnImportFolder: document.getElementById('btn-import-folder'),
    btnViewNewTab: document.getElementById('btn-view-newtab'),
    btnDownloadPreview: document.getElementById('btn-download-preview'),
    
    // Summary Stats
    statTotal: document.getElementById('stat-total'),
    statDone: document.getElementById('stat-done'),
    statSaved: document.getElementById('stat-saved'),

    // Batch Actions
    btnConvertAll: document.getElementById('btn-convert-all'),
    btnDownloadAll: document.getElementById('btn-download-all'),
    btnClearAll: document.getElementById('btn-clear-all'),

    // Global Settings Inputs
    selectFormat: document.getElementById('setting-format'),
    qualityGroup: document.getElementById('quality-group'),
    rangeQuality: document.getElementById('setting-quality'),
    qualityVal: document.getElementById('quality-val'),
    selectResize: document.getElementById('setting-resize'),
    scaleGroup: document.getElementById('scale-group'),
    rangeScale: document.getElementById('setting-scale'),
    scaleVal: document.getElementById('scale-val'),
    customDimsGroup: document.getElementById('custom-dims-group'),
    inputWidth: document.getElementById('setting-width'),
    inputHeight: document.getElementById('setting-height'),
    checkKeepAspect: document.getElementById('setting-aspect'),
    selectBg: document.getElementById('setting-bg'),

    // Live Technical Details Panel
    inspectorPanel: document.getElementById('inspector-panel'),
    inspectorEmpty: document.getElementById('inspector-empty'),
    inspectorEmptyText: document.getElementById('inspector-empty-text'),
    inspectorBody: document.getElementById('inspector-body'),
    inspectorFilename: document.getElementById('inspector-filename'),
    metricOrigDim: document.getElementById('metric-orig-dim'),
    metricConvDim: document.getElementById('metric-conv-dim'),
    metricOrigSize: document.getElementById('metric-orig-size'),
    metricConvSize: document.getElementById('metric-conv-size'),
    metricSavings: document.getElementById('metric-savings'),
    metricFormat: document.getElementById('metric-format'),
    btnInspectorReconvert: document.getElementById('btn-inspector-reconvert'),
    btnInspectorDownload: document.getElementById('btn-inspector-download'),

    // Preview Modal
    modal: document.getElementById('preview-modal'),
    modalClose: document.getElementById('modal-close'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalDownloadBtn: document.getElementById('modal-download-btn'),
    previewOrigImg: document.getElementById('preview-orig-img'),
    previewConvImg: document.getElementById('preview-conv-img'),
    previewOrigMeta: document.getElementById('preview-orig-meta'),
    previewConvMeta: document.getElementById('preview-conv-meta')
  };

  let activeModalItem = null;

  /**
   * Initializes application listeners
   */
  function init() {
    setupEventListeners();
    setupDropzone();
    setupClipboardPaste();
    updateUI();
  }

  /**
   * Event Listeners Registration
   */
  function setupEventListeners() {
    // Header Browse button
    if (dom.browseBtn) {
      dom.browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.fileInput.click();
      });
    }

    // Dropzone Click & Keyboard trigger (when no preview is active)
    if (dom.dropzone) {
      dom.dropzone.addEventListener('click', (e) => {
        if (!dom.dropzone.classList.contains('has-preview')) {
          e.stopPropagation();
          dom.fileInput.click();
        }
      });
      dom.dropzone.addEventListener('keydown', (e) => {
        if (!dom.dropzone.classList.contains('has-preview') && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          dom.fileInput.click();
        }
      });
    }

    // Dropzone Overlay Action: Import Images
    if (dom.btnImportFiles) {
      dom.btnImportFiles.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.fileInput.click();
      });
    }

    // Dropzone Overlay Action: Import Folder
    if (dom.btnImportFolder) {
      dom.btnImportFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.folderInput.click();
      });
    }

    // Dedicated Action Toolbar: View Image in New Tab
    if (dom.btnViewNewTab) {
      dom.btnViewNewTab.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = getSelectedItem();
        if (selected) {
          openItemInNewTab(selected);
        }
      });
    }

    // Dropzone Overlay Action: Download Preview Image
    if (dom.btnDownloadPreview) {
      dom.btnDownloadPreview.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = getSelectedItem();
        if (selected && selected.convertedResult) {
          downloadSingleItem(selected);
        }
      });
    }

    // Hidden File Input Change
    if (dom.fileInput) {
      dom.fileInput.addEventListener('click', (e) => e.stopPropagation());
      dom.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          addFilesToQueue(Array.from(e.target.files));
          dom.fileInput.value = '';
        }
      });
    }

    // Hidden Folder Input Change
    if (dom.folderInput) {
      dom.folderInput.addEventListener('click', (e) => e.stopPropagation());
      dom.folderInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          addFilesToQueue(Array.from(e.target.files));
          dom.folderInput.value = '';
        }
      });
    }

    // Format Selector Change
    if (dom.selectFormat) {
      dom.selectFormat.addEventListener('change', (e) => {
        state.globalSettings.format = e.target.value;
        updateSettingsControlsVisibility();
        renderInspector();
      });
    }

    // Quality Slider Change
    if (dom.rangeQuality) {
      dom.rangeQuality.addEventListener('input', (e) => {
        const q = parseInt(e.target.value, 10);
        state.globalSettings.quality = q / 100;
        if (dom.qualityVal) dom.qualityVal.textContent = `${q}%`;
      });
    }

    // Resize Mode Change
    if (dom.selectResize) {
      dom.selectResize.addEventListener('change', (e) => {
        state.globalSettings.resizeMode = e.target.value;
        updateResizeControlsVisibility();
      });
    }

    // Scale Percentage Change
    if (dom.rangeScale) {
      dom.rangeScale.addEventListener('input', (e) => {
        const s = parseInt(e.target.value, 10);
        state.globalSettings.scalePercent = s;
        if (dom.scaleVal) dom.scaleVal.textContent = `${s}%`;
      });
    }

    // Custom Width & Height
    if (dom.inputWidth) {
      dom.inputWidth.addEventListener('input', (e) => {
        state.globalSettings.customWidth = parseInt(e.target.value, 10) || null;
      });
    }

    if (dom.inputHeight) {
      dom.inputHeight.addEventListener('input', (e) => {
        state.globalSettings.customHeight = parseInt(e.target.value, 10) || null;
      });
    }

    if (dom.checkKeepAspect) {
      dom.checkKeepAspect.addEventListener('change', (e) => {
        state.globalSettings.keepAspectRatio = e.target.checked;
      });
    }

    // Background Color
    if (dom.selectBg) {
      dom.selectBg.addEventListener('change', (e) => {
        state.globalSettings.backgroundColor = e.target.value;
      });
    }

    // Batch Actions
    if (dom.btnConvertAll) dom.btnConvertAll.addEventListener('click', handleConvertAll);
    if (dom.btnDownloadAll) dom.btnDownloadAll.addEventListener('click', handleDownloadAllZip);
    if (dom.btnClearAll) dom.btnClearAll.addEventListener('click', handleClearAll);

    // Inspector Action Buttons
    if (dom.btnInspectorReconvert) {
      dom.btnInspectorReconvert.addEventListener('click', () => {
        const selected = getSelectedItem();
        if (selected) {
          convertSingleItem(selected);
        }
      });
    }

    if (dom.btnInspectorDownload) {
      dom.btnInspectorDownload.addEventListener('click', () => {
        const selected = getSelectedItem();
        if (selected && selected.convertedResult) {
          downloadSingleItem(selected);
        }
      });
    }

    // Modal Events
    if (dom.modalClose) dom.modalClose.addEventListener('click', closeModal);
    if (dom.modalCloseBtn) dom.modalCloseBtn.addEventListener('click', closeModal);
    if (dom.modal) {
      dom.modal.addEventListener('click', (e) => {
        if (e.target === dom.modal) closeModal();
      });
    }

    if (dom.modalDownloadBtn) {
      dom.modalDownloadBtn.addEventListener('click', () => {
        if (activeModalItem && activeModalItem.convertedResult) {
          downloadSingleItem(activeModalItem);
        }
      });
    }
  }

  /**
   * Recursively traverses dropped DirectoryEntry items
   */
  async function traverseFileTree(entry, fileList) {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          fileList.push(file);
          resolve();
        }, () => resolve());
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise((resolve) => {
        dirReader.readEntries((results) => resolve(results || []), () => resolve([]));
      });
      for (const child of entries) {
        await traverseFileTree(child, fileList);
      }
    }
  }

  /**
   * Drag and drop setup strictly filtering for external OS files & folders
   */
  function setupDropzone() {
    if (!dom.dropzone) return;

    let isInternalDrag = false;

    // Completely block and ignore any drag gestures originating from inside the page
    window.addEventListener('dragstart', (e) => {
      isInternalDrag = true;
      e.preventDefault();
    }, true);

    window.addEventListener('dragend', () => {
      isInternalDrag = false;
    }, true);

    function isExternalFileDrag(e) {
      if (isInternalDrag) return false;
      const types = e.dataTransfer?.types;
      if (!types) return false;
      // External drag from OS file explorer includes 'Files' or 'public.file-url'
      return types.includes('Files') || types.includes('public.file-url');
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      dom.dropzone.addEventListener(eventName, (e) => {
        if (!isExternalFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dom.dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dom.dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dropzone.classList.remove('dragover');
      }, false);
    });

    dom.dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dom.dropzone.classList.remove('dragover');

      if (!isExternalFileDrag(e)) {
        isInternalDrag = false;
        return;
      }

      const dt = e.dataTransfer;
      if (!dt) return;

      if (dt.items && dt.items.length > 0 && typeof dt.items[0].webkitGetAsEntry === 'function') {
        const fileList = [];
        for (let i = 0; i < dt.items.length; i++) {
          const entry = dt.items[i].webkitGetAsEntry();
          if (entry) {
            await traverseFileTree(entry, fileList);
          }
        }
        if (fileList.length > 0) {
          addFilesToQueue(fileList);
          return;
        }
      }

      if (dt.files && dt.files.length > 0) {
        addFilesToQueue(Array.from(dt.files));
      }
    });

    // Prevent default window navigation when dropping outside dropzone
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);
  }

  /**
   * Paste from clipboard support
   */
  function setupClipboardPaste() {
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png';
            const renamedFile = new File([blob], `clipboard_${Date.now()}.${ext}`, { type: blob.type });
            pastedFiles.push(renamedFile);
          }
        }
      }

      if (pastedFiles.length > 0) {
        addFilesToQueue(pastedFiles);
      }
    });
  }

  /**
   * Updates controls visibility according to selected format & resize mode
   */
  function updateSettingsControlsVisibility() {
    const fmt = state.globalSettings.format;
    const formatMeta = engine.supportedOutputFormats.find(f => f.id === fmt) || {};
    
    if (dom.qualityGroup) {
      dom.qualityGroup.style.display = formatMeta.supportsQuality ? 'flex' : 'none';
    }
  }

  function updateResizeControlsVisibility() {
    const mode = state.globalSettings.resizeMode;
    if (dom.scaleGroup) dom.scaleGroup.style.display = mode === 'scale' ? 'flex' : 'none';
    if (dom.customDimsGroup) dom.customDimsGroup.style.display = mode === 'custom' ? 'grid' : 'none';
  }

  /**
   * Adds newly selected files to the conversion queue
   */
  function addFilesToQueue(files) {
    if (!files || files.length === 0) return;

    const validExtensions = /\.(png|jpe?g|jfif|webp|avif|bmp|dib|ico|gif|svg|tiff?|tif|heic|heif)$/i;
    const imageFiles = Array.from(files).filter(f => {
      return (f.type && f.type.startsWith('image/')) || validExtensions.test(f.name || '');
    });
    
    if (imageFiles.length === 0) return;

    let firstAddedId = null;

    imageFiles.forEach((file, idx) => {
      const id = 'img_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      if (idx === 0) firstAddedId = id;
      
      const item = {
        id: id,
        file: file,
        status: 'pending', // 'pending' | 'processing' | 'done' | 'error'
        thumbUrl: '',
        originalWidth: null,
        originalHeight: null,
        convertedResult: null,
        errorMessage: null
      };

      const isHeic = (file.name && /\.(heic|heif)$/i.test(file.name)) || 
                     (file.type && (file.type.includes('heic') || file.type.includes('heif')));

      if (isHeic) {
        // Direct in-memory HEIC thumbnail render via libheif
        engine.decodeHeicToCanvas(file).then(canvas => {
          item.originalWidth = canvas.width;
          item.originalHeight = canvas.height;
          item.thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
          const thumbEl = document.querySelector(`#item-${item.id} .item-thumb`);
          if (thumbEl) thumbEl.src = item.thumbUrl;
          if (state.selectedItemId === item.id) {
            renderInspector();
            updateDropzoneSurface();
          }
        }).catch(err => {
          console.warn('HEIC thumbnail generation fallback:', err);
        });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          item.thumbUrl = e.target.result;
          const img = new Image();
          img.onload = () => {
            item.originalWidth = img.naturalWidth;
            item.originalHeight = img.naturalHeight;
            if (state.selectedItemId === item.id) {
              renderInspector();
              updateDropzoneSurface();
            }
          };
          img.src = item.thumbUrl;
          const thumbEl = document.querySelector(`#item-${item.id} .item-thumb`);
          if (thumbEl) thumbEl.src = item.thumbUrl;
          if (state.selectedItemId === item.id) {
            renderInspector();
            updateDropzoneSurface();
          }
        };
        reader.readAsDataURL(file);
      }

      state.queue.push(item);
    });

    if (!state.selectedItemId && firstAddedId) {
      state.selectedItemId = firstAddedId;
    }

    updateUI();
  }

  function getSelectedItem() {
    return state.queue.find(i => i.id === state.selectedItemId) || null;
  }

  function selectItem(id) {
    state.selectedItemId = id;
    renderQueueList();
    renderInspector();
    updateDropzoneSurface();
  }

  /**
   * Updates the Dropzone Surface: Displays live preview for both pending & converted images
   */
  function updateDropzoneSurface() {
    if (!dom.dropzone) return;

    const selected = getSelectedItem();

    if (selected) {
      dom.dropzone.classList.add('has-preview');
      if (dom.dropzoneDefaultContent) dom.dropzoneDefaultContent.style.display = 'none';
      if (dom.dropzonePreviewContent) dom.dropzonePreviewContent.style.display = 'flex';

      if (selected.status === 'done' && selected.convertedResult) {
        const res = selected.convertedResult;
        if (dom.dropzonePreviewImg) dom.dropzonePreviewImg.src = res.previewUrl;
        if (dom.dropzonePreviewBadge) {
          dom.dropzonePreviewBadge.textContent = `${res.convertedWidth} × ${res.convertedHeight} px • .${res.format.toUpperCase()} • ${ImageConverterEngine.formatBytes(res.convertedSize)}`;
        }
        if (dom.btnViewNewTab) dom.btnViewNewTab.style.display = 'inline-flex';
        if (dom.btnDownloadPreview) dom.btnDownloadPreview.style.display = 'inline-flex';
      } else {
        // Pending / unconverted image preview
        const previewSrc = selected.thumbUrl || '';
        if (dom.dropzonePreviewImg) dom.dropzonePreviewImg.src = previewSrc;
        if (dom.dropzonePreviewBadge) {
          if (!selected.thumbUrl) {
            dom.dropzonePreviewBadge.textContent = 'Loading preview...';
          } else {
            const dimText = (selected.originalWidth && selected.originalHeight)
              ? `${selected.originalWidth} × ${selected.originalHeight} px`
              : 'Original';
            dom.dropzonePreviewBadge.textContent = `${dimText} • Original • ${ImageConverterEngine.formatBytes(selected.file.size)}`;
          }
        }
        if (dom.btnViewNewTab) dom.btnViewNewTab.style.display = (selected.thumbUrl || selected.file) ? 'inline-flex' : 'none';
        if (dom.btnDownloadPreview) dom.btnDownloadPreview.style.display = 'none';
      }
    } else {
      // Empty queue state
      dom.dropzone.classList.remove('has-preview');
      if (dom.dropzoneDefaultContent) dom.dropzoneDefaultContent.style.display = 'flex';
      if (dom.dropzonePreviewContent) dom.dropzonePreviewContent.style.display = 'none';
      if (dom.btnViewNewTab) dom.btnViewNewTab.style.display = 'none';
      if (dom.btnDownloadPreview) dom.btnDownloadPreview.style.display = 'none';
    }
  }

  /**
   * Updates full queue list, summary statistics, and dropzone surface
   */
  function updateUI() {
    updateSettingsControlsVisibility();
    updateResizeControlsVisibility();

    const totalCount = state.queue.length;
    const doneItems = state.queue.filter(i => i.status === 'done');
    const doneCount = doneItems.length;

    let totalSavedBytes = 0;
    doneItems.forEach(item => {
      if (item.convertedResult) {
        const diff = item.convertedResult.originalSize - item.convertedResult.convertedSize;
        if (diff > 0) totalSavedBytes += diff;
      }
    });

    if (dom.statTotal) dom.statTotal.textContent = totalCount;
    if (dom.statDone) dom.statDone.textContent = doneCount;
    if (dom.statSaved) dom.statSaved.textContent = ImageConverterEngine.formatBytes(totalSavedBytes);

    if (totalCount === 0) {
      state.selectedItemId = null;
      if (dom.emptyState) dom.emptyState.style.display = 'block';
      if (dom.queueList) dom.queueList.innerHTML = '';
      if (dom.btnConvertAll) dom.btnConvertAll.disabled = true;
      if (dom.btnDownloadAll) dom.btnDownloadAll.disabled = true;
      if (dom.btnClearAll) dom.btnClearAll.disabled = true;
      renderInspector();
      updateDropzoneSurface();
      return;
    }

    if (dom.emptyState) dom.emptyState.style.display = 'none';
    if (dom.btnConvertAll) dom.btnConvertAll.disabled = state.isProcessingAll;
    if (dom.btnDownloadAll) dom.btnDownloadAll.disabled = doneCount === 0;
    if (dom.btnClearAll) dom.btnClearAll.disabled = state.isProcessingAll;

    // Ensure selected item exists
    if (!getSelectedItem() && state.queue.length > 0) {
      state.selectedItemId = state.queue[0].id;
    }

    renderQueueList();
    renderInspector();
    updateDropzoneSurface();
  }

  /**
   * Renders the item cards in the queue
   */
  function renderQueueList() {
    if (!dom.queueList) return;
    dom.queueList.innerHTML = '';

    state.queue.forEach(item => {
      const card = document.createElement('div');
      card.className = `queue-item-card ${item.id === state.selectedItemId ? 'selected' : ''}`;
      card.id = `item-${item.id}`;

      let statusBadgeClass = 'status-pending';
      let statusText = 'Ready';
      if (item.status === 'processing') {
        statusBadgeClass = 'status-processing';
        statusText = 'Converting...';
      } else if (item.status === 'done') {
        statusBadgeClass = 'status-done';
        statusText = 'Converted';
      } else if (item.status === 'error') {
        statusBadgeClass = 'status-error';
        statusText = 'Error';
      }

      let infoContent = '';
      if (item.status === 'done' && item.convertedResult) {
        const res = item.convertedResult;
        const origSizeFormatted = ImageConverterEngine.formatBytes(res.originalSize);
        const convSizeFormatted = ImageConverterEngine.formatBytes(res.convertedSize);
        const savings = parseFloat(res.compressionRatio);
        const savingsDisplay = savings > 0 
          ? `<span class="saved-tag">-${savings}%</span>` 
          : `<span style="color: var(--text-muted); font-family: var(--font-mono); font-size: 11px;">+${Math.abs(savings)}%</span>`;

        infoContent = `
          <div class="info-segment">${res.originalWidth}×${res.originalHeight} &rarr; ${res.convertedWidth}×${res.convertedHeight}</div>
          <div class="info-segment">${origSizeFormatted} &rarr; <strong style="color: var(--text-primary);">${convSizeFormatted}</strong></div>
          <div class="info-segment">${savingsDisplay}</div>
          <div class="info-segment" style="color: var(--accent-primary); font-weight: 500; text-transform: uppercase;">.${res.format}</div>
        `;
      } else if (item.status === 'error') {
        infoContent = `
          <div class="info-segment" style="color: var(--danger); font-size: 11px;">${item.errorMessage || 'Conversion failed'}</div>
        `;
      } else {
        const origSizeFormatted = ImageConverterEngine.formatBytes(item.file.size);
        infoContent = `
          <div class="info-segment">${origSizeFormatted}</div>
          <div class="info-segment">Target: <strong style="color: var(--text-primary); text-transform: uppercase;">.${state.globalSettings.format}</strong></div>
        `;
      }

      const thumbSrc = item.thumbUrl || 'icons/icon32.png';

      card.innerHTML = `
        <div class="item-thumb-box">
          <img class="item-thumb" src="${thumbSrc}" alt="thumbnail" draggable="false" />
        </div>
        <div class="item-meta-main">
          <div class="item-name-row">
            <span class="item-name" title="${item.file.name}">${item.file.name}</span>
            <span class="status-badge ${statusBadgeClass}">${statusText}</span>
          </div>
          <div class="item-info-row">
            ${infoContent}
          </div>
        </div>
        <div class="item-controls">
          ${item.status === 'done' ? `
            <button class="btn btn-sm" data-action="reconvert" data-id="${item.id}" title="Re-convert with current settings">
              Re-convert
            </button>
            <button class="btn btn-sm btn-primary" data-action="download" data-id="${item.id}" title="Download Converted Image">
              Download
            </button>
          ` : `
            <button class="btn btn-sm btn-primary" data-action="convert" data-id="${item.id}" ${state.isProcessingAll ? 'disabled' : ''}>
              Convert
            </button>
          `}
          <button class="btn btn-sm btn-danger" data-action="remove" data-id="${item.id}" title="Remove Item" ${state.isProcessingAll ? 'disabled' : ''}>
            &times;
          </button>
        </div>
      `;

      card.addEventListener('click', () => selectItem(item.id));
      card.querySelector('.item-thumb')?.addEventListener('error', function () { this.src = 'icons/icon32.png'; });
      card.querySelector('.item-controls')?.addEventListener('click', (e) => e.stopPropagation());
      card.querySelector('[data-action="remove"]')?.addEventListener('click', () => removeItem(item.id));
      card.querySelector('[data-action="convert"]')?.addEventListener('click', () => convertSingleItem(item));
      card.querySelector('[data-action="reconvert"]')?.addEventListener('click', () => convertSingleItem(item));
      card.querySelector('[data-action="download"]')?.addEventListener('click', () => downloadSingleItem(item));

      dom.queueList.appendChild(card);
    });
  }

  /**
   * Renders technical details for the selected item in sidebar
   */
  function renderInspector() {
    const selected = getSelectedItem();

    if (!selected) {
      if (dom.inspectorEmpty) {
        dom.inspectorEmpty.style.display = 'block';
        if (dom.inspectorEmptyText) dom.inspectorEmptyText.textContent = 'Select an item from the queue to view technical details.';
      }
      if (dom.inspectorBody) dom.inspectorBody.style.display = 'none';
      return;
    }

    if (dom.inspectorEmpty) dom.inspectorEmpty.style.display = 'none';
    if (dom.inspectorBody) dom.inspectorBody.style.display = 'flex';

    if (dom.inspectorFilename) {
      dom.inspectorFilename.textContent = selected.file.name;
      dom.inspectorFilename.title = selected.file.name;
    }

    const origDimText = (selected.originalWidth && selected.originalHeight) 
      ? `${selected.originalWidth} × ${selected.originalHeight} px`
      : (selected.convertedResult ? `${selected.convertedResult.originalWidth} × ${selected.convertedResult.originalHeight} px` : '-');

    if (dom.metricOrigDim) dom.metricOrigDim.textContent = origDimText;
    if (dom.metricOrigSize) dom.metricOrigSize.textContent = ImageConverterEngine.formatBytes(selected.file.size);

    if (selected.status === 'done' && selected.convertedResult) {
      const res = selected.convertedResult;
      if (dom.metricConvDim) dom.metricConvDim.textContent = `${res.convertedWidth} × ${res.convertedHeight} px`;
      if (dom.metricConvSize) dom.metricConvSize.textContent = ImageConverterEngine.formatBytes(res.convertedSize);
      if (dom.metricSavings) {
        const sav = parseFloat(res.compressionRatio);
        dom.metricSavings.textContent = sav > 0 ? `-${sav}%` : `+${Math.abs(sav)}%`;
        dom.metricSavings.style.color = sav > 0 ? 'var(--success)' : 'var(--text-muted)';
      }
      if (dom.metricFormat) dom.metricFormat.textContent = `.${res.format}`;
      if (dom.btnInspectorReconvert) {
        dom.btnInspectorReconvert.textContent = 'Re-convert Item';
        dom.btnInspectorReconvert.disabled = state.isProcessingAll;
      }
      if (dom.btnInspectorDownload) {
        dom.btnInspectorDownload.style.display = 'inline-flex';
        dom.btnInspectorDownload.disabled = false;
      }
    } else {
      // Display initial file metrics before conversion
      if (dom.metricConvDim) dom.metricConvDim.textContent = '-';
      if (dom.metricConvSize) dom.metricConvSize.textContent = '-';
      if (dom.metricSavings) {
        dom.metricSavings.textContent = '-';
        dom.metricSavings.style.color = 'var(--text-primary)';
      }
      if (dom.metricFormat) dom.metricFormat.textContent = `.${state.globalSettings.format}`;
      if (dom.btnInspectorReconvert) {
        dom.btnInspectorReconvert.textContent = 'Convert Item';
        dom.btnInspectorReconvert.disabled = state.isProcessingAll || selected.status === 'processing';
      }
      if (dom.btnInspectorDownload) {
        dom.btnInspectorDownload.style.display = 'none';
        dom.btnInspectorDownload.disabled = true;
      }
    }
  }

  /**
   * Converts a single item in queue
   */
  async function convertSingleItem(item) {
    if (!item || item.status === 'processing') return;

    item.status = 'processing';
    updateUI();

    try {
      const options = { ...state.globalSettings };
      const result = await engine.processImage(item.file, options);
      item.convertedResult = result;
      item.status = 'done';
      item.errorMessage = null;
    } catch (err) {
      console.error('Conversion failed for item:', item.file.name, err);
      item.status = 'error';
      item.errorMessage = err?.message || 'Failed to convert';
    }

    updateUI();
  }

  /**
   * Batch converts all items in the queue with the latest global settings
   */
  async function handleConvertAll() {
    if (state.isProcessingAll) return;
    state.isProcessingAll = true;
    updateUI();

    const itemsToProcess = state.queue;

    for (const item of itemsToProcess) {
      item.status = 'processing';
      updateUI();
      try {
        const options = { ...state.globalSettings };
        const result = await engine.processImage(item.file, options);
        item.convertedResult = result;
        item.status = 'done';
        item.errorMessage = null;
      } catch (err) {
        console.error('Batch convert error on:', item.file.name, err);
        item.status = 'error';
        item.errorMessage = err?.message || 'Failed to convert';
      }
      updateUI();
    }

    state.isProcessingAll = false;
    updateUI();
  }

  /**
   * Safely opens any image item (converted or unconverted) in a new tab using Blob URLs (CSP & Chrome MV3 compliant)
   */
  async function openItemInNewTab(item) {
    if (!item) return;

    // 1. If already converted, open converted result blob URL
    if (item.convertedResult?.previewUrl) {
      window.open(item.convertedResult.previewUrl, '_blank');
      return;
    }

    // 2. If it is a browser-native image format (PNG, JPG, WebP, SVG, GIF, AVIF, BMP)
    const isHeicOrTiff = (item.file.name && /\.(heic|heif|tiff?|tif)$/i.test(item.file.name)) ||
                         (item.file.type && (item.file.type.includes('heic') || item.file.type.includes('heif') || item.file.type.includes('tiff')));

    if (!isHeicOrTiff && item.file) {
      const blobUrl = URL.createObjectURL(item.file);
      window.open(blobUrl, '_blank');
      return;
    }

    // 3. For HEIC/TIFF: Convert data URL to Blob URL so Chrome permits top-level navigation
    if (item.thumbUrl && item.thumbUrl.startsWith('data:')) {
      try {
        const parts = item.thumbUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        return;
      } catch (err) {
        console.warn('Error converting thumbnail data to blob URL:', err);
      }
    }

    // 4. On-demand decode fallback for HEIC
    if (item.file) {
      try {
        const canvas = await engine.decodeHeicToCanvas(item.file);
        canvas.toBlob((blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
          }
        }, 'image/png');
      } catch (err) {
        console.error('Failed to open unconverted image in new tab:', err);
      }
    }
  }

  /**
   * Downloads a single converted image
   */
  function downloadSingleItem(item) {
    if (!item || !item.convertedResult) return;
    const res = item.convertedResult;
    const a = document.createElement('a');
    a.href = res.previewUrl;
    a.download = res.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Bundles all converted files into a ZIP archive and triggers download
   */
  async function handleDownloadAllZip() {
    const doneItems = state.queue.filter(i => i.status === 'done' && i.convertedResult);
    if (doneItems.length === 0) return;

    if (typeof JSZip === 'undefined') {
      alert('JSZip library not found. Downloading files individually...');
      doneItems.forEach(item => downloadSingleItem(item));
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder('converted_images');

    for (const item of doneItems) {
      const res = item.convertedResult;
      folder.file(res.name, res.blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `converted_images_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);
  }

  /**
   * Removes an individual item from queue
   */
  function removeItem(id) {
    const index = state.queue.findIndex(i => i.id === id);
    if (index !== -1) {
      const item = state.queue[index];
      if (item.convertedResult?.previewUrl) {
        try { URL.revokeObjectURL(item.convertedResult.previewUrl); } catch(e) {}
      }
      state.queue.splice(index, 1);

      if (state.selectedItemId === id) {
        state.selectedItemId = state.queue.length > 0 ? state.queue[0].id : null;
      }
      updateUI();
    }
  }

  /**
   * Clears entire queue
   */
  function handleClearAll() {
    state.queue.forEach(item => {
      if (item.convertedResult?.previewUrl) {
        try { URL.revokeObjectURL(item.convertedResult.previewUrl); } catch(e) {}
      }
    });
    state.queue = [];
    state.selectedItemId = null;
    updateUI();
  }

  /**
   * Opens detailed comparison modal
   */
  function openPreviewModal(item) {
    if (!item || !item.convertedResult) return;
    activeModalItem = item;

    const res = item.convertedResult;
    if (dom.previewOrigImg) dom.previewOrigImg.src = item.thumbUrl || 'icons/icon128.png';
    if (dom.previewConvImg) dom.previewConvImg.src = res.previewUrl;

    if (dom.previewOrigMeta) {
      dom.previewOrigMeta.innerHTML = `
        <div><strong>File:</strong> ${res.originalName}</div>
        <div><strong>Dimensions:</strong> ${res.originalWidth} × ${res.originalHeight} px</div>
        <div><strong>File Size:</strong> ${ImageConverterEngine.formatBytes(res.originalSize)}</div>
      `;
    }

    if (dom.previewConvMeta) {
      dom.previewConvMeta.innerHTML = `
        <div><strong>File:</strong> ${res.name}</div>
        <div><strong>Dimensions:</strong> ${res.convertedWidth} × ${res.convertedHeight} px</div>
        <div><strong>File Size:</strong> ${ImageConverterEngine.formatBytes(res.convertedSize)}</div>
        <div><strong>Compression:</strong> <span class="saved-tag">${res.compressionRatio}%</span></div>
      `;
    }

    if (dom.modal) dom.modal.classList.add('active');
  }

  function closeModal() {
    if (dom.modal) dom.modal.classList.remove('active');
    activeModalItem = null;
  }

  // Initialize once DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
