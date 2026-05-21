function sortExhibitFolderKeys(keys) {
  return keys.slice().sort((a, b) => {
    if (a === '_root' && b === '_root') return 0;
    if (a === '_root') return -1;
    if (b === '_root') return 1;
    const da = /^\d+$/.test(a);
    const db = /^\d+$/.test(b);
    if (da && db) return parseInt(a, 10) - parseInt(b, 10);
    if (da) return -1;
    if (db) return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function pairedFolderKeys(leftFolders, rightFolders) {
  if (!leftFolders || !rightFolders) return [];
  const rightSet = new Set(Object.keys(rightFolders));
  return sortExhibitFolderKeys(Object.keys(leftFolders)).filter((k) => {
    const l = leftFolders[k];
    const r = rightFolders[k];
    return rightSet.has(k) && Array.isArray(l) && l.length && Array.isArray(r) && r.length;
  });
}

function buildAcceleratingGaps(transitionCount, startMs, mul, floorMs) {
  if (transitionCount <= 0) return [];
  const gaps = [];
  let g = Math.max(1, startMs);
  const floor = Math.max(1, floorMs);
  const m = mul > 0 && mul < 1 ? mul : 0.988;
  for (let i = 0; i < transitionCount; i++) {
    gaps.push(Math.max(floor, g));
    g *= m;
  }
  return gaps;
}

function scaleGapsToDuration(gaps, targetMs) {
  if (!gaps.length) return [];
  const sum = gaps.reduce((a, b) => a + b, 0);
  if (sum <= 0) return gaps.slice();
  const scale = targetMs / sum;
  return gaps.map((g) => g * scale);
}

function folderPhaseTimingEqual(leftCount, rightCount, msPerLongImage, holdFinalMs) {
  const L = Math.max(0, leftCount | 0);
  const R = Math.max(0, rightCount | 0);
  if (!L || !R) return null;
  const ms = Math.max(1, msPerLongImage | 0);
  const activeMs = Math.max(L, R) * ms;
  const hold = Math.max(0, holdFinalMs | 0);
  return {
    mode: 'equal',
    activeMs,
    holdFinalMs: hold,
    durationMs: activeMs + hold,
    leftIntervalMs: activeMs / L,
    rightIntervalMs: activeMs / R,
    leftCount: L,
    rightCount: R,
  };
}

function folderPhaseTimingAccelerating(leftCount, rightCount, opts) {
  const L = Math.max(0, leftCount | 0);
  const R = Math.max(0, rightCount | 0);
  if (!L || !R) return null;
  const startMs = Math.max(1, opts.startGapMs ?? 1000);
  const mul = opts.gapMul ?? 0.988;
  const floorMs = Math.max(1, opts.gapFloorMs ?? 580);
  const hold = Math.max(0, opts.holdFinalMs ?? 0);

  const rawLeft = buildAcceleratingGaps(L - 1, startMs, mul, floorMs);
  const rawRight = buildAcceleratingGaps(R - 1, startMs, mul, floorMs);
  const sumLeft = rawLeft.reduce((a, b) => a + b, 0);
  const sumRight = rawRight.reduce((a, b) => a + b, 0);
  const activeMs = Math.max(sumLeft, sumRight, 0);

  return {
    mode: 'accelerating',
    activeMs,
    holdFinalMs: hold,
    durationMs: activeMs + hold,
    leftGaps: scaleGapsToDuration(rawLeft, activeMs),
    rightGaps: scaleGapsToDuration(rawRight, activeMs),
    leftCount: L,
    rightCount: R,
    startGapMs: startMs,
    gapFloorMs: floorMs,
  };
}

function resolveFolderPhaseTiming(leftCount, rightCount, phaseOpts) {
  const opts = phaseOpts || { mode: 'equal', msPerLongImage: 1000, holdFinalMs: 0 };
  if (opts.mode === 'accelerating') {
    return folderPhaseTimingAccelerating(leftCount, rightCount, opts);
  }
  return folderPhaseTimingEqual(leftCount, rightCount, opts.msPerLongImage ?? 1000, opts.holdFinalMs ?? 0);
}

function scheduleSideChain(urls, gaps, onImage, timers, stoppedRef) {
  onImage?.(urls[0], 0, { animate: false });
  let gapIdx = 0;

  function step() {
    if (stoppedRef.stopped || gapIdx >= gaps.length) return;
    const delay = gaps[gapIdx];
    const imageIdx = gapIdx + 1;
    const timer = window.setTimeout(() => {
      if (stoppedRef.stopped) return;
      onImage?.(urls[imageIdx], imageIdx, { animate: true });
      gapIdx += 1;
      step();
    }, delay);
    timers.push(timer);
  }

  step();
}

function createFolderSyncPlayback(opts) {
  const leftFolders = opts.leftFolders || {};
  const rightFolders = opts.rightFolders || {};
  const getPhaseOptions =
    typeof opts.getPhaseOptions === 'function'
      ? opts.getPhaseOptions
      : () => ({ mode: 'equal', msPerLongImage: opts.msPerLongImage ?? 1000, holdFinalMs: 0 });

  let folderKeys = pairedFolderKeys(leftFolders, rightFolders);
  let folderIdx = 0;
  let phaseTimer = null;
  let sideTimers = [];
  let stopped = true;
  let currentKey = null;
  const stoppedRef = { stopped: true };

  function clearTimers() {
    for (const t of sideTimers) window.clearTimeout(t);
    sideTimers = [];
    if (phaseTimer !== null) window.clearTimeout(phaseTimer);
    phaseTimer = null;
  }

  function stop() {
    stopped = true;
    stoppedRef.stopped = true;
    clearTimers();
  }

  function runPhase() {
    if (stopped || !folderKeys.length) return;
    clearTimers();
    stoppedRef.stopped = false;

    const key = folderKeys[folderIdx % folderKeys.length];
    const leftUrls = leftFolders[key];
    const rightUrls = rightFolders[key];
    const timing = resolveFolderPhaseTiming(leftUrls.length, rightUrls.length, getPhaseOptions());
    if (!timing) {
      folderIdx += 1;
      runPhase();
      return;
    }

    currentKey = key;

    opts.onFolderStart?.({
      key,
      folderIndex: folderIdx,
      folderCount: folderKeys.length,
      timing,
      leftUrls,
      rightUrls,
    });

    if (timing.mode === 'equal') {
      opts.onLeftImage?.(leftUrls[0], 0, leftUrls, { animate: false });
      opts.onRightImage?.(rightUrls[0], 0, rightUrls, { animate: false });

      let leftIdx = 0;
      let rightIdx = 0;

      function bumpLeft() {
        if (stoppedRef.stopped) return;
        leftIdx += 1;
        if (leftIdx >= leftUrls.length) return;
        opts.onLeftImage?.(leftUrls[leftIdx], leftIdx, leftUrls, { animate: true });
        sideTimers.push(window.setTimeout(bumpLeft, timing.leftIntervalMs));
      }

      function bumpRight() {
        if (stoppedRef.stopped) return;
        rightIdx += 1;
        if (rightIdx >= rightUrls.length) return;
        opts.onRightImage?.(rightUrls[rightIdx], rightIdx, rightUrls, { animate: true });
        sideTimers.push(window.setTimeout(bumpRight, timing.rightIntervalMs));
      }

      if (leftUrls.length > 1) {
        sideTimers.push(window.setTimeout(bumpLeft, timing.leftIntervalMs));
      }
      if (rightUrls.length > 1) {
        sideTimers.push(window.setTimeout(bumpRight, timing.rightIntervalMs));
      }
    } else {
      scheduleSideChain(
        leftUrls,
        timing.leftGaps,
        (url, idx, meta) => opts.onLeftImage?.(url, idx, leftUrls, meta),
        sideTimers,
        stoppedRef,
      );
      scheduleSideChain(
        rightUrls,
        timing.rightGaps,
        (url, idx, meta) => opts.onRightImage?.(url, idx, rightUrls, meta),
        sideTimers,
        stoppedRef,
      );
    }

    phaseTimer = window.setTimeout(() => {
      opts.onFolderEnd?.({ key, timing });
      folderIdx += 1;
      if (folderIdx >= folderKeys.length) {
        folderIdx = 0;
        opts.onCycleEnd?.();
      }
      runPhase();
    }, timing.durationMs);
  }

  function start() {
    stopped = false;
    stoppedRef.stopped = false;
    folderIdx = 0;
    runPhase();
  }

  function restartFromCurrentFolder() {
    if (stopped) return;
    runPhase();
  }

  function refreshFolderKeys() {
    folderKeys = pairedFolderKeys(leftFolders, rightFolders);
  }

  return {
    start,
    stop,
    restartFromCurrentFolder,
    refreshFolderKeys,
    get folderKeys() {
      return folderKeys.slice();
    },
    get currentKey() {
      return currentKey;
    },
  };
}

function flattenExhibitFolders(folderMap) {
  const out = [];
  for (const k of sortExhibitFolderKeys(Object.keys(folderMap || {}))) {
    const arr = folderMap[k];
    if (Array.isArray(arr)) out.push(...arr.filter(Boolean));
  }
  return out;
}
