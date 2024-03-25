export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  } else if (typeof error === 'string') {
    return new Error(error);
  } else if (error && typeof error.toString === 'function') {
    return new Error(error.toString());
  } else {
    return new Error('An unknown error occurred');
  }
}
