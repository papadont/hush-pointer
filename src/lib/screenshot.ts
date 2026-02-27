/**
 * ============================================================
 * Hush Pointer: File Header
 * ============================================================
 * @file screenshot.ts
 * @module hush-pointer/screenshot
 * @summary DOM要素のスクショ生成とフォント埋め込み補助
 *
 * @responsibilities
 * - html2canvasベースの画像化を提供する
 * - SVG/フォント周りの失敗時フォールバックを扱う
 *
 * @invariants
 * - 出力はPNG data URL形式で返す
 *
 * @sideEffects
 * - DOM cloning/render
 * - Font fetch for inline replacement
 *
 * @dependencies
 * - html2canvas
 *
 * @updated 2026-02-27
 * @changelog ヘッダコメントを追加
 * ============================================================
 */
import html2canvas from "html2canvas";

type ScreenshotRenderOptions = {
  backgroundColor?: string | null;
  mode?: "auto" | "svg-first" | "svg-only";
  scale?: number;
  exportScale?: number;
};

type InlineFontReport = {
  fontFaceBlockCount: number;
  discoveredUrlCount: number;
  fetchSuccessCount: number;
  fetchFailureCount: number;
  replacementCount: number;
};

function isBlankishCapture(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { width, height } = canvas;
  if (width < 2 || height < 2) return false;
  const marginX = Math.floor(width * 0.08);
  const marginY = Math.floor(height * 0.08);
  const left = Math.min(width - 1, Math.max(0, marginX));
  const top = Math.min(height - 1, Math.max(0, marginY));
  const right = Math.max(left + 1, Math.min(width, width - marginX));
  const bottom = Math.max(top + 1, Math.min(height, height - marginY));
  const w = right - left;
  const h = bottom - top;
  const { data } = ctx.getImageData(left, top, w, h);
  const step = Math.max(1, Math.floor(Math.max(w, h) / 220));
  let minLum = 255;
  let maxLum = 0;
  let edgeCount = 0;
  let edgeSamples = 0;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;

      if (x + step < w) {
        const ri = (y * w + (x + step)) * 4;
        const r2 = data[ri] ?? 0;
        const g2 = data[ri + 1] ?? 0;
        const b2 = data[ri + 2] ?? 0;
        const lum2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
        edgeSamples++;
        if (Math.abs(lum - lum2) > 14) edgeCount++;
      }
      if (y + step < h) {
        const bi = ((y + step) * w + x) * 4;
        const r3 = data[bi] ?? 0;
        const g3 = data[bi + 1] ?? 0;
        const b3 = data[bi + 2] ?? 0;
        const lum3 = 0.2126 * r3 + 0.7152 * g3 + 0.0722 * b3;
        edgeSamples++;
        if (Math.abs(lum - lum3) > 14) edgeCount++;
      }
    }
  }

  const luminanceRange = maxLum - minLum;
  const edgeRatio = edgeSamples > 0 ? edgeCount / edgeSamples : 0;
  return luminanceRange < 18 && edgeRatio < 0.02;
}

function readCssText() {
  let cssText = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = (sheet as CSSStyleSheet).cssRules;
      for (const rule of Array.from(rules)) cssText += `${rule.cssText}\n`;
    } catch {
      // ignore inaccessible stylesheets
    }
  }
  return cssText;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

async function inlineFonts(cssText: string): Promise<string> {
  const report: InlineFontReport = {
    fontFaceBlockCount: 0,
    discoveredUrlCount: 0,
    fetchSuccessCount: 0,
    fetchFailureCount: 0,
    replacementCount: 0
  };
  const fontFaceBlocks = cssText.match(/@font-face\s*\{[\s\S]*?\}/g) ?? [];
  report.fontFaceBlockCount = fontFaceBlocks.length;
  if (!fontFaceBlocks.length) {
    (window as any).__hpLastInlineFontReport = report;
    return cssText;
  }

  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  const replacements = new Map<string, string>();
  const targets = new Map<string, string>(); // rawUrl -> absoluteUrl

  for (const block of fontFaceBlocks) {
    urlPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = urlPattern.exec(block)) !== null) {
      const rawUrl = (match[2] || "").trim();
      if (!rawUrl || rawUrl.startsWith("data:")) continue;
      try {
        const absoluteUrl = new URL(rawUrl, document.baseURI).href;
        targets.set(rawUrl, absoluteUrl);
      } catch {
        // ignore malformed url
      }
    }
  }
  report.discoveredUrlCount = targets.size;

  if (!targets.size) {
    (window as any).__hpLastInlineFontReport = report;
    return cssText;
  }

  await Promise.all(
    Array.from(targets.entries()).map(async ([rawUrl, absoluteUrl]) => {
      try {
        const res = await fetch(absoluteUrl);
        if (!res.ok) {
          report.fetchFailureCount += 1;
          return;
        }
        const dataUrl = await blobToDataUrl(await res.blob());
        if (!dataUrl) {
          report.fetchFailureCount += 1;
          return;
        }
        replacements.set(rawUrl, dataUrl);
        replacements.set(absoluteUrl, dataUrl);
        report.fetchSuccessCount += 1;
      } catch {
        // keep original font url on failure
        report.fetchFailureCount += 1;
      }
    })
  );

  if (!replacements.size) {
    (window as any).__hpLastInlineFontReport = report;
    return cssText;
  }

  const replacedCss = cssText.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
    (full, _quote, url) => {
      const key = String(url || "").trim();
      const dataUrl = replacements.get(key);
      if (dataUrl) report.replacementCount += 1;
      return dataUrl ? `url("${dataUrl}")` : full;
    }
  );
  (window as any).__hpLastInlineFontReport = report;
  return replacedCss;
}

