(function () {
  'use strict';

  const ANALYSIS_MAX_SIDE = 224;

  async function ensureOpenCvReady() {
    let attempts = 0;
    while (!window.cv && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts += 1;
    }
    if (!window.cv) {
      throw new Error('OpenCV.js failed to load.');
    }

    const maybePromise = window.cv instanceof Promise ? await window.cv : window.cv;
    if (!maybePromise || typeof maybePromise.Mat !== 'function') {
      throw new Error('OpenCV.js is not ready yet.');
    }
    return maybePromise;
  }

  async function analyzeVideoFrame(video) {
    const cv = await ensureOpenCvReady();
    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error('Camera frame is not ready.');
    }

    const canvas = document.createElement('canvas');
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const scale = Math.min(1, ANALYSIS_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let src = null;
    let gray = null;
    let laplacian = null;
    let mean = null;
    let stddev = null;

    try {
      src = cv.imread(canvas);
      gray = new cv.Mat();
      laplacian = new cv.Mat();
      mean = new cv.Mat();
      stddev = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      cv.Laplacian(gray, laplacian, cv.CV_64F);

      const brightness = cv.mean(gray)[0];
      cv.meanStdDev(laplacian, mean, stddev);
      const stdValue = stddev.doubleAt(0, 0);

      return {
        brightness,
        sharpness: stdValue * stdValue,
        width: canvas.width,
        height: canvas.height
      };
    } finally {
      if (src) src.delete();
      if (gray) gray.delete();
      if (laplacian) laplacian.delete();
      if (mean) mean.delete();
      if (stddev) stddev.delete();
    }
  }

  window.PSPFaceVision = {
    ensureOpenCvReady,
    analyzeVideoFrame
  };
})();
