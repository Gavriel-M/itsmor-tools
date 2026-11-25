import { readDimensions, type Dimensions } from "./dimensions";
import { ConvertError } from "./errors";
import type { InputFormat } from "./formats";
import { sniffFormat } from "./sniff";

const HEADER_BYTES = 256 * 1024;

export interface Inspection extends Dimensions {
  format: InputFormat;
}

export async function inspect(file: Blob): Promise<Inspection> {
  const header = new Uint8Array(
    await file.slice(0, HEADER_BYTES).arrayBuffer()
  );
  const format = sniffFormat(header);
  if (!format) throw new ConvertError("unsupported-input");

  const dimensions =
    readDimensions(header, format) ??
    (file.size > header.length
      ? readDimensions(new Uint8Array(await file.arrayBuffer()), format)
      : null);
  if (!dimensions) throw new ConvertError("corrupt");
  return { format, ...dimensions };
}
