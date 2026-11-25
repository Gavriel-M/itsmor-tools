export function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function startsWith(bytes: Uint8Array, prefix: readonly number[]) {
  return prefix.every((byte, i) => bytes[i] === byte);
}

export function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
