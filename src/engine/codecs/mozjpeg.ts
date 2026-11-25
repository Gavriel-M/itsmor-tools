import encode from "@jsquash/jpeg/encode";

export async function encodeMozjpeg(pixels: ImageData, quality: number) {
  const jpeg = await encode(pixels, { quality: Math.round(quality * 100) });
  return new Blob([jpeg], { type: "image/jpeg" });
}
