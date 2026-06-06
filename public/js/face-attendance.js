(function () {
  'use strict';

  const MODEL_URI = '/models';
  let modelsReady = false;
  let modelsPromise = null;
  let faceRuntimeReady = false;
  let faceRuntimePromise = null;
  let scanTimer = null;
  let videoStream = null;
  const cooldown = new Map();
  const COOLDOWN_MS = 12000;
  const MIN_BRIGHTNESS = 50;
  const MIN_SHARPNESS = 35;
  const DETECTION_MAX_SIDE = 320;
  let scanInFlight = false;

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
      throw new Error('Could not load facial recognition models. Refresh and retry.');
    }
    modelsReady = true;
  }

  async function ensureFaceRuntimeReady() {
    if (faceRuntimeReady) return;
    if (!window.tf || !window.faceapi) return;
    try {
      faceRuntimePromise = faceRuntimePromise || (async () => {
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
          // No-face result is expected during warmup.
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
      }
      .face-guide-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: 12px;
        overflow: hidden;
      }
      .face-guide-overlay::before {
        content: '';
        position: absolute;
        inset: 11%;
        border: 2px solid rgba(255, 255, 255, 0.92);
        border-radius: 30px;
        box-shadow: 0 0 0 999px rgba(6, 11, 28, 0.34);
      }
      .face-guide-overlay::after {
        content: '';
        position: absolute;
        top: 22%;
        bottom: 22%;
        left: 50%;
        width: 1px;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.22);
      }
      .face-guide-label {
        position: absolute;
        left: 50%;
        bottom: 1rem;
        transform: translateX(-50%);
        padding: 0.4rem 0.75rem;
        border-radius: 999px;
        background: rgba(12, 18, 31, 0.75);
        color: #fff;
        font-size: 0.8rem;
        font-weight: 600;
      }
      .face-guide-corners span {
        position: absolute;
        width: 28px;
        height: 28px;
        border-color: #f8fafc;
        border-style: solid;
      }
      .face-guide-corners span:nth-child(1) {
        top: calc(11% - 1px);
        left: calc(11% - 1px);
        border-width: 3px 0 0 3px;
        border-top-left-radius: 20px;
      }
      .face-guide-corners span:nth-child(2) {
        top: calc(11% - 1px);
        right: calc(11% - 1px);
        border-width: 3px 3px 0 0;
        border-top-right-radius: 20px;
      }
      .face-guide-corners span:nth-child(3) {
        right: calc(11% - 1px);
        bottom: calc(11% - 1px);
        border-width: 0 3px 3px 0;
        border-bottom-right-radius: 20px;
      }
      .face-guide-corners span:nth-child(4) {
        bottom: calc(11% - 1px);
        left: calc(11% - 1px);
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
      return 'Camera permission denied. Allow camera access and retry.';
    }
    if (/NotFoundError|Requested device not found/i.test(msg)) {
      return 'No camera detected on this device.';
    }
    if (/NotReadableError|TrackStartError/i.test(msg)) {
      return 'Camera is already in use by another app.';
    }
    return msg || 'Unable to access camera.';
  }

  function setStatus(text, state) {
    const el = document.getElementById('face-status');
    if (!el) return;
    el.textContent = text;
    el.dataset.state = state || '';
  }

  function appendEvent(message) {
    const log = document.getElementById('face-events');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'face-event';
    row.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    log.prepend(row);
    while (log.childElementCount > 8) {
      log.removeChild(log.lastChild);
    }
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

  function buildMatcher(profiles) {
    const labeled = profiles
      .map((p) => {
        try {
          const parsed = typeof p.descriptor === 'string' ? JSON.parse(p.descriptor) : p.descriptor;
          if (!Array.isArray(parsed) || parsed.length !== 128) return null;
          return new faceapi.LabeledFaceDescriptors(String(p.id), [new Float32Array(parsed)]);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);

    if (!labeled.length) return null;
    return new faceapi.FaceMatcher(labeled, 0.48);
  }

  async function startFaceScanner() {
    const profiles = Array.isArray(window.PSP_FACE_PROFILES) ? window.PSP_FACE_PROFILES : [];
    if (!profiles.length) {
      setStatus('No enrolled faces found. Capture faces in the Add/Edit Student or Teacher forms first.', 'warn');
      return;
    }

    const video = document.getElementById('face-video');
    if (!video) return;
    attachGuide(video, 'Align one face inside the frame');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(mapCameraError(new Error('Camera API unavailable')));
    }
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
    } catch (err) {
      throw new Error(mapCameraError(err));
    }
    video.srcObject = videoStream;
    setStatus('Camera ready. Loading facial recognition...', 'ok');

    await ensureModelsLoaded();
    setStatus('Camera ready. Optimizing scanner...', 'ok');
    await ensureFaceRuntimeReady();
    const matcher = buildMatcher(profiles);
    if (!matcher) {
      setStatus('No valid face descriptors available.', 'warn');
      return;
    }

    setStatus('Scanner running. Look at the camera one at a time.', 'ok');

    scanTimer = setInterval(async () => {
      if (scanInFlight) return;
      scanInFlight = true;
      try {
        try {
          if (window.PSPFaceVision) {
            const metrics = await window.PSPFaceVision.analyzeVideoFrame(video);
            if (metrics.brightness < MIN_BRIGHTNESS || metrics.sharpness < MIN_SHARPNESS) {
              setStatus('Camera running. Improve lighting or hold still for recognition.', 'warn');
              return;
            }
          }
        } catch (_) {
          // Continue with recognition even if OpenCV quality checks are unavailable.
        }

        const snapshot = captureSnapshot(video);
        const detection = await faceapi
          .detectSingleFace(snapshot, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) return;

        const result = matcher.findBestMatch(detection.descriptor);
        if (!result || result.label === 'unknown') {
          appendEvent('Face not recognized');
          return;
        }

        const personId = Number(result.label);
        const now = Date.now();
        if (cooldown.has(personId) && now - cooldown.get(personId) < COOLDOWN_MS) return;
        cooldown.set(personId, now);

        const person = profiles.find((p) => Number(p.id) === personId);
        if (!person) return;

        if (typeof window.PSPFaceAttendance_onRecognized === 'function') {
          await window.PSPFaceAttendance_onRecognized(personId, person.name, result.distance);
        }
        appendEvent(`Recognized: ${person.name}`);
        setStatus(`Recognized ${person.name}. Attendance marked present.`, 'ok');
      } catch (err) {
        if (err && err.studentId) cooldown.delete(err.studentId);
        if (err && err.message) {
          setStatus(err.message, 'error');
          appendEvent(err.message);
        }
      } finally {
        scanInFlight = false;
      }
    }, 1200);
  }

  function stopFaceScanner() {
    if (scanTimer) {
      clearInterval(scanTimer);
      scanTimer = null;
    }
    scanInFlight = false;
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
      videoStream = null;
    }
    const video = document.getElementById('face-video');
    if (video) video.srcObject = null;
    setStatus('Scanner stopped.', 'warn');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-face-scan');
    const stopBtn = document.getElementById('stop-face-scan');
    const video = document.getElementById('face-video');
    if (video) attachGuide(video, 'Align one face inside the frame');
    if (startBtn) startBtn.addEventListener('click', () => startFaceScanner().catch((err) => setStatus(err.message, 'error')));
    if (stopBtn) stopBtn.addEventListener('click', stopFaceScanner);
  });
})();
