export type ExtractedImage = {
  mediaType: string;
  dataBase64: string;
  name: string;
};

export type ExtractResult = {
  attachmentsText: string;
  images: ExtractedImage[];
  warnings: string[];
};

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MAX_IMAGES = 4;
const MAX_TEXT_CHARS = 40_000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string): { mediaType: string; dataBase64: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid data URL");
  return { mediaType: match[1], dataBase64: match[2] };
}

async function extractPdf(file: File): Promise<{ text: string; pageImages: ExtractedImage[] }> {
  const pdfjs = await import("pdfjs-dist");
  // Use CDN worker to avoid bundling worker path issues in Astro islands
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const textParts: string[] = [];
  const pageImages: ExtractedImage[] = [];
  const maxPages = Math.min(doc.numPages, 8);

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) textParts.push(`--- Page ${pageNum} ---\n${pageText}`);
  }

  // If little text, render first pages as images for vision
  const combined = textParts.join("\n\n").trim();
  if (combined.length < 80) {
    const renderCount = Math.min(doc.numPages, 2);
    for (let pageNum = 1; pageNum <= renderCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      const { mediaType, dataBase64 } = dataUrlToBase64(dataUrl);
      pageImages.push({
        mediaType,
        dataBase64,
        name: `${file.name}-page-${pageNum}.png`,
      });
    }
  }

  return { text: combined, pageImages };
}

async function extractPptx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const parts: string[] = [];
  for (const path of slideFiles) {
    const xml = await zip.files[path].async("text");
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const slideText = texts.join(" ").replace(/\s+/g, " ").trim();
    if (slideText) {
      const num = path.match(/slide(\d+)/i)?.[1] ?? "?";
      parts.push(`--- Slide ${num} ---\n${slideText}`);
    }
  }
  return parts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.file("word/document.xml");
  if (!doc) return "";
  const xml = await doc.async("text");
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Client-side extraction so the Pages Function stays light.
 */
export async function extractFiles(files: File[]): Promise<ExtractResult> {
  const textBlocks: string[] = [];
  const images: ExtractedImage[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    const type = file.type || "";
    const lower = file.name.toLowerCase();

    try {
      if (IMAGE_TYPES.has(type) || /\.(png|jpe?g|gif|webp)$/i.test(lower)) {
        if (images.length >= MAX_IMAGES) {
          warnings.push(`Skipped image ${file.name} (max ${MAX_IMAGES} images).`);
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        const parsed = dataUrlToBase64(dataUrl);
        images.push({
          ...parsed,
          name: file.name,
        });
        continue;
      }

      if (type === "application/pdf" || lower.endsWith(".pdf")) {
        const { text, pageImages } = await extractPdf(file);
        if (text) textBlocks.push(`# ${file.name}\n${text}`);
        for (const img of pageImages) {
          if (images.length >= MAX_IMAGES) {
            warnings.push(`Skipped PDF page image from ${file.name} (max images).`);
            break;
          }
          images.push(img);
        }
        if (!text && pageImages.length === 0) {
          warnings.push(`Could not extract content from ${file.name}.`);
        }
        continue;
      }

      if (
        type.includes("presentation") ||
        lower.endsWith(".pptx")
      ) {
        const text = await extractPptx(file);
        if (text) textBlocks.push(`# ${file.name}\n${text}`);
        else warnings.push(`No text found in slides: ${file.name}`);
        continue;
      }

      if (
        type.includes("wordprocessingml") ||
        lower.endsWith(".docx")
      ) {
        const text = await extractDocx(file);
        if (text) textBlocks.push(`# ${file.name}\n${text}`);
        else warnings.push(`No text found in ${file.name}`);
        continue;
      }

      if (
        type.startsWith("text/") ||
        lower.endsWith(".txt") ||
        lower.endsWith(".md") ||
        lower.endsWith(".csv") ||
        lower.endsWith(".json")
      ) {
        const text = await file.text();
        textBlocks.push(`# ${file.name}\n${text}`);
        continue;
      }

      warnings.push(`Unsupported file type: ${file.name}`);
    } catch (err) {
      warnings.push(
        `Failed to read ${file.name}: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }

  let attachmentsText = textBlocks.join("\n\n").trim();
  if (attachmentsText.length > MAX_TEXT_CHARS) {
    attachmentsText = attachmentsText.slice(0, MAX_TEXT_CHARS);
    warnings.push("Attached text was truncated to fit size limits.");
  }

  return { attachmentsText, images, warnings };
}
