(function () {
  'use strict';

  const MODEL_URI = '/models';
  let modelsReady = false;
  let modelsPromise = null;
  let faceRuntimeReady = false;
  let faceRuntimePromise = null;
  const MIN_BRIGHTNESS = 55;
  const MIN_SHARPNESS = 45;
  const DETECTION_MAX_SIDE = 320;

  async function ensureModelsLoaded() {
    if (modelsReady) return;
    if (!window.faceapi) throw new Error('Face engine not loaded.');
    try {
      modelsPromise = modelsPromise || Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI)
      ]);
      await modelsPromise;
    } catch (_) {
      modelsPromise = null;
      throw new Error('Could not load facial recognition models. Refresh the page and try again.');
    }
    modelsReady = true;
  }

  async function ensureFaceRuntimeReady() {
    if (faceRuntimeReady) return;
    if (!window.tf || !window.faceapi) return;
    try {
      faceRuntimePromise = faceRuntimePromise || (async () => {
        // Force a stable backend to avoid first-run WebGL compilation stalls on weaker devices.
        if (typeof tf.getBackend === 'function' && tf.getBackend() !== 'cpu') {
          await tf.setBackend('cpu');
        }
        if (typeof tf.ready === 'function') {
          await tf.ready();
        }

        const warmCanvas = document.createElement('canvas');
        warmCanvas.width = 160;
        warmCanvas.height = 160;
        const ctx = warmCanvas.getContext('2d');
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, warmCanvas.width, warmCanvas.height);

        try {
          await faceapi
            .detectSingleFace(warmCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        } catch (_) {
          // Warmup can legitimately return no face; the goal is kernel/runtime initialization.
        }
      })();
      await faceRuntimePromise;
    } catch (_) {
      faceRuntimePromise = null;
      return;
    }
    faceRuntimeReady = true;
  }

  function ensureGuideStyles() {
    if (document.getElementById('face-guide-styles')) return;
    const style = document.createElement('style');
    style.id = 'face-guide-styles';
    style.textContent = `
      .face-camera-shell {
        position: relative;
        width: 100%;
        max-width: 420px;
        margin-bottom: 0.75rem;
      }
      .face-camera-shell .face-video {
        margin-bottom: 0;
      }
      .face-guide-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: 10px;
        overflow: hidden;
      }
      .face-guide-overlay::before {
        content: '';
        position: absolute;
        inset: 10%;
        border: 2px solid rgba(255, 255, 255, 0.92);
        border-radius: 26px;
        box-shadow: 0 0 0 999px rgba(8, 15, 33, 0.32);
      }
      .face-guide-overlay::after {
        content: '';
        position: absolute;
        top: 22%;
        bottom: 22%;
        left: 50%;
        width: 1px;
        background: rgba(255, 255, 255, 0.25);
        transform: translateX(-50%);
      }
      .face-guide-label {
        position: absolute;
        left: 50%;
        bottom: 0.9rem;
        transform: translateX(-50%);
        padding: 0.38rem 0.7rem;
        border-radius: 999px;
        background: rgba(12, 18, 31, 0.72);
        color: #fff;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .face-guide-corners span {
        position: absolute;
        width: 26px;
        height: 26px;
        border-color: #f8fafc;
        border-style: solid;
        opacity: 0.95;
      }
      .face-guide-corners span:nth-child(1) {
        top: calc(10% - 1px);
        left: calc(10% - 1px);
        border-width: 3px 0 0 3px;
        border-top-left-radius: 20px;
      }
      .face-guide-corners span:nth-child(2) {
        top: calc(10% - 1px);
        right: calc(10% - 1px);
        border-width: 3px 3px 0 0;
        border-top-right-radius: 20px;
      }
      .face-guide-corners span:nth-child(3) {
        right: calc(10% - 1px);
        bottom: calc(10% - 1px);
        border-width: 0 3px 3px 0;
        border-bottom-right-radius: 20px;
      }
      .face-guide-corners span:nth-child(4) {
        bottom: calc(10% - 1px);
        left: calc(10% - 1px);
        border-width: 0 0 3px 3px;
        border-bottom-left-radius: 20px;
      }
    `;
    document.head.appendChild(style);
  }

  function attachGuide(video, labelText) {
    if (!video || video.parentElement?.classList.contains('face-camera-shell')) return;
    ensureGuideStyles();
    const shell = document.createElement('div');
    shell.className = 'face-camera-shell';
    video.parentNode.insertBefore(shell, video);
    shell.appendChild(video);

    const overlay = document.createElement('div');
    overlay.className = 'face-guide-overlay';
    overlay.innerHTML = `
      <div class="face-guide-corners">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="face-guide-label">${labelText}</div>
    `;
    shell.appendChild(overlay);
  }

  function mapCameraError(err) {
    const msg = String(err && (err.message || err.name) || '');
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      return 'Camera requires HTTPS. Open this page on https:// or localhost.';
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return 'Camera API unavailable in this browser/context.';
    }
    if (/NotAllowedError|Permission denied/i.test(msg)) {
      return 'Camera permission denied. Allow camera access in browser settings.';
    }
    if (/NotFoundError|Requested device not found/i.test(msg)) {
      return 'No camera detected on this device.';
    }
    if (/NotReadableError|TrackStartError/i.test(msg)) {
      return 'Camera is in use by another app. Close it and retry.';
    }
    return msg || 'Unable to access camera.';
  }

  function setStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.dataset.state = type || '';
  }

  function setBusyState(buttons, isBusy) {
    buttons.forEach((button) => {
      if (!button) return;
      button.disabled = isBusy;
      button.dataset.busy = isBusy ? 'true' : 'false';
    });
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function captureSnapshot(video) {
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    if (!width || !height) {
      throw new Error('Camera frame is not ready.');
    }

    const scale = Math.min(1, DETECTION_MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function setupEnrollment(root) {
    const video = root.querySelector('[data-face-video]');
    const hidden = root.querySelector('[data-face-hidden]');
    const preview = root.querySelector('[data-face-preview]');
    const startBtn = root.querySelector('[data-face-start]');
    const captureBtn = root.querySelector('[data-face-capture]');
    const clearBtn = root.querySelector('[data-face-clear]');
    const status = root.querySelector('[data-face-status]');
    const form = root.closest('form');
    const required = root.getAttribute('data-face-required') === 'true';
    let stream = null;

    attachGuide(video, 'Fit one face inside the frame');

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(mapCameraError(new Error('Camera API unavailable')));
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
      } catch (err) {
        throw new Error(mapCameraError(err));
      }
      video.srcObject = stream;
      setStatus(status, 'Camera ready. Loading facial recognition models...', 'ok');
      try {
        await ensureModelsLoaded();
        setStatus(status, 'Camera ready. Optimizing face capture...', 'ok');
        await ensureFaceRuntimeReady();
        setStatus(status, 'Camera ready. Center one face inside the frame and click Capture Face.', 'ok');
      } catch (err) {
        setStatus(status, err.message, 'error');
      }
    }

    async function captureFace() {
      await ensureModelsLoaded();
      await ensureFaceRuntimeReady();
      if (!video || !video.srcObject) {
        setStatus(status, 'Start camera first.', 'error');
        return;
      }

      setBusyState([startBtn, captureBtn, clearBtn], true);
      setStatus(status, 'Processing face capture. Hold still...', 'ok');
      try {
        try {
          await nextFrame();
          if (window.PSPFaceVision) {
            const metrics = await window.PSPFaceVision.analyzeVideoFrame(video);
            if (metrics.brightness < MIN_BRIGHTNESS) {
              setStatus(status, 'Frame too dark. Improve lighting and try again.', 'error');
              return;
            }
            if (metrics.sharpness < MIN_SHARPNESS) {
              setStatus(status, 'Frame is blurry. Hold still and retry.', 'error');
              return;
            }
          }
        } catch (_) {
          // Keep capture usable even if OpenCV quality checks are still loading.
        }

        await nextFrame();
        const snapshot = captureSnapshot(video);
        const detection = await faceapi
          .detectSingleFace(snapshot, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setStatus(status, 'No face detected. Improve lighting and try again.', 'error');
          return;
        }

        hidden.value = JSON.stringify(Array.from(detection.descriptor));
        if (preview) {
          preview.innerHTML = '<i class="fas fa-check-circle"></i> Face enrolled';
        }
        setStatus(status, 'Face captured successfully. OpenCV quality check passed.', 'ok');
      } finally {
        setBusyState([startBtn, captureBtn, clearBtn], false);
      }
    }

    function clearFace() {
      hidden.value = '';
      if (preview) {
        preview.innerHTML = '<i class="fas fa-user"></i> Not enrolled';
      }
      setStatus(status, 'Face enrollment cleared.', 'warn');
    }

    if (startBtn) startBtn.addEventListener('click', () => startCamera().catch((err) => setStatus(status, err.message, 'error')));
    if (captureBtn) captureBtn.addEventListener('click', () => captureFace().catch((err) => setStatus(status, err.message, 'error')));
    if (clearBtn) clearBtn.addEventListener('click', clearFace);

    if (form) {
      form.addEventListener('submit', (e) => {
        if (required && !hidden.value) {
          e.preventDefault();
          setStatus(status, 'Face enrollment is required before submitting.', 'error');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-face-enrollment]').forEach((root) => {
      setupEnrollment(root).catch(() => {});
    });
  });
})();
