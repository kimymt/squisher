// Squisher Spike — Phase 0 feasibility verification
// Reference: PLAN.md "Phase 0: Spike PR" + DESIGN.md

type TestId = '1' | '2' | '3' | '4' | '5';

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`element not found: ${sel}`);
  return el;
};

const $$ = <T extends Element>(sel: string): T[] =>
  Array.from(document.querySelectorAll<T>(sel));

const logArea = $<HTMLPreElement>('#logOutput');
const envInfo = $<HTMLPreElement>('#envInfo');

const log = (...args: unknown[]): void => {
  const line = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2)))
    .join(' ');
  const ts = new Date().toISOString().slice(11, 19);
  logArea.textContent = `[${ts}] ${line}\n${logArea.textContent}`;
  console.log('[spike]', ...args);
};

const setResult = (id: TestId, status: 'ok' | 'fail' | 'na' | 'pending', message: string): void => {
  const el = document.querySelector<HTMLDivElement>(`[data-result="${id}"]`);
  if (!el) return;
  el.dataset.status = status;
  el.textContent = message;
};

// Environment info
const renderEnvInfo = (): void => {
  const info = {
    userAgent: navigator.userAgent,
    standalone: 'standalone' in navigator ? (navigator as { standalone?: boolean }).standalone : 'unknown',
    canShare: typeof navigator.canShare === 'function',
    share: typeof navigator.share === 'function',
    createImageBitmap: typeof createImageBitmap === 'function',
    devicePixelRatio: window.devicePixelRatio,
    screen: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
  envInfo.textContent = JSON.stringify(info, null, 2);
};

// Shared: keep last selected file for Test 5
let lastFileForShare: File | null = null;

// Test 1: HEIC → <img> → Canvas → JPEG
const runTest1 = async (file: File): Promise<void> => {
  setResult('1', 'pending', `処理中: ${file.name} (${formatBytes(file.size)})`);
  log(`Test 1: starting with ${file.name}, type=${file.type}, size=${file.size}`);

  const url = URL.createObjectURL(file);
  const img = new Image();

  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`img.onerror: ${String(e)}`));
  });

  img.src = url;

  try {
    await loaded;
    log(`Test 1: img loaded ${img.naturalWidth}x${img.naturalHeight}`);

    const canvas = document.querySelector<HTMLCanvasElement>('[data-canvas="1"]')!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context not available');

    const drawStart = performance.now();
    ctx.drawImage(img, 0, 0);
    const drawMs = performance.now() - drawStart;

    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });

    if (!jpeg) throw new Error('toBlob returned null');

    setResult(
      '1',
      'ok',
      `✅ 成功: ${img.naturalWidth}×${img.naturalHeight}, JPEG ${formatBytes(jpeg.size)} (元: ${formatBytes(file.size)}, draw: ${drawMs.toFixed(1)}ms)`
    );
    log(`Test 1: JPEG ${jpeg.size} bytes, ratio ${((jpeg.size / file.size) * 100).toFixed(1)}%`);
  } catch (err) {
    setResult('1', 'fail', `❌ 失敗: ${(err as Error).message}`);
    log(`Test 1: error`, err);
  } finally {
    URL.revokeObjectURL(url);
  }
};

// Test 2: HEIC × createImageBitmap (expected to fail on WebKit)
const runTest2 = async (file: File): Promise<void> => {
  setResult('2', 'pending', `処理中: ${file.name}`);
  log(`Test 2: createImageBitmap on ${file.name}`);

  if (typeof createImageBitmap !== 'function') {
    setResult('2', 'na', '⚠️ createImageBitmap 未対応のブラウザ');
    return;
  }

  try {
    const bitmap = await createImageBitmap(file);
    setResult(
      '2',
      'ok',
      `⚠️ 想定外に成功: ${bitmap.width}×${bitmap.height}(WebKit が HEIC を ImageBitmap 化できた = メモリ戦略変更不要)`
    );
    log(`Test 2: bitmap ${bitmap.width}x${bitmap.height}`);
    bitmap.close();
  } catch (err) {
    const msg = (err as Error).message || String(err);
    setResult(
      '2',
      'ok',
      `✅ 期待通り失敗: ${msg}(HEIC は HTMLImageElement 経由必須が確認できた)`
    );
    log(`Test 2: failed as expected`, err);
  }
};

