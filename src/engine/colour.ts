const P3_TO_SRGB = [
  [1.2249401, -0.2249404, 0],
  [-0.0420569, 1.0420571, 0],
  [-0.0196376, -0.0786361, 1.0982735],
] as const;

const ENCODE_STEPS = 4096;

const toLinear = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

const toEncoded = Uint8ClampedArray.from(
  { length: ENCODE_STEPS + 1 },
  (_, i) => {
    const c = i / ENCODE_STEPS;
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  }
);

function encode(linear: number) {
  return toEncoded[Math.round(Math.min(1, Math.max(0, linear)) * ENCODE_STEPS)];
}

export function displayP3ToSrgb(pixels: Uint8ClampedArray) {
  const [[rr, rg], [gr, gg], [br, bg, bb]] = P3_TO_SRGB;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = toLinear[pixels[i]];
    const g = toLinear[pixels[i + 1]];
    const b = toLinear[pixels[i + 2]];
    pixels[i] = encode(rr * r + rg * g);
    pixels[i + 1] = encode(gr * r + gg * g);
    pixels[i + 2] = encode(br * r + bg * g + bb * b);
  }
}
