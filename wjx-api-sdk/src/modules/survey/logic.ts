import type { SurveyDslJson } from "./types.js";

const MAX_LOGIC_BYTES = 4 * 1024 * 1024;

/** 仅校验模块边界；规则语义由服务端现有 DSL 解析器校验。 */
export function prepareSurveyDslJson(value: unknown): SurveyDslJson | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== 1 || !("logic" in value)
    || typeof value.logic !== "string") {
    throw new TypeError("dsl 必须是仅包含字符串 logic 的 JSON 对象");
  }
  const logic = value.logic.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (Buffer.byteLength(logic, "utf8") > MAX_LOGIC_BYTES) throw new TypeError("dsl.logic 超过 4 MiB 上限");
  if (!/^logic\s*\{/.test(logic)) throw new TypeError("dsl.logic 必须是 logic { ... }; 模块");
  let depth = 0, quote = false, escape = false, lineComment = false, blockComment = false;
  let end = -1;
  for (let i = logic.indexOf("{"); i < logic.length; i++) {
    const char = logic[i], next = logic[i + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') quote = false;
      continue;
    }
    if (char === '"') quote = true;
    else if (char === "/" && next === "/") { lineComment = true; i++; }
    else if (char === "#") lineComment = true;
    else if (char === "/" && next === "*") { blockComment = true; i++; }
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) { end = i; break; }
  }
  if (end < 0 || logic.slice(end + 1).trim() !== ";") {
    throw new TypeError("dsl.logic 必须包含一个完整的 logic { ... }; 模块，不能附带题目或完整 DSL 文档");
  }
  return { logic };
}

type LogicRule = readonly string[];
type DisplayState = { target: string; state: "visible" | "hidden" | "conditional" };

function stringToken(token: string | undefined): string | undefined {
  if (!token?.startsWith('"')) return undefined;
  try { const value: unknown = JSON.parse(token); return typeof value === "string" ? value : undefined; }
  catch { return undefined; }
}

/** Read complete statement boundaries without treating quoted text as DSL keywords. */
function logicRules(value: unknown): LogicRule[] | undefined {
  let logic: string;
  try { logic = prepareSurveyDslJson({ logic: value })!.logic; } catch { return undefined; }
  const body = logic.replace(/^logic\s*\{/, "").replace(/\}\s*;$/, "");
  const parts = body.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|[A-Za-z_][A-Za-z_\d]*|-?\d+|[^\s]/g) ?? [];
  const rules: LogicRule[] = [];
  let current: string[] = [];
  for (const token of parts) {
    if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#")) continue;
    if (token === "{" || token === "}" || (token.startsWith('"') && stringToken(token) === undefined)) return undefined;
    if (token === ";") { if (current.length) rules.push(current); current = []; }
    else current.push(token);
  }
  if (current.length || rules.some(rule => !validProjectionRule(rule))) return undefined;
  return rules;
}

function actionTokens(rule: LogicRule): LogicRule | undefined {
  if (rule[0] !== "if") return rule;
  const then = rule.indexOf("then");
  if (then < 2) return undefined;
  // Canonical XML projections contain quoted conditions, boolean operators,
  // and optional parentheses. Reject incomplete expressions conservatively.
  let operand = true, depth = 0;
  for (const token of rule.slice(1, then)) {
    if (operand && token === "not") continue;
    if (operand && token === "(") { depth++; continue; }
    if (operand && (stringToken(token) !== undefined || token === "always")) { operand = false; continue; }
    if (!operand && token === ")" && depth > 0) { depth--; continue; }
    if (!operand && (token === "and" || token === "or")) { operand = true; continue; }
    return undefined;
  }
  return operand || depth !== 0 ? undefined : rule.slice(then + 1);
}

