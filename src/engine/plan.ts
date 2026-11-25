import type { Capabilities } from "./capabilities";
import { findDecoder, findEncoder, type CodecPath } from "./codecs/registry";
import type { Dimensions } from "./dimensions";
import type { ErrorCode } from "./errors";
import { EXTENSIONS, type InputFormat, type OutputFormat } from "./formats";

export interface Path {
  decode: CodecPath;
  encode: CodecPath;
}

export type Plan = { path: Path } | { error: ErrorCode };

interface PathInput {
  format: InputFormat;
  target: OutputFormat;
  pixels: number;
}

export function fitWithin(
  width: number,
  height: number,
  maxDimension?: number
): Dimensions {
  const scale =
    maxDimension && maxDimension > 0
      ? Math.min(1, maxDimension / Math.max(width, height))
      : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function outputNames(
  inputNames: readonly string[],
  target: OutputFormat
): string[] {
  const taken = new Set<string>();
  return inputNames.map((name) => {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    for (let copy = 1; ; copy++) {
      const suffix = copy === 1 ? "" : ` (${copy})`;
      const candidate = `${stem}${suffix}.${EXTENSIONS[target]}`;
      if (!taken.has(candidate.toLowerCase())) {
        taken.add(candidate.toLowerCase());
        return candidate;
      }
    }
  });
}

export function choosePath(
  { format, target, pixels }: PathInput,
  capabilities: Capabilities
): Path {
  if (pixels > capabilities.maxPixels)
    return { decode: "wasm", encode: "wasm" };
  return {
    decode: capabilities.decode[format] === false ? "wasm" : "native",
    encode:
      target === "jpeg" || !capabilities.encode[target] ? "wasm" : "native",
  };
}

export function planJob(input: PathInput, capabilities: Capabilities): Plan {
  const path = choosePath(input, capabilities);
  const oversized = input.pixels > capabilities.maxPixels;
  if (!findDecoder(input.format, path.decode)) {
    return { error: oversized ? "too-large" : "decode-unsupported" };
  }
  if (!findEncoder(input.target, path.encode)) {
    return { error: oversized ? "too-large" : "encode-unsupported" };
  }
  return { path };
}
