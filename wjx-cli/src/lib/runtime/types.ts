export interface InputContext {
  values: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  source?: Record<string, string>;
}

export interface NormalizedInput {
  values: Record<string, unknown>;
  source: Record<string, string>;
  unknown: string[];
}

export interface RequestPlan {
  service: string;
  action: string;
  method: "POST";
  url: string;
  headers: Record<string, string>;
  body: string;
  unresolved?: string[];
}

export interface RuntimePrepareContext {
  command: string;
  values: Record<string, unknown>;
  source: Record<string, string>;
}

