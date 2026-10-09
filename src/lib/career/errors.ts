import { ZodError } from "zod";
export class CareerError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
export function publicError(error: unknown) {
  if (error instanceof CareerError)
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  if (error instanceof ZodError)
    return {
      code: "INVALID_INPUT",
      message: error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("；"),
      retryable: false,
    };
  return {
    code: "INTERNAL_ERROR",
    message: "操作未完成，请刷新后重试。",
    retryable: true,
  };
}