// Test 3: Canvas 16Mピクセル制限
const runTest3 = async (file: File): Promise<void> => {
  setResult('3', 'pending', `処理中: ${file.name} (${formatBytes(file.size)})`);
  log(`Test 3: large image canvas test on ${file.name}`);

  const url = URL.createObjectURL(file);
  const img = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('img load failed'));
      img.src = url;
    });

    const pixels = img.naturalWidth * img.naturalHeight;
    log(`Test 3: source ${img.naturalWidth}x${img.naturalHeight} = ${pixels.toLocaleString()} px`);

    const canvas = document.querySelector<HTMLCanvasElement>('[data-canvas="3"]')!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context not available');

    const drawStart = performance.now();
    ctx.drawImage(img, 0, 0);
    const drawMs = performance.now() - drawStart;

    // Sample center pixel to verify drawImage actually wrote data
    const center = ctx.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1);
    const [r, g, b, a] = center.data;
    const hasData = !(r === 0 && g === 0 && b === 0 && a === 0);

    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });

    if (hasData && jpeg) {
      setResult(
        '3',
        'ok',
        `✅ 成功: ${img.naturalWidth}×${img.naturalHeight} (${(pixels / 1_000_000).toFixed(1)}Mpx) draw ${drawMs.toFixed(1)}ms, JPEG ${formatBytes(jpeg.size)}, 中央pixel rgba(${r},${g},${b},${a})`
      );
    } else {
      setResult(
        '3',
        'fail',
        `❌ Canvas 制限超過か: ${img.naturalWidth}×${img.naturalHeight} (${(pixels / 1_000_000).toFixed(1)}Mpx), drawImage は完了したが中央pixelが空 rgba(${r},${g},${b},${a}), JPEG ${jpeg ? 'あり' : 'null'} — 事前リサイズ必須`
      );
    }
    log(`Test 3: hasData=${hasData}, jpeg=${jpeg?.size ?? 'null'}, draw=${drawMs.toFixed(1)}ms`);
  } catch (err) {
    setResult('3', 'fail', `❌ 失敗: ${(err as Error).message}`);
    log(`Test 3: error`, err);
  } finally {
    URL.revokeObjectURL(url);
  }
};

// Test 4: navigator.canShare({ files })
const runTest4 = async (file: File): Promise<void> => {
  setResult('4', 'pending', `判定中: ${file.name}`);
  log(`Test 4: canShare check`);

  if (typeof navigator.canShare !== 'function') {
    setResult('4', 'na', '⚠️ navigator.canShare 未対応(Web Share API レベル 2 不可)');
    return;
  }

  try {
    const canFiles = navigator.canShare({ files: [file] });
    const canFilesPlusText = navigator.canShare({
      files: [file],
      title: 'test',
      text: 'test',
    });

    setResult(
      '4',
      canFiles ? 'ok' : 'fail',
      `${canFiles ? '✅' : '❌'} canShare({files}) = ${canFiles}, canShare({files, title, text}) = ${canFilesPlusText}`
    );
    log(`Test 4: files only=${canFiles}, with title/text=${canFilesPlusText}`);

    if (canFiles) {
      lastFileForShare = file;
      const btn = $<HTMLButtonElement>('#runShareTest');
      btn.disabled = false;
      setResult('5', 'pending', `準備完了: ${file.name} で共有可能`);
    }
  } catch (err) {
    setResult('4', 'fail', `❌ canShare エラー: ${(err as Error).message}`);
    log(`Test 4: error`, err);
  }
};

// Test 5: navigator.share({ files })
const runTest5 = async (): Promise<void> => {
  if (!lastFileForShare) {
    setResult('5', 'fail', '❌ Test 4 で共有可能なファイルを準備してください');
    return;
  }

  if (typeof navigator.share !== 'function') {
    setResult('5', 'na', '⚠️ navigator.share 未対応');
    return;
  }

  log(`Test 5: share({files}) starting`);

  try {
    await navigator.share({ files: [lastFileForShare] });
    setResult('5', 'ok', `✅ share 成功 — 共有シートが起動した(「写真に保存」も含まれていたか確認)`);
    log(`Test 5: share success`);
  } catch (err) {
    const msg = (err as Error).message;
    if ((err as DOMException).name === 'AbortError') {
      setResult('5', 'ok', `✅ ユーザーがキャンセル(エラーハンドリング OK): ${msg}`);
    } else {
      setResult('5', 'fail', `❌ share 失敗: ${msg}`);
    }
    log(`Test 5: error`, err);
  }
};

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

// Wire up
const setupHandlers = (): void => {
  renderEnvInfo();

  $$<HTMLInputElement>('input[type="file"][data-test]').forEach((input) => {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const test = input.dataset.test as TestId;
      switch (test) {
        case '1':
          void runTest1(file);
          break;
        case '2':
          void runTest2(file);
          break;
        case '3':
          void runTest3(file);
          break;
        case '4':
          void runTest4(file);
          break;
      }
    });
  });

  $<HTMLButtonElement>('#runShareTest').addEventListener('click', () => {
    void runTest5();
  });

  log('Squisher Spike ready.');
};

setupHandlers();
