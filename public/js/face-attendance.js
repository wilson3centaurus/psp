(function () {
  'use strict';

  const LOG = (...a) => console.log('[PSP-Attend]', ...a);
  const ERR = (...a) => console.error('[PSP-Attend]', ...a);

  const MODEL_URI = '/models';
  const INPUT_SIZE = 160;          // must match TF.js 1.7.4 compatible value
  const SCORE_THRESHOLD = 0.4;
  const MATCH_THRESHOLD = 0.50;    // lower = stricter face match
  const COOLDOWN_MS = 8000;        // don't re-recognise same person for 8 s
  const SCAN_INTERVAL_MS = 1500;   // how often to run detection
  const MAX_SIDE = 320;

  let modelsReady = false;
  let modelsPromise = null;
  let matcher = null;
  let scanTimer = null;
  let videoStream = null;
  let scanInFlight = false;
  const cooldown = new Map();

  // ── Model load ────────────────────────────────────────────────────────────
  async function ensureModels() {
    if (modelsReady) return;
    if (!window.faceapi) throw new Error('face-api.js not loaded');
    if (!modelsPromise) {
      LOG('Loading face models...');
      modelsPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI)
      ]);
    }
    await modelsPromise;
    modelsReady = true;
    LOG('Models loaded OK');
  }

  // ── TF backend ───────────────────────────────────────────────────────────
  async function ensureTF() {
    if (!window.tf) return;
    try {
      try { await tf.setBackend('webgl'); await tf.ready(); LOG('TF backend: WebGL'); }
      catch (_) { await tf.setBackend('cpu'); await tf.ready(); LOG('TF backend: CPU'); }
    } catch (e) { ERR('TF init failed:', e); }
  }

  // ── Camera error ──────────────────────────────────────────────────────────
  function mapCameraError(err) {
    const msg = String((err && (err.message || err.name)) || '');
    if (!window.isSecureContext && location.hostname !== 'localhost')
      return 'Camera requires HTTPS.';
    if (!navigator.mediaDevices?.getUserMedia)
      return 'Camera API not available in this browser.';
    if (/NotAllowedError|Permission denied/i.test(msg))
      return 'Camera permission denied — allow access in browser settings.';
    if (/NotFoundError/i.test(msg)) return 'No camera found.';
    if (/NotReadableError/i.test(msg)) return 'Camera in use by another app.';
    return msg || 'Cannot access camera.';
  }

  // ── Capture video frame ───────────────────────────────────────────────────
  function captureFrame(video) {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) throw new Error('Camera frame not ready');
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, c.width, c.height);
    return c;
  }

  // ── Build face matcher from enrolled profiles ─────────────────────────────
  function buildMatcher(profiles) {
    const labeled = profiles.map(p => {
      try {
        const arr = typeof p.descriptor === 'string' ? JSON.parse(p.descriptor) : p.descriptor;
        if (!Array.isArray(arr) || arr.length !== 128) return null;
        return new faceapi.LabeledFaceDescriptors(String(p.id), [new Float32Array(arr)]);
      } catch (_) { return null; }
    }).filter(Boolean);

    if (!labeled.length) return null;
    LOG('Built matcher with', labeled.length, 'enrolled faces');
    return new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function setStatus(text, state) {
    const el = document.getElementById('face-status');
    if (!el) return;
    el.textContent = text;
    el.dataset.state = state || '';
  }

  function addEvent(msg) {
    const log = document.getElementById('face-events');
    if (!log) return;
    const d = document.createElement('div');
    d.className = 'face-event';
    d.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
    log.prepend(d);
    while (log.childElementCount > 10) log.removeChild(log.lastChild);
  }

  // ── Guide overlay ─────────────────────────────────────────────────────────
  function attachGuide(video) {
    if (!video || video.parentElement?.classList.contains('face-camera-shell')) return;
    const shell = document.createElement('div');
    shell.className = 'face-camera-shell';
    shell.style.cssText = 'position:relative;width:100%;';
    video.parentNode.insertBefore(shell, video);
    shell.appendChild(video);
    shell.insertAdjacentHTML('beforeend', `
      <div style="position:absolute;inset:0;pointer-events:none;border-radius:10px;overflow:hidden;">
        <div style="position:absolute;inset:10%;border:2px solid rgba(255,255,255,0.9);border-radius:26px;box-shadow:0 0 0 999px rgba(6,11,28,0.35);"></div>
        <div style="position:absolute;left:50%;bottom:1rem;transform:translateX(-50%);padding:.35rem .7rem;border-radius:999px;background:rgba(12,18,31,.75);color:#fff;font-size:.78rem;font-weight:600;white-space:nowrap;">Look at the camera</div>
      </div>`);
  }

  // ── One scan cycle ────────────────────────────────────────────────────────
  async function scanOnce(video) {
    if (scanInFlight || !matcher) return;
    scanInFlight = true;
    try {
      const canvas = captureFrame(video);
      const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: INPUT_SIZE, scoreThreshold: SCORE_THRESHOLD });
      const detection = await faceapi.detectSingleFace(canvas, opts).withFaceLandmarks().withFaceDescriptor();
      if (!detection) return;

      const match = matcher.findBestMatch(detection.descriptor);
      LOG('Best match:', match.label, 'dist:', match.distance.toFixed(3));
      if (!match || match.label === 'unknown') { addEvent('Face not recognised'); return; }

      const personId = Number(match.label);
      const now = Date.now();
      if (cooldown.has(personId) && now - cooldown.get(personId) < COOLDOWN_MS) return;
      cooldown.set(personId, now);

      const profiles = window.PSP_FACE_PROFILES || [];
      const person = profiles.find(p => Number(p.id) === personId);
      if (!person) return;

      LOG('Recognised:', person.name);
      addEvent('✅ Recognised: ' + person.name);
      setStatus('✅ ' + person.name + ' — marked Present', 'ok');

      if (typeof window.PSPFaceAttendance_onRecognized === 'function') {
        await window.PSPFaceAttendance_onRecognized(personId, person.name, match.distance);
      }
    } catch (err) {
      ERR('Scan error:', err);
    } finally {
      scanInFlight = false;
    }
  }

  // ── Start / stop ──────────────────────────────────────────────────────────
  async function startFaceScanner() {
    const profiles = window.PSP_FACE_PROFILES || [];
    if (!profiles.length) {
      setStatus('⚠ No enrolled faces in this class. Enroll students first.', 'warn');
      return;
    }

    const video = document.getElementById('face-video');
    if (!video) return;
    attachGuide(video);

    setStatus('📷 Requesting camera…', 'ok');
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
    } catch (err) { throw new Error(mapCameraError(err)); }

    video.srcObject = videoStream;
    setStatus('⏳ Loading face models…', 'ok');
    await ensureModels();
    await ensureTF();

    matcher = buildMatcher(profiles);
    if (!matcher) { setStatus('⚠ No valid face descriptors found.', 'warn'); return; }

    setStatus('🟢 Scanner running — students, look at the camera one at a time.', 'ok');
    LOG('Starting scan interval', SCAN_INTERVAL_MS, 'ms');

    document.getElementById('start-face-scan')?.setAttribute('disabled', '');
    document.getElementById('stop-face-scan')?.removeAttribute('disabled');

    scanTimer = setInterval(() => scanOnce(video).catch(ERR), SCAN_INTERVAL_MS);
  }

  function stopFaceScanner() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    scanInFlight = false;
    if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
    const video = document.getElementById('face-video');
    if (video) video.srcObject = null;
    matcher = null;
    cooldown.clear();
    setStatus('🔴 Scanner stopped.', 'warn');
    document.getElementById('start-face-scan')?.removeAttribute('disabled');
    document.getElementById('stop-face-scan')?.setAttribute('disabled', '');
    LOG('Scanner stopped');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-face-scan');
    const stopBtn  = document.getElementById('stop-face-scan');
    if (stopBtn) stopBtn.setAttribute('disabled', '');
    if (startBtn) startBtn.addEventListener('click', () => startFaceScanner().catch(e => { ERR(e); setStatus('❌ ' + e.message, 'error'); }));
    if (stopBtn)  stopBtn.addEventListener('click', stopFaceScanner);
  });
})();
