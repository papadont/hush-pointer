import html2canvas from "html2canvas";

type ScreenshotRenderOptions = {
  backgroundColor?: string | null;
};

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

async function renderViaSvg(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const clone = node.cloneNode(true) as HTMLElement;
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
  return canvas.toDataURL("image/png");
}

export async function elementToPngDataUrl(
  node: HTMLElement,
  options: ScreenshotRenderOptions = {}
) {
  const scale = Math.max(2, window.devicePixelRatio || 1);
  const backgroundColor = options.backgroundColor ?? null;
  try {
    const canvas = await html2canvas(node, {
      backgroundColor,
      scale,
      useCORS: true,
      logging: false,
      foreignObjectRendering: false
    });
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
      return canvas.toDataURL("image/png");
    } catch (secondError) {
      try {
        return await renderViaSvg(node);
      } catch (thirdError) {
        const first = firstError instanceof Error ? firstError.message : String(firstError);
        const second = secondError instanceof Error ? secondError.message : String(secondError);
        const third = thirdError instanceof Error ? thirdError.message : String(thirdError);
        throw new Error(`html2canvas failed: ${first} / foreignObject failed: ${second} / svg fallback failed: ${third}`);
      }
    }
  }
}
