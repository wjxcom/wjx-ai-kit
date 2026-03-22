export function toolResult(data: unknown, isError: boolean) {
  let text: string;
  try {
    const json = JSON.stringify(data);
    text = json ?? String(data);
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
