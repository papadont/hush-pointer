import html2canvas from "html2canvas";

type ScreenshotRenderOptions = {
  backgroundColor?: string | null;
  mode?: "auto" | "svg-first" | "svg-only";
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

function copyCustomProperties(source: HTMLElement, target: HTMLElement) {
  const computed = window.getComputedStyle(source);
  for (const name of Array.from(computed)) {
    if (!name.startsWith("--")) continue;
    const value = computed.getPropertyValue(name);
    if (!value) continue;
    target.style.setProperty(name, value);
  }
}

async function renderViaSvg(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const clone = node.cloneNode(true) as HTMLElement;
  copyCustomProperties(node, clone);
  const cssText = readCssText();
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
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
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(image, 0, 0);
  return canvas;
}

export async function elementToPngDataUrl(
  node: HTMLElement,
  options: ScreenshotRenderOptions = {}
) {
  const scale = Math.max(2, window.devicePixelRatio || 1);
  const backgroundColor = options.backgroundColor ?? null;
  const mode = options.mode ?? "auto";
  if (mode === "svg-only") {
    const canvas = await renderViaSvg(node);
    if (isBlankishCapture(canvas)) {
      throw new Error("blank-ish capture on svg renderer");
    }
    return canvas.toDataURL("image/png");
  }
  if (mode === "svg-first") {
    try {
      const canvas = await renderViaSvg(node);
      if (isBlankishCapture(canvas)) {
        throw new Error("blank-ish capture on svg renderer");
      }
      return canvas.toDataURL("image/png");
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
    return canvas.toDataURL("image/png");
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
      return canvas.toDataURL("image/png");
    } catch (secondError) {
      try {
        const canvas = await renderViaSvg(node);
        if (isBlankishCapture(canvas)) {
          throw new Error("blank-ish capture on svg renderer");
        }
        return canvas.toDataURL("image/png");
      } catch (thirdError) {
        const first = firstError instanceof Error ? firstError.message : String(firstError);
        const second = secondError instanceof Error ? secondError.message : String(secondError);
        const third = thirdError instanceof Error ? thirdError.message : String(thirdError);
        throw new Error(`html2canvas failed: ${first} / foreignObject failed: ${second} / svg fallback failed: ${third}`);
      }
    }
  }
}
