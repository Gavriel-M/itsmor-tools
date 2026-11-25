import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const [input, output] = process.argv.slice(2);
const png = readFileSync(input).toString("base64");

const browser = await chromium.launch();
const page = await browser.newPage();
const webp = await page.evaluate(async (base64) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await globalThis.createImageBitmap(new Blob([bytes]));
  const canvas = new globalThis.OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
  return [...new Uint8Array(await blob.arrayBuffer())];
}, png);
await browser.close();

writeFileSync(output, Uint8Array.from(webp));
