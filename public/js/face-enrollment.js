(function () {
  'use strict';

  const LOG = (...a) => console.log('[PSP-Face]', ...a);
  const ERR = (...a) => console.error('[PSP-Face]', ...a);

  const MODEL_URI = '/models';
  const SCORE_THRESHOLD = 0.25;
  const INPUT_SIZE = 160;   // 128|160|224 — 160 is fast and accurate enough

  let modelsReady = false;
  let modelsLoading = false;
  let modelsPromise = null;
  let tfReady = false;

  // ── Yield to browser between heavy ops ───────────────────────────────────
  // This is the key fix — tf.nextFrame() gives the browser a chance to
  // repaint and handle events between TF.js inference steps.
  function nextFrame() {
    return new Promise(r => requestAnimationFrame(r));
  }

  // ── Model pre-load ────────────────────────────────────────────────────────
  function preloadModels() {
    if (modelsReady || modelsLoading) return modelsPromise || Promise.resolve();
    if (!window.faceapi) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const wait = setInterval(() => {
          attempts++;
          LOG('Waiting for faceapi...', attempts);
          if (window.faceapi) {
            clearInterval(wait);
            preloadModels().then(resolve).catch(reject);
          } else if (attempts > 40) {
            clearInterval(wait);
            reject(new Error('face-api.js failed to load — check /vendor/face-api.min.js'));
          }
        }, 500);
      });
    }
    modelsLoading = true;
    LOG('Loading face models from', MODEL_URI);
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI)
    ]).then(() => {
      modelsReady = true;
      modelsLoading = false;
      LOG('All 3 face models loaded OK');
    }).catch((err) => {
      modelsLoading = false;
      modelsPromise = null;
      ERR('Model load failed:', err);
      throw new Error('Could not load face models: ' + err.message);
    });
    return modelsPromise;
  }

  async function ensureTFReady() {
    if (tfReady) return;
    if (!window.tf) { LOG('TF.js not present, skipping backend init'); return; }
    LOG('Initialising TF.js backend...');
    try {
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        LOG('TF.js backend: WebGL');
      } catch (e) {
        LOG('WebGL failed, falling back to CPU:', e.message);
        await tf.setBackend('cpu');
        await tf.ready();
        LOG('TF.js backend: CPU');
      }
    } catch (e) { ERR('TF.js backend init failed:', e); }
    tfReady = true;
  }

  // ── Camera error messages ─────────────────────────────────────────────────
  function mapCameraError(err) {
    if (!window.isSecureContext && location.hostname !== 'localhost')
      return 'Camera requires HTTPS. Use https:// or localhost.';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return 'Camera API not available in this browser.';
    const msg = String((err && (err.message || err.name)) || '');
    if (/NotAllowedError|Permission denied/i.test(msg))
      return 'Camera permission denied — allow camera access in your browser settings.';
    if (/NotFoundError|Requested device not found/i.test(msg))
      return 'No camera found on this device.';
    if (/NotReadableError|TrackStartError/i.test(msg))
      return 'Camera in use by another app — close it and retry.';
    return msg || 'Unable to access camera.';
  }

  // ── Guide overlay styles ──────────────────────────────────────────────────
  function ensureGuideStyles() {
    if (document.getElementById('face-guide-styles')) return;
    const s = document.createElement('style');
    s.id = 'face-guide-styles';
    s.textContent = `
      .face-camera-shell { position:relative; width:100%; max-width:420px; margin-bottom:.75rem; }
      .face-camera-shell .face-video { margin-bottom:0; }
      .face-guide-overlay { position:absolute; inset:0; pointer-events:none; border-radius:10px; overflow:hidden; }
      .face-guide-overlay::before { content:''; position:absolute; inset:10%;
        border:2px solid rgba(255,255,255,0.92); border-radius:26px;
        box-shadow:0 0 0 999px rgba(8,15,33,0.32); }
      .face-guide-label { position:absolute; left:50%; bottom:.9rem; transform:translateX(-50%);
        padding:.38rem .7rem; border-radius:999px; background:rgba(12,18,31,.72);
        color:#fff; font-size:.78rem; font-weight:600; white-space:nowrap; }
      .face-guide-corners span { position:absolute; width:26px; height:26px;
        border-color:#f8fafc; border-style:solid; opacity:.95; }
      .face-guide-corners span:nth-child(1) { top:calc(10% - 1px); left:calc(10% - 1px); border-width:3px 0 0 3px; border-top-left-radius:20px; }
      .face-guide-corners span:nth-child(2) { top:calc(10% - 1px); right:calc(10% - 1px); border-width:3px 3px 0 0; border-top-right-radius:20px; }
      .face-guide-corners span:nth-child(3) { right:calc(10% - 1px); bottom:calc(10% - 1px); border-width:0 3px 3px 0; border-bottom-right-radius:20px; }
      .face-guide-corners span:nth-child(4) { bottom:calc(10% - 1px); left:calc(10% - 1px); border-width:0 0 3px 3px; border-bottom-left-radius:20px; }
      [data-face-status] { display:block; padding:.5rem .75rem; border-radius:8px; margin-top:.5rem;
        font-size:.82rem; font-weight:500; background:rgba(0,0,0,.08); }
      [data-face-status][data-state="error"] { background:rgba(229,62,62,.12); color:#e53e3e; }
      [data-face-status][data-state="ok"]    { background:rgba(56,161,105,.12); color:#276749; }
      [data-face-status][data-state="warn"]  { background:rgba(214,158,46,.12); color:#744210; }
    `;
    document.head.appendChild(s);
  }

  function attachGuide(video, label) {
    if (!video || video.parentElement?.classList.contains('face-camera-shell')) return;
    ensureGuideStyles();
    const shell = document.createElement('div');
    shell.className = 'face-camera-shell';
    video.parentNode.insertBefore(shell, video);
    shell.appendChild(video);
    shell.insertAdjacentHTML('beforeend', `
      <div class="face-guide-overlay">
        <div class="face-guide-corners"><span></span><span></span><span></span><span></span></div>
        <div class="face-guide-label">${label}</div>
      </div>`);
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.dataset.state = type || '';
    LOG('STATUS [' + (type||'') + ']:', msg);
  }

  function setBusy(buttons, busy) {
    buttons.forEach(b => { if (b) { b.disabled = busy; } });
  }

  // ── Grab one frame from the live video ───────────────────────────────────
  function captureFrame(video, maxSide) {
    const w = video.videoWidth || 0, h = video.videoHeight || 0;
    if (!w || !h) throw new Error('Camera frame not ready (videoWidth=0).');
    const scale = Math.min(1, (maxSide || 320) / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, canvas.width, canvas.height);
    LOG(`Frame captured: ${canvas.width}×${canvas.height} (original ${w}×${h}, scale ${scale.toFixed(2)})`);
    return canvas;
  }

  // ── Main setup per enrollment card ───────────────────────────────────────
  async function setupEnrollment(root) {
    ensureGuideStyles();
    LOG('setupEnrollment called');

    const video      = root.querySelector('[data-face-video]');
    const hidden     = root.querySelector('[data-face-hidden]');
    const preview    = root.querySelector('[data-face-preview]');
    const startBtn   = root.querySelector('[data-face-start]');
    const captureBtn = root.querySelector('[data-face-capture]');
    const clearBtn   = root.querySelector('[data-face-clear]');
    const status     = root.querySelector('[data-face-status]');
    const form       = root.closest('form');
    const required   = root.getAttribute('data-face-required') === 'true';

    let stream = null;
    let modelLoadError = null;

    attachGuide(video, 'Fit face inside the frame');
    setStatus(status, '⏳ Loading face recognition engine in the background…', 'ok');

    preloadModels()
      .then(() => ensureTFReady())
      .then(() => {
        if (!stream) setStatus(status, '✓ Engine ready. Click "Start Camera", then "Capture Face".', 'ok');
      })
      .catch(err => {
        modelLoadError = err.message;
        setStatus(status, '⚠ Face engine failed: ' + err.message, 'error');
      });

    // ── Start camera ──────────────────────────────────────────────────────
    async function startCamera() {
      LOG('startCamera called. modelsReady=', modelsReady, 'modelLoadError=', modelLoadError);
      if (modelLoadError) throw new Error('Face engine not ready: ' + modelLoadError);
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(mapCameraError({}));

      setStatus(status, '📷 Requesting camera access…', 'ok');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        LOG('Camera stream obtained');
      } catch (err) {
        throw new Error(mapCameraError(err));
      }
      video.srcObject = stream;

      if (!modelsReady) {
        setStatus(status, '📡 Camera on. Still loading face models, please wait…', 'ok');
        await preloadModels();
        await ensureTFReady();
      }
      setStatus(status, '✅ Ready! Centre your face and click "Capture Face".', 'ok');
    }

    // ── Single-shot capture ───────────────────────────────────────────────
    async function captureFace() {
      LOG('captureFace called. modelsReady=', modelsReady, 'tfReady=', tfReady);

      if (!modelsReady) {
        setStatus(status, '⏳ Models still loading — wait a moment and try again.', 'warn');
        return;
      }
      if (!video || !video.srcObject) {
        setStatus(status, '⚠ Start the camera first.', 'error');
        return;
      }
      if (!video.videoWidth) {
        setStatus(status, '⚠ Camera still initialising — wait a second.', 'warn');
        return;
      }

      setBusy([startBtn, captureBtn, clearBtn], true);
      setStatus(status, '📸 Capturing — hold still…', 'ok');
      await nextFrame();

      try {
        LOG('--- Capture starting ---');
        const t0 = performance.now();
        const canvas = captureFrame(video, 320);

        await nextFrame();
        LOG('Running detectSingleFace (inputSize=' + INPUT_SIZE + ', threshold=' + SCORE_THRESHOLD + ')...');
        const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: INPUT_SIZE, scoreThreshold: SCORE_THRESHOLD });

        const full = await faceapi
          .detectSingleFace(canvas, opts)
          .withFaceLandmarks()
          .withFaceDescriptor();

        await nextFrame();
        const elapsed = (performance.now() - t0).toFixed(0);
        LOG('Detection completed in', elapsed + 'ms. Result:', full ? 'face found' : 'no face');

        if (!full) {
          setStatus(status,
            '❌ No face detected. Tips: face the camera directly, ensure good lighting, move closer.',
            'error');
          setBusy([startBtn, captureBtn, clearBtn], false);
          return;
        }

        const descriptor = Array.from(full.descriptor);
        hidden.value = JSON.stringify(descriptor);

        if (preview) {
          preview.innerHTML = `<i class="fas fa-check-circle" style="color:#38a169;margin-right:5px;"></i>Face enrolled (${elapsed}ms)`;
          preview.style.color = '#276749';
        }
        setStatus(status, `🎉 Face captured in ${elapsed}ms! You can now save.`, 'ok');
        LOG('Descriptor saved (128-dim vector)');

      } catch (e) {
        ERR('Capture error:', e);
        setStatus(status, '❌ Capture failed: ' + e.message + ' — check browser console (F12) for details.', 'error');
      }

      setBusy([startBtn, captureBtn, clearBtn], false);
    }

    function clearFace() {
      hidden.value = '';
      if (preview) { preview.innerHTML = '<i class="fas fa-user"></i> Not enrolled'; preview.style.color = ''; }
      setStatus(status, 'Cleared. Capture again before saving.', 'warn');
      LOG('Face descriptor cleared');
    }

    if (startBtn)   startBtn.addEventListener('click',   () => startCamera().catch(e => { ERR(e); setStatus(status, '❌ ' + e.message, 'error'); }));
    if (captureBtn) captureBtn.addEventListener('click', () => captureFace().catch(e => { ERR(e); setStatus(status, '❌ ' + e.message, 'error'); }));
    if (clearBtn)   clearBtn.addEventListener('click',   clearFace);

    if (form) {
      form.addEventListener('submit', e => {
        if (required && !hidden.value) {
          e.preventDefault();
          setStatus(status, '❌ Face required before saving. Start camera → Capture Face.', 'error');
          root.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    LOG('DOMContentLoaded — scanning for [data-face-enrollment] cards');
    const cards = document.querySelectorAll('[data-face-enrollment]');
    LOG('Found', cards.length, 'enrollment card(s)');
    cards.forEach(root => {
      setupEnrollment(root).catch(e => ERR('setupEnrollment failed:', e));
    });
  });
})();