function validProjectionRule(rule: LogicRule): boolean {
  const action = actionTokens(rule);
  if (!action?.length) return false;
  if (rule[0] === "if" && !["show", "hide", "jump", "branch"].includes(action[0])) return false;
  const quoted = '"(?:\\\\.|[^"\\\\])*"';
  const text = action.join(" ");
  if (action[0] === "show" || action[0] === "hide") {
    return (action.length === 2 || (action.length === 4 && action[2] === "raw" && stringToken(action[3]) !== undefined))
      && stringToken(action[1]) !== undefined;
  }
  if (action[0] === "raw") {
    return action.length === 2 && stringToken(action[1]) !== undefined
      || new RegExp(`^raw attr ${quoted}(?: question ${quoted}(?: item ${quoted})?)? = ${quoted}$`).test(text);
  }
  if (action[0] === "jump" || action[0] === "branch") {
    return new RegExp(`^(jump|branch) from ${quoted}(?: (option|item) ${quoted})? to ${quoted}(?: raw ${quoted})?$`).test(text);
  }
  if (action[0] === "reference") {
    return new RegExp(`^reference (options|title) from ${quoted} to ${quoted}(?: raw ${quoted})?$`).test(text);
  }
  if (action[0] === "random") {
    return new RegExp(`^random (options|rows|questions)(?: mode \\d+)?(?: on ${quoted})?(?: from ${quoted}(?: ~ ${quoted})?)?(?: count \\d+)?(?: weight ${quoted})?(?: raw ${quoted})?$`).test(text);
  }
  return false;
}

function questionDisplay(rule: LogicRule): DisplayState | undefined {
  const action = actionTokens(rule)!;
  if (action[0] === "show" || action[0] === "hide") {
    const target = stringToken(action[1])!;
    const state = rule[0] === "if" ? "conditional"
      : action[0] === "hide" && (action.length === 2 || stringToken(action[3]) === "-1") ? "hidden"
        : action[0] === "show" && (action.length === 2 || stringToken(action[3]) === "") ? "visible" : "conditional";
    return { target, state };
  }
  if (rule.length === 7 && rule[0] === "raw" && rule[1] === "attr"
    && stringToken(rule[2]) === "Relation" && rule[3] === "question" && rule[5] === "=") {
    const value = stringToken(rule[6]);
    return { target: stringToken(rule[4])!, state: value === "" ? "visible" : value === "-1" ? "hidden" : "conditional" };
  }
  return undefined;
}

/** 检查请求的规则是否出现在真实 XML 的完整投影中；其他已有规则允许保留。 */
export function surveyLogicMatches(expected: string, actual: unknown, questions?: readonly Record<string, unknown>[]): boolean {
  const expectedRules = logicRules(expected), actualRules = logicRules(actual);
  if (!expectedRules || !actualRules) return false;
  const savedRules = new Set(actualRules.map(rule => JSON.stringify(rule)));
  return expectedRules.every(rule => {
    if (rule.length !== 2 || (rule[0] !== "show" && rule[0] !== "hide")) return savedRules.has(JSON.stringify(rule));
    // An opaque raw statement has no reliable target or attribute boundary.
    // It cannot prove that native Relation was cleared or remains hidden.
    if (actualRules.some(saved => saved.length === 2 && saved[0] === "raw")) return false;
    const topic = stringToken(rule[1])!;
    if (!/^[1-9]\d*$/.test(topic) || !questions) return false;
    const targets = questions.filter(question => String(question.q_index) === topic);
    if (targets.length !== 1 || !(Number(targets[0].q_type ?? targets[0].qType) > 2)) return false;
    const hidden = rule[0] === "hide";
    if (Object.hasOwn(targets[0], "is_hide") && targets[0].is_hide !== hidden) return false;
    const states = actualRules.map(questionDisplay).filter(display => display?.target === topic);
    // Clearing native Relation removes the rule from the complete projection.
    // Hiding must have positive evidence in that projection, never just absence.
    return hidden ? states.length > 0 && states.every(display => display?.state === "hidden")
      : states.every(display => display?.state === "visible");
  });
}
