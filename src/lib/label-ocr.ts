import { marksFromLabel } from "@/lib/label-text";

export type LabelRead = {
  text: string;
  ms: number;
  licence: string | null;
  isNumber: string | null;
};

/** Browser-only. Reads a product-label photo with Tesseract. Does not invent a number. */
export async function readProductLabel(
  dataUrl: string,
  onProgress?: (ratio: number) => void,
): Promise<LabelRead> {
  const started = performance.now();
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text" && typeof message.progress === "number") {
        onProgress?.(message.progress);
      }
    },
  });
  try {
    const out = await worker.recognize(dataUrl);
    const text = (out.data.text || "").replace(/\s+/g, " ").trim().slice(0, 500);
    return { text, ms: Math.round(performance.now() - started), ...marksFromLabel(text) };
  } finally {
    await worker.terminate();
  }
}
