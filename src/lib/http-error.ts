export type HttpError = Error & { statusCode: number };

export function httpError(statusCode: number, message: string): HttpError {
  return Object.assign(new Error(message), { statusCode });
}

export function unauthorized(message = "Unauthorized"): HttpError {
  return httpError(401, message);
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  );
}

export function isUnauthorizedError(error: unknown): boolean {
  if (isHttpError(error) && error.statusCode === 401) return true;
  return error instanceof Error && error.message.startsWith("Unauthorized");
}
