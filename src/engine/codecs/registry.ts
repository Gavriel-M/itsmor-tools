import { INPUT_FORMATS, type InputFormat, type OutputFormat } from "../formats";

export type CodecPath = "native" | "wasm";

export const DECODERS = [
  { id: "native", path: "native", formats: INPUT_FORMATS },
] as const;

export const ENCODERS = [
  { id: "canvas", path: "native", formats: ["png", "webp"] },
  { id: "mozjpeg", path: "wasm", formats: ["jpeg"] },
] as const;

export type Decoder = (typeof DECODERS)[number];
export type Encoder = (typeof ENCODERS)[number];
export type EncoderId<P extends CodecPath> = Extract<
  Encoder,
  { path: P }
>["id"];

export function findDecoder(format: InputFormat, path: CodecPath) {
  return DECODERS.find(
    (d: Decoder) =>
      d.path === path && (d.formats as readonly InputFormat[]).includes(format)
  );
}

export function findEncoder(target: OutputFormat, path: CodecPath) {
  return ENCODERS.find(
    (e: Encoder) =>
      e.path === path && (e.formats as readonly OutputFormat[]).includes(target)
  );
}
