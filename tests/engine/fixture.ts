import { readFileSync } from "node:fs";

export function fixture(name: string) {
  return new Uint8Array(
    readFileSync(new URL(`../fixtures/${name}`, import.meta.url))
  );
}

export function sample(name: string) {
  return new Uint8Array(
    readFileSync(new URL(`../../src/engine/samples/${name}`, import.meta.url))
  );
}
