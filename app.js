/**
 * HH Goa 2026 — Shoreline Poster Engine
 * Live Webcam Selfie, Side-by-Side Sticky Layout & X Share Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const canvas = document.getElementById('pfpCanvas');
  const ctx = canvas.getContext('2d');
  const canvasContainer = document.getElementById('canvasContainer');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const cameraInput = document.getElementById('cameraInput');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const gestureHint = document.getElementById('gestureHint');
  const controlsToolbar = document.getElementById('controlsToolbar');
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');

  // Webcam Elements
  const webcamModal = document.getElementById('webcamModal');
  const webcamVideo = document.getElementById('webcamVideo');
  const closeWebcam = document.getElementById('closeWebcam');
  const btnSnapPhoto = document.getElementById('btnSnapPhoto');
  let webcamStream = null;
  
  // Controls
  const zoomSlider = document.getElementById('zoomSlider');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnRotate = document.getElementById('btnRotate');
  const btnReset = document.getElementById('btnReset');
  const btnChangePhoto = document.getElementById('btnChangePhoto');
  const btnBrowse = document.getElementById('btnBrowse');
  const btnCamera = document.getElementById('btnCamera');
  
  // Export & Share
  const btnDownload = document.getElementById('btnDownload');
  const btnDownloadMobile = document.getElementById('btnDownloadMobile');
  const btnShareX = document.getElementById('btnShareX');
  const btnShareXMobile = document.getElementById('btnShareXMobile');
  const mobileStickyBar = document.getElementById('mobileStickyBar');
  
  // Selectors
  const themeCards = document.querySelectorAll('.theme-card');
  const badgeBtns = document.querySelectorAll('.badge-btn');
  const sampleThumbs = document.querySelectorAll('.sample-thumb');

  // Canvas Settings (1200 x 1200 px)
  const CANVAS_SIZE = 1200;
  const CENTER_X = CANVAS_SIZE / 2;
  const CENTER_Y = 560;
  const CUTOUT_RADIUS = 390;

  // State
  let userImage = null;
  let isImageLoaded = false;

  let transform = {
    x: CENTER_X,
    y: CENTER_Y,
    scale: 1.0,
    baseScale: 1.0,
    rotation: 0
  };

  let currentTheme = 'sunset'; // 'sunset', 'lagoon', 'neon', 'retro'
  let currentBadge = 'BUILDER';

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let touchStartDist = 0;
  let touchStartScale = 1.0;

  // Initialize Canvas
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  renderCanvas();

  /* ==========================================================================
     1. Image Upload & HEIC Loading
     ========================================================================== */

  btnBrowse.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  btnCamera.addEventListener('click', (e) => {
    e.stopPropagation();
    openLiveWebcam();
  });

  btnChangePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', (e) => {
    if (!e.target.closest('button') && !e.target.closest('.sample-thumb')) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
  cameraInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  sampleThumbs.forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      loadImageUrl(thumb.dataset.url);
    });
  });

  async function handleFileSelect(file) {
    if (!file) return;
    showLoading('Reading image...');

    const isHeic = file.name.toLowerCase().endsWith('.heic') || 
                  file.name.toLowerCase().endsWith('.heif') || 
                  file.type === 'image/heic' || 
                  file.type === 'image/heif';

    try {
      let imageBlob = file;
      if (isHeic) {
        showLoading('Converting HEIC image...');
        if (window.heic2any) {
          const conversionResult = await window.heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.92
          });
          imageBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
        }
      }

      const reader = new FileReader();
      reader.onload = (e) => loadImageUrl(e.target.result);
      reader.readAsDataURL(imageBlob);
    } catch (error) {
      console.error('Image load error:', error);
      hideLoading();
      alert('Could not process this image format. Please try a JPG or PNG photo.');
    }
  }

  function loadImageUrl(url) {
    showLoading('Rendering poster avatar...');
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      userImage = img;
      isImageLoaded = true;

      const minDimension = Math.min(img.width, img.height);
      const targetSize = CUTOUT_RADIUS * 2;
      transform.baseScale = targetSize / minDimension;
      transform.scale = 1.0;
      transform.x = CENTER_X;
      transform.y = CENTER_Y;
      transform.rotation = 0;

      zoomSlider.value = 1.0;

      dropzone.style.display = 'none';
      controlsToolbar.classList.add('active');
      gestureHint.style.display = 'flex';
      mobileStickyBar.classList.add('active');

      hideLoading();
      renderCanvas();
    };

    img.onerror = () => {
      hideLoading();
      alert('Failed to load image. Please try another photo!');
    };

    img.src = url;
  }

  function showLoading(msg = 'Processing...') {
    loadingText.textContent = msg;
    loadingOverlay.classList.add('active');
  }

  function hideLoading() {
    loadingOverlay.classList.remove('active');
  }

  /* ==========================================================================
     2. Live Webcam Camera Selfie Flow
     ========================================================================== */

  async function openLiveWebcam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback if browser doesn't support MediaDevices API
      cameraInput.click();
      return;
    }

    try {
      showLoading('Requesting camera access...');
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      hideLoading();

      webcamVideo.srcObject = webcamStream;
      webcamModal.classList.add('active');
    } catch (err) {
      console.warn('Webcam permission denied or error:', err);
      hideLoading();
      // Fallback to standard file input camera
      cameraInput.click();
    }
  }

  function stopWebcamStream() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }
    webcamModal.classList.remove('active');
  }

  closeWebcam.addEventListener('click', stopWebcamStream);

  btnSnapPhoto.addEventListener('click', () => {
    if (!webcamVideo.videoWidth) return;

    // Capture frame from video stream onto canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = webcamVideo.videoWidth;
    tempCanvas.height = webcamVideo.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Flip horizontally for mirror selfie
    tempCtx.translate(tempCanvas.width, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(webcamVideo, 0, 0, tempCanvas.width, tempCanvas.height);

    const snapshotUrl = tempCanvas.toDataURL('image/jpeg', 0.92);
    stopWebcamStream();
    loadImageUrl(snapshotUrl);
  });

  /* ==========================================================================
     3. Interactive Drag & Zoom Controls
     ========================================================================== */

  canvasContainer.addEventListener('pointerdown', (e) => {
    if (!isImageLoaded) return;
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    canvasContainer.setPointerCapture(e.pointerId);
  });

  canvasContainer.addEventListener('pointermove', (e) => {
    if (!isDragging || !isImageLoaded) return;

    const rect = canvas.getBoundingClientRect();
    const scaleFactor = CANVAS_SIZE / rect.width;

    const dx = (e.clientX - dragStart.x) * scaleFactor;
    const dy = (e.clientY - dragStart.y) * scaleFactor;

    transform.x += dx;
    transform.y += dy;

    dragStart = { x: e.clientX, y: e.clientY };
    renderCanvas();
  });

  const stopDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      try { canvasContainer.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };

  canvasContainer.addEventListener('pointerup', stopDrag);
  canvasContainer.addEventListener('pointercancel', stopDrag);

  canvasContainer.addEventListener('wheel', (e) => {
    if (!isImageLoaded) return;
    e.preventDefault();
    updateZoom(transform.scale + (e.deltaY < 0 ? 0.05 : -0.05));
  }, { passive: false });

  canvasContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2 && isImageLoaded) {
      touchStartDist = getTouchDist(e.touches);
      touchStartScale = transform.scale;
    }
  });

  canvasContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && isImageLoaded) {
      e.preventDefault();
      const currentDist = getTouchDist(e.touches);
      if (touchStartDist > 0) {
        updateZoom(touchStartScale * (currentDist / touchStartDist));
      }
    }
  }, { passive: false });

  function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  zoomSlider.addEventListener('input', (e) => updateZoom(parseFloat(e.target.value)));
  btnZoomIn.addEventListener('click', () => updateZoom(transform.scale + 0.1));
  btnZoomOut.addEventListener('click', () => updateZoom(transform.scale - 0.1));

  function updateZoom(newScale) {
    const clamped = Math.max(0.2, Math.min(3.0, newScale));
    transform.scale = clamped;
    zoomSlider.value = clamped;
    renderCanvas();
  }

  btnRotate.addEventListener('click', () => {
    transform.rotation = (transform.rotation + 90) % 360;
    renderCanvas();
  });

  btnReset.addEventListener('click', () => {
    transform.x = CENTER_X;
    transform.y = CENTER_Y;
    transform.scale = 1.0;
    transform.rotation = 0;
    zoomSlider.value = 1.0;
    renderCanvas();
  });

  /* ==========================================================================
     4. Customization Selectors
     ========================================================================== */

  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      themeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentTheme = card.dataset.theme;
      renderCanvas();
    });
  });

  badgeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      badgeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBadge = btn.dataset.badge;
      renderCanvas();
    });
  });

  /* ==========================================================================
     5. Canvas Compositing Engine — Shoreline Poster
     ========================================================================== */

  function renderCanvas() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const themes = {
      sunset: {
        fieldColor: '#FF5A1F',       // Field Orange
        fieldDeep:  '#E2470F',
        cream:      '#FFF8EC',
        ink:        '#14110B',
        lagoon:     '#1AB0A6',
        hibiscus:   '#FF3F81',
        navy:       '#0A2E4D'
      },
      lagoon: {
        fieldColor: '#0A2E4D',       // Ocean Navy
        fieldDeep:  '#061E33',
        cream:      '#FFF8EC',
        ink:        '#14110B',
        lagoon:     '#1AB0A6',
        hibiscus:   '#FF3F81',
        navy:       '#FF5A1F'
      },
      neon: {
        fieldColor: '#FF3F81',       // Hibiscus Pink
        fieldDeep:  '#D92665',
        cream:      '#FFF8EC',
        ink:        '#14110B',
        lagoon:     '#2EC4B6',
        hibiscus:   '#FF5A1F',
        navy:       '#0A2E4D'
      },
      retro: {
        fieldColor: '#F4E4C1',       // Sand Beige
        fieldDeep:  '#D9B48F',
        cream:      '#14110B',
        ink:        '#FFF8EC',
        lagoon:     '#1AB0A6',
        hibiscus:   '#FF5A1F',
        navy:       '#0A2E4D'
      }
    };

    const palette = themes[currentTheme] || themes.sunset;

    // --- 1. FLAT BOLD POSTER FIELD BACKGROUND ---
    ctx.fillStyle = palette.fieldColor;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Subtle Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 248, 236, 0.08)';
    ctx.lineWidth = 4;
    for (let x = 0; x < CANVAS_SIZE; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_SIZE);
      ctx.stroke();
    }
    ctx.restore();

    // --- 2. ORGANIC BLOB PHOTO WINDOW MASK ---
    ctx.save();
    ctx.beginPath();
    drawBlobPath(ctx, CENTER_X, CENTER_Y, CUTOUT_RADIUS + 18);
    ctx.fillStyle = palette.ink;
    ctx.shadowColor = 'rgba(20, 17, 11, 0.4)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;
    ctx.fill();

    ctx.strokeStyle = palette.cream;
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();

    // Inner Photo Cutout Clip
    if (userImage && isImageLoaded) {
      ctx.save();
      ctx.beginPath();
      drawBlobPath(ctx, CENTER_X, CENTER_Y, CUTOUT_RADIUS);
      ctx.closePath();
      ctx.clip();

      ctx.translate(transform.x, transform.y);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      const effectiveScale = transform.baseScale * transform.scale;
      ctx.scale(effectiveScale, effectiveScale);

      ctx.drawImage(
        userImage,
        -userImage.width / 2,
        -userImage.height / 2,
        userImage.width,
        userImage.height
      );
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      drawBlobPath(ctx, CENTER_X, CENTER_Y, CUTOUT_RADIUS);
      ctx.fillStyle = palette.fieldDeep;
      ctx.fill();
      ctx.restore();
    }

    // --- 3. OVERSIZED CONDENSED DISPLAY TYPE ('Anton') ---
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const headerTitle = "HH GOA 2026";
    ctx.font = '800 135px "Anton", system-ui, sans-serif';

    ctx.fillStyle = palette.ink;
    ctx.fillText(headerTitle, CENTER_X + 6, 146);
    ctx.fillText(headerTitle, CENTER_X - 6, 146);
    ctx.fillText(headerTitle, CENTER_X, 150);

    ctx.fillStyle = palette.cream;
    ctx.fillText(headerTitle, CENTER_X, 140);

    const bottomText = "SHORELINE POSTER EDITION";
    ctx.font = '800 48px "Anton", system-ui, sans-serif';
    ctx.fillStyle = palette.ink;
    ctx.fillText(bottomText, CENTER_X + 3, CANVAS_SIZE - 102);
    ctx.fillStyle = palette.cream;
    ctx.fillText(bottomText, CENTER_X, CANVAS_SIZE - 105);

    ctx.font = '700 32px "JetBrains Mono", monospace';
    ctx.fillStyle = palette.lagoon;
    ctx.fillText("#FrameInGoa", CENTER_X, CANVAS_SIZE - 50);
    ctx.restore();

    // --- 4. BUILDER STAMP (If enabled) ---
    if (currentBadge !== 'NONE') {
      ctx.save();
      const badgeY = CENTER_Y + CUTOUT_RADIUS - 10;
      const badgeWidth = 300;
      const badgeHeight = 64;
      const badgeRadius = 32;

      drawRoundRect(ctx, CENTER_X - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, badgeRadius);

      ctx.fillStyle = palette.hibiscus;
      ctx.fill();

      ctx.strokeStyle = palette.cream;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 32px "Anton", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚡ ${currentBadge}`, CENTER_X, badgeY);
      ctx.restore();
    }
  }

  function drawBlobPath(c, cx, cy, r) {
    c.beginPath();
    const rx = r * 0.96;
    const ry = r * 1.02;

    c.moveTo(cx - rx * 0.8, cy - ry * 0.7);
    c.bezierCurveTo(cx - rx * 0.2, cy - ry * 1.1, cx + rx * 0.7, cy - ry * 0.9, cx + rx * 0.95, cy - ry * 0.3);
    c.bezierCurveTo(cx + rx * 1.1, cy + ry * 0.4, cx + rx * 0.6, cy + ry * 1.0, cx, cy + ry * 0.95);
    c.bezierCurveTo(cx - rx * 0.7, cy + ry * 0.9, cx - rx * 1.05, cy + ry * 0.3, cx - rx * 0.9, cy - ry * 0.4);
    c.closePath();
  }

  function drawRoundRect(c, x, y, width, height, radius) {
    c.beginPath();
    if (typeof c.roundRect === 'function') {
      c.roundRect(x, y, width, height, radius);
    } else {
      c.moveTo(x + radius, y);
      c.lineTo(x + width - radius, y);
      c.quadraticCurveTo(x + width, y, x + width, y + radius);
      c.lineTo(x + width, y + height - radius);
      c.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      c.lineTo(x + radius, y + height);
      c.quadraticCurveTo(x, y + height, x, y + height - radius);
      c.lineTo(x, y + radius);
      c.quadraticCurveTo(x, y, x + radius, y);
      c.closePath();
    }
  }

  /* ==========================================================================
     6. Export & Twitter Share Flow with Live Post Preview Modal
     ========================================================================== */

  const shareModal = document.getElementById('shareModal');
  const closeShareModal = document.getElementById('closeShareModal');
  const shareModalImg = document.getElementById('shareModalImg');
  const modalBtnCopyImage = document.getElementById('modalBtnCopyImage');
  const modalBtnOpenX = document.getElementById('modalBtnOpenX');

  let currentPublicImageUrl = null;
  let currentShareBlob = null;

  function showToast(msg, duration = 4000) {
    toastText.textContent = msg;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, duration);
  }

  function getCanvasBlob() {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  }

  function triggerDownload() {
    if (!isImageLoaded) {
      alert('Please upload or choose a photo first!');
      return false;
    }

    try {
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      if (isIOS) {
        const newTab = window.open();
        if (newTab) {
          newTab.document.write(`<title>HH Goa 2026 Profile Picture</title><img src="${dataUrl}" style="width:100%;max-width:600px;margin:auto;display:block;border-radius:12px;"/>`);
          newTab.document.write('<p style="text-align:center;font-family:sans-serif;color:#333;margin-top:12px;">Long-press image to Save to Photos!</p>');
        } else {
          location.href = dataUrl;
        }
      } else {
        const link = document.createElement('a');
        link.download = `HH-Goa-2026-Shoreline-Poster.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return true;
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to generate image download. Please try right-clicking the canvas to save.');
      return false;
    }
  }

  async function uploadImageToTempHost(blob) {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'hh-goa-2026-pfp.png');

      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const json = await response.json();
        if (json.data && json.data.url) {
          return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        }
      }
    } catch (e) {
      console.warn('Temp image upload warning:', e);
    }
    return null;
  }

  async function copyImageToClipboard(blob) {
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        return true;
      } catch (err) {
        console.log('Clipboard image copy not permitted:', err);
      }
    }
    return false;
  }

  async function shareToX() {
    if (!isImageLoaded) {
      alert('Please upload or select a photo first!');
      return;
    }

    showLoading('Preparing avatar for X...');
    currentShareBlob = await getCanvasBlob();
    const dataUrl = canvas.toDataURL('image/png', 1.0);

    // Update modal preview image
    shareModalImg.src = dataUrl;

    // A) Try Web Share API (native share on Mobile iOS / Android)
    const imageFile = new File([currentShareBlob], 'HH-Goa-2026-Avatar.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      hideLoading();
      try {
        await navigator.share({
          title: 'HH Goa 2026 Profile Picture',
          text: `Heading to #HHGoa2026 🌊⚡ Can't wait to build with everyone in Goa! #FrameInGoa`,
          files: [imageFile]
        });
        showToast("Shared to X successfully!");
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed, opening modal fallback:', err);
        }
      }
    }

    // B) Copy Image to Clipboard
    const copied = await copyImageToClipboard(currentShareBlob);

    // C) Trigger local file download
    triggerDownload();

    // D) Upload image to public temp host
    currentPublicImageUrl = await uploadImageToTempHost(currentShareBlob);
    hideLoading();

    // Open Live Tweet Preview Modal
    shareModal.classList.add('active');

    if (copied) {
      showToast("PNG Image copied to Clipboard! Press Ctrl+V inside tweet box to paste image!", 5000);
    } else {
      showToast("Avatar downloaded! Attach PNG file to your tweet on X.", 4000);
    }
  }

  closeShareModal.addEventListener('click', () => {
    shareModal.classList.remove('active');
  });

  modalBtnCopyImage.addEventListener('click', async () => {
    if (currentShareBlob) {
      const success = await copyImageToClipboard(currentShareBlob);
      if (success) {
        showToast("Image copied to clipboard! Press Ctrl + V on X to paste image.");
      } else {
        triggerDownload();
        showToast("Image downloaded to your device!");
      }
    }
  });

  modalBtnOpenX.addEventListener('click', () => {
    const captionText = `Heading to #HHGoa2026 🌊⚡ Can't wait to build with everyone in Goa! Check out my official frame avatar #FrameInGoa`;
    let shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(captionText)}`;

    if (currentPublicImageUrl) {
      shareUrl += `&url=${encodeURIComponent(currentPublicImageUrl)}`;
    }

    window.open(shareUrl, '_blank', 'width=600,height=550');
  });

  btnDownload.addEventListener('click', () => {
    if (triggerDownload()) {
      showToast("Avatar PNG downloaded successfully!");
    }
  });

  btnDownloadMobile.addEventListener('click', () => {
    if (triggerDownload()) {
      showToast("Avatar PNG downloaded successfully!");
    }
  });

  btnShareX.addEventListener('click', shareToX);
  btnShareXMobile.addEventListener('click', shareToX);
});
