export function toolResult(data: unknown, isError: boolean) {
  let text: string;
  if (data === undefined) {
    text = isError ? '{"result":false,"errormsg":"no data"}' : "null";
  } else {
    try {
      text = JSON.stringify(data);
    } catch {
      text = String(data);
    }
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