function copyCustomProperties(source: HTMLElement, target: HTMLElement) {
  const computed = window.getComputedStyle(source);
  for (const name of Array.from(computed)) {
    if (!name.startsWith("--")) continue;
    const value = computed.getPropertyValue(name);
    if (!value) continue;
    target.style.setProperty(name, value);
  }
}

function copyComputedTypography(source: HTMLElement, target: HTMLElement) {
  const computed = window.getComputedStyle(source);
  const props = [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-stretch",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-transform",
    "text-rendering",
    "-webkit-font-smoothing"
  ];
  for (const prop of props) {
    const value = computed.getPropertyValue(prop);
    if (!value) continue;
    target.style.setProperty(prop, value);
  }
}

function escapeXmlAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function renderViaSvg(node: HTMLElement, scale = 1) {
  const width = Math.max(
    1,
    node.offsetWidth || Math.round(node.getBoundingClientRect().width)
  );
  const height = Math.max(
    1,
    node.offsetHeight || Math.round(node.getBoundingClientRect().height)
  );
  const pixelScale = Math.max(1, scale);
  const clone = node.cloneNode(true) as HTMLElement;
  copyCustomProperties(node, clone);
  copyComputedTypography(node, clone);
  let cssText = readCssText();
  cssText = await inlineFonts(cssText);
  try {
    console.info("[screenshot:inlineFonts]", (window as any).__hpLastInlineFontReport);
  } catch {
    // no-op
  }
  const serialized = new XMLSerializer().serializeToString(clone);
  const rootTypography = escapeXmlAttr(clone.getAttribute("style") ?? "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="${rootTypography}">
          <style><![CDATA[
${cssText}
          ]]></style>
          ${serialized}
        </div>
      </foreignObject>
    </svg>
  `;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * pixelScale));
  canvas.height = Math.max(1, Math.ceil(height * pixelScale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

function toPngDataUrlWithExportScale(canvas: HTMLCanvasElement, exportScale = 1) {
  const ratio = Math.max(0.1, Math.min(1, exportScale));
  if (ratio >= 0.999) return canvas.toDataURL("image/png");
  const width = Math.max(1, Math.round(canvas.width * ratio));
  const height = Math.max(1, Math.round(canvas.height * ratio));
  const resized = document.createElement("canvas");
  resized.width = width;
  resized.height = height;
  const ctx = resized.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, width, height);
  return resized.toDataURL("image/png");
}

export async function elementToPngDataUrl(
  node: HTMLElement,
  options: ScreenshotRenderOptions = {}
) {
  const scale = Math.max(2, (options.scale ?? window.devicePixelRatio) || 1);
  const exportScale = options.exportScale ?? 1;
  const backgroundColor = options.backgroundColor ?? null;
  const mode = options.mode ?? "auto";
  if (mode === "svg-only") {
    const canvas = await renderViaSvg(node, scale);
    if (isBlankishCapture(canvas)) {
      throw new Error("blank-ish capture on svg renderer");
    }
    return toPngDataUrlWithExportScale(canvas, exportScale);
  }
  if (mode === "svg-first") {
    try {
      const canvas = await renderViaSvg(node, scale);
      if (isBlankishCapture(canvas)) {
        throw new Error("blank-ish capture on svg renderer");
      }
      return toPngDataUrlWithExportScale(canvas, exportScale);
    } catch {
      // fallback to html2canvas flow
    }
  }
  try {
    const canvas = await html2canvas(node, {
      backgroundColor,
      scale,
      useCORS: true,
      logging: false,
      foreignObjectRendering: false
    });
    if (isBlankishCapture(canvas)) {
      throw new Error("blank-ish capture on html2canvas (foreignObjectRendering=false)");
    }
    return toPngDataUrlWithExportScale(canvas, exportScale);
  } catch (firstError) {
    try {
      const canvas = await html2canvas(node, {
        backgroundColor,
        scale,
        useCORS: true,
        logging: false,
        foreignObjectRendering: true
      });
      if (isBlankishCapture(canvas)) {
        throw new Error("blank-ish capture on html2canvas (foreignObjectRendering=true)");
      }
      return toPngDataUrlWithExportScale(canvas, exportScale);
    } catch (secondError) {
      try {
        const canvas = await renderViaSvg(node, scale);
        if (isBlankishCapture(canvas)) {
          throw new Error("blank-ish capture on svg renderer");
        }
        return toPngDataUrlWithExportScale(canvas, exportScale);
      } catch (thirdError) {
        const first = firstError instanceof Error ? firstError.message : String(firstError);
        const second = secondError instanceof Error ? secondError.message : String(secondError);
        const third = thirdError instanceof Error ? thirdError.message : String(thirdError);
        throw new Error(`html2canvas failed: ${first} / foreignObject failed: ${second} / svg fallback failed: ${third}`);
      }
    }
  }
}
