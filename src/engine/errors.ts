export const ERROR_MESSAGES = {
  "unsupported-input": "This file isn't an image format Convert can read.",
  corrupt: "This file looks damaged, so it couldn't be read.",
  "decode-unsupported": "This browser can't open this kind of image yet.",
  "encode-unsupported": "This browser can't save to this format yet.",
  "too-large": "This image is too large for this browser to convert.",
  cancelled: "The conversion was cancelled.",
  failed: "Something went wrong converting this file.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class ConvertError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ConvertError";
    this.code = code;
  }
}

export function errorCode(error: unknown): ErrorCode {
  return error instanceof ConvertError ? error.code : "failed";
}
