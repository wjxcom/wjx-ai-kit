export function toolResult(data: unknown, isError: boolean) {
  let text: string;
  try {
    text = JSON.stringify(data, null, 2);
  } catch {
    text = String(data);
  }
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

export function toolError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return toolResult({ result: false, errormsg: msg }, true);
}
