(function () {
  function processingBrightness(r, g, b) {
    return Math.max(r | 0, g | 0, b | 0);
  }

  function readRgbaFromDrawable(src, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, w, h);
    return new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
  }

  function lerpRgbByte(a, b, t) {
    return (a + (b - a) * t) | 0;
  }

  function lerpColorRgb(ir0, ig0, ib0, ir1, ig1, ib1, t) {
    t = Math.max(0, Math.min(1, t));
    return [lerpRgbByte(ir0, ir1, t), lerpRgbByte(ig0, ig1, t), lerpRgbByte(ib0, ib1, t)];
  }

  function boxBlurRgbaClone(pixels, w, h, r) {
    const src = new Uint8ClampedArray(pixels);
    const mid = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let c = 0;
        for (let k = -r; k <= r; k++) {
          const xi = Math.min(w - 1, Math.max(0, x + k));
          const i = row + xi * 4;
          sr += src[i];
          sg += src[i + 1];
          sb += src[i + 2];
          c++;
        }
        const o = row + x * 4;
        mid[o] = (sr / c) | 0;
        mid[o + 1] = (sg / c) | 0;
        mid[o + 2] = (sb / c) | 0;
        mid[o + 3] = 255;
      }
    }
    const out = new Uint8ClampedArray(pixels.length);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let c = 0;
        for (let k = -r; k <= r; k++) {
          const yi = Math.min(h - 1, Math.max(0, y + k));
          const i = (yi * w + x) * 4;
          sr += mid[i];
          sg += mid[i + 1];
          sb += mid[i + 2];
          c++;
        }
        const o = (y * w + x) * 4;
        out[o] = (sr / c) | 0;
        out[o + 1] = (sg / c) | 0;
        out[o + 2] = (sb / c) | 0;
        out[o + 3] = 255;
      }
    }
    return out;
  }

  function dilateMono3(src, dst, w, h) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let m = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            m = Math.max(m, src[yy * w + xx]);
          }
        }
        dst[y * w + x] = m;
      }
    }
  }

  function erodeMono3(src, dst, w, h) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let m = 255;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            m = Math.min(m, src[yy * w + xx]);
          }
        }
        dst[y * w + x] = m;
      }
    }
  }

  function createEdgeMaskMono(overlayRgba, w, h, maskThreshold) {
    const th = maskThreshold == null ? 128 : maskThreshold;
    const n = w * h;
    const binary = new Uint8Array(n);
    const dilated = new Uint8Array(n);
    const eroded = new Uint8Array(n);
    const out = new Uint8Array(n);
    for (let pi = 0; pi < n; pi++) {
      const i = pi * 4;
      binary[pi] = processingBrightness(overlayRgba[i], overlayRgba[i + 1], overlayRgba[i + 2]) >= th ? 255 : 0;
    }
    dilateMono3(binary, dilated, w, h);
    erodeMono3(dilated, eroded, w, h);
    for (let pi = 0; pi < n; pi++) {
      out[pi] = Math.max(dilated[pi] - eroded[pi], 0);
    }
    return out;
  }

  const EARTHY = [
    [139, 69, 19],
    [160, 82, 45],
    [205, 133, 63],
    [222, 184, 135],
    [85, 107, 47],
  ];

  function blendLikeProcessing(img0, img1, overlayImg, w, h, opts) {
    const legacy = opts == null || opts === undefined;
    const useEarthyEdge = legacy ? true : opts.useEarthyEdge !== false;
    const maskThreshold = legacy ? 128 : opts.maskThreshold != null ? opts.maskThreshold : 128;
    const edgeGate = legacy ? 128 : opts.edgeGate != null ? opts.edgeGate : 128;
    const overlayGate = legacy ? 128 : opts.overlayGate != null ? Number(opts.overlayGate) : 128;
    const overlayFeather = legacy
      ? 0
      : opts.overlayFeather != null
        ? Math.max(0, Math.min(255, Number(opts.overlayFeather)))
        : 0;
    const overlayInvert = legacy
      ? 0
      : opts.overlayInvert != null
        ? Math.max(0, Math.min(1, Number(opts.overlayInvert)))
        : 0;
    const blurCap = useEarthyEdge ? 24 : 40;
    const blurR = legacy
      ? 8
      : Math.max(1, Math.min(blurCap, Math.round(opts.blurRadius != null ? opts.blurRadius : 8)));
    const earthyMix = legacy ? 0.5 : Math.max(0, Math.min(1, opts.earthyMix != null ? opts.earthyMix : 0.5));

    const pix0 = readRgbaFromDrawable(img0, w, h);
    const pix1 = readRgbaFromDrawable(img1, w, h);
    const pixO = readRgbaFromDrawable(overlayImg, w, h);
    const blurred1 = boxBlurRgbaClone(pix1, w, h, blurR);
    const edgeMono = useEarthyEdge ? createEdgeMaskMono(pixO, w, h, maskThreshold) : null;
    const n = w * h;
    const out = new Uint8ClampedArray(n * 4);
    for (let pi = 0; pi < n; pi++) {
      const i = pi * 4;
      const r0 = pix0[i];
      const g0 = pix0[i + 1];
      const b0 = pix0[i + 2];
      const r1 = pix1[i];
      const g1 = pix1[i + 1];
      const b1 = pix1[i + 2];
      const br1 = blurred1[i];
      const bg1 = blurred1[i + 1];
      const bb1 = blurred1[i + 2];
      const rO = pixO[i];
      const gO = pixO[i + 1];
      const bO = pixO[i + 2];
      const edgeBrt = useEarthyEdge ? edgeMono[pi] : 0;
      const overlayBrt = processingBrightness(rO, gO, bO);
      let rr;
      let gg;
      let bb;
      if (useEarthyEdge && edgeBrt > edgeGate) {
        const gradientFactor = legacy
          ? 0.4 + Math.random() * 0.4
          : Math.max(0, Math.min(1, opts.edgeGradientFactor != null ? opts.edgeGradientFactor : 0.6));
        const earth = legacy
          ? EARTHY[(Math.random() * EARTHY.length) | 0]
          : EARTHY[(opts.earthIndex | 0) % EARTHY.length];
        const mid = lerpColorRgb(r1, g1, b1, br1, bg1, bb1, gradientFactor);
        rr = (earth[0] + (mid[0] - earth[0]) * earthyMix) | 0;
        gg = (earth[1] + (mid[1] - earth[1]) * earthyMix) | 0;
        bb = (earth[2] + (mid[2] - earth[2]) * earthyMix) | 0;
      } else {
        const gradientFactor = processingBrightness(r0, g0, b0) / 255;
        const t = lerpColorRgb(r1, g1, b1, br1, bg1, bb1, gradientFactor);
        let wThru;
        if (overlayFeather <= 0) {
          wThru = overlayBrt > overlayGate ? 1 : 0;
        } else {
          const half = overlayFeather * 0.5;
          const lo = overlayGate - half;
          const hi = overlayGate + half;
          const span = hi - lo;
          if (span <= 0) {
            wThru = overlayBrt > overlayGate ? 1 : 0;
          } else {
            wThru = (overlayBrt - lo) / span;
            if (wThru < 0) wThru = 0;
            if (wThru > 1) wThru = 1;
          }
        }
        if (overlayInvert > 0) {
          wThru = wThru + (1 - 2 * wThru) * overlayInvert;
        }
        rr = (t[0] + (r0 - t[0]) * wThru) | 0;
        gg = (t[1] + (g0 - t[1]) * wThru) | 0;
        bb = (t[2] + (b0 - t[2]) * wThru) | 0;
      }
      out[i] = rr;
      out[i + 1] = gg;
      out[i + 2] = bb;
      out[i + 3] = 255;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(new ImageData(out, w, h), 0, 0);
    return canvas;
  }

  function loadImageUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(url));
      img.src = url;
    });
  }

  function imageLoadOk(img) {
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
  }

  async function loadImagesForUrls(urls) {
    const uniq = [...new Set(urls)];
    const map = new Map();
    await Promise.all(
      uniq.map(async (u) => {
        const im = await loadImageUrl(u);
        map.set(u, im);
      })
    );
    return urls.map((u) => map.get(u));
  }

  window.BlendCore = {
    blendLikeProcessing,
    loadImageUrl,
    imageLoadOk,
    loadImagesForUrls,
  };
})();
