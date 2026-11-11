const MAX_LOGIC_BYTES = 4 * 1024 * 1024;
function invalid(message) { throw new TypeError(`dsl.logic ${message}`); }
function positive(value) {
    const number = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(number))
        invalid("题号、选项号和数量必须是正整数");
    return number;
}
function quoted(token) {
    if (!token?.startsWith('"'))
        invalid("引用必须使用双引号字符串");
    try {
        const result = JSON.parse(token);
        if (typeof result === "string")
            return result;
    }
    catch { /* Report a stable input error below. */ }
    return invalid("包含非法字符串");
}
function selector(value, childRequired = false) {
    const match = /^([1-9]\d*)(?:(?:::|:)(?:(item|row|itemrow|rightrow|itemrowright|column|itemcolumn):)?([1-9]\d*))?$/.exec(value);
    if (!match)
        return invalid(`引用「${value}」必须是题号或题号::选项号`);
    const topic = positive(match[1]), child = match[3];
    if (child)
        positive(child);
    if (childRequired && !child)
        invalid("条件引用必须包含选项号，例如 2::1");
    const aliases = { item: "item", row: "row", itemrow: "row", rightrow: "rightrow", itemrowright: "rightrow", column: "column", itemcolumn: "column" };
    const kind = match[2] ? aliases[match[2]] : child ? "item" : undefined;
    return { topic, child, kind, key: `${topic}${child ? `::${kind === "item" ? "" : `${kind}:`}${child}` : ""}` };
}
function whole(value) {
    const result = selector(value);
    if (result.child)
        invalid("此规则必须引用整道题目");
    return result;
}
function constant(value) { return { kind: "constant", value }; }
function exprKey(value) {
    if (value.kind === "constant")
        return String(value.value);
    if (value.kind === "atom")
        return `${value.negative ? "!" : ""}${value.value}`;
    return `${value.kind}(${value.terms.map(exprKey).join(",")})`;
}
function combine(kind, values) {
    const terms = values.flatMap(value => value.kind === kind ? value.terms : [value]);
    const absorbing = kind === "or";
    if (terms.some(value => value.kind === "constant" && value.value === absorbing))
        return constant(absorbing);
    const unique = new Map(terms.filter(value => value.kind !== "constant").map(value => [exprKey(value), value]));
    for (const value of unique.values()) {
        if (value.kind === "atom" && unique.has(exprKey({ ...value, negative: !value.negative })))
            return constant(absorbing);
    }
    const sorted = [...unique.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
    return sorted.length === 0 ? constant(!absorbing) : sorted.length === 1 ? sorted[0] : { kind, terms: sorted };
}
function negate(value) {
    if (value.kind === "constant")
        return constant(!value.value);
    if (value.kind === "atom")
        return { ...value, negative: !value.negative };
    return combine(value.kind === "and" ? "or" : "and", value.terms.map(negate));
}
function nativeRelation(value) {
    if (value === "")
        return constant(true);
    if (value === "-1")
        return constant(false);
    if (value.includes("|") && value.includes("$"))
        return undefined;
    const top = value.includes("|") ? "|" : "$";
    const parts = [];
    for (const part of value.split(top)) {
        const match = /^([1-9]\d*),(-?[1-9]\d*(?:[;.]-?[1-9]\d*)*)$/.exec(part);
        if (!match || (match[2].includes(";") && match[2].includes(".")))
            return undefined;
        const options = match[2].split(/[;.]/).map(item => ({ kind: "atom",
            value: selector(`${match[1]}::${item.replace(/^-/, "")}`, true).key, negative: item.startsWith("-") }));
        if (options.some(item => item.negative !== options[0].negative))
            return undefined;
        const all = match[2].includes(".") !== options[0].negative;
        parts.push(combine(all ? "and" : "or", options));
    }
    return combine(top === "|" ? "and" : "or", parts);
}
function parseCondition(tokens) {
    let position = 0;
    function unary() {
        if (tokens[position] === "not") {
            position++;
            return negate(unary());
        }
        if (tokens[position] === "(") {
            position++;
            const result = or();
            if (tokens[position++] !== ")")
                return invalid("条件括号不完整");
            return result;
        }
        const token = tokens[position++];
        if (token === "always" || token === "true")
            return constant(true);
        const text = quoted(token);
        if (text.includes(",")) {
            const native = nativeRelation(text);
            if (native)
                return native;
            return invalid("条件包含无法验证的原生表达式；请使用 raw attr 保留既有协议");
        }
        return { kind: "atom", value: selector(text, true).key, negative: false };
    }
    function and() {
        const terms = [unary()];
        while (tokens[position] === "and") {
            position++;
            terms.push(unary());
        }
        return combine("and", terms);
    }
    function or() {
        const terms = [and()];
        while (tokens[position] === "or") {
            position++;
            terms.push(and());
        }
        return combine("or", terms);
    }
    const result = or();
    if (position !== tokens.length)
        invalid("条件包含多余或不完整的运算符");
    return result;
}
function conditionSelectors(value) {
    return value.kind === "atom" ? [selector(value.value, true)] : value.kind === "constant" ? [] : value.terms.flatMap(conditionSelectors);
}
function nativeSegment(value) {
    const atoms = value.kind === "and" || value.kind === "or" ? value.terms : [value];
    if (!atoms.length || atoms.some(term => term.kind !== "atom"))
        return false;
    const first = atoms[0];
    const topic = selector(first.value).topic;
    return atoms.every(term => term.kind === "atom" && term.negative === first.negative
        && selector(term.value).topic === topic && selector(term.value).kind === "item");
}
function nativeCondition(value) {
    return value.kind === "constant" || nativeSegment(value)
        || ((value.kind === "and" || value.kind === "or") && value.terms.every(nativeSegment));
}
function normalizeModule(value) {
    if (typeof value !== "string")
        return invalid("必须是字符串");
    const logic = value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
    if (Buffer.byteLength(logic, "utf8") > MAX_LOGIC_BYTES)
        invalid("超过 4 MiB 上限");
    if (!/^logic\s*\{/.test(logic))
        invalid("必须是 logic { ... }; 模块");
    return logic;
}
function rules(value) {
    const logic = normalizeModule(value);
    const tokens = logic.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|[A-Za-z_][A-Za-z_\d]*|-?\d+|[^\s]/g) ?? [];
    const parts = tokens.filter(token => !token.startsWith("//") && !token.startsWith("/*") && !token.startsWith("#"));
    if (parts[0] !== "logic" || parts[1] !== "{" || parts.at(-2) !== "}" || parts.at(-1) !== ";") {
        return invalid("必须包含一个完整的 logic { ... }; 模块，不能附带题目或完整 DSL 文档");
    }
    const result = [];
    let statement = [];
    for (const token of parts.slice(2, -2)) {
        if (token === "{" || token === "}")
            invalid("不能包含嵌套模块");
        if (token !== ";") {
            statement.push(token);
            continue;
        }
        if (!statement.length)
            invalid("包含空规则");
        const then = statement.indexOf("then");
        if (statement[0] === "if") {
            if (then < 2 || then === statement.length - 1)
                invalid("条件规则需要 if 条件 then 动作");
            const conditionTokens = statement.slice(1, then);
            const conditionReferences = conditionTokens.filter(token => token.startsWith('"')).flatMap(token => {
                const value = quoted(token);
                return value.includes(",") ? conditionSelectors(nativeRelation(value) ?? invalid("包含无法验证的原生条件")) : [selector(value, true)];
            });
            result.push({ action: statement.slice(then + 1), condition: parseCondition(conditionTokens), conditionReferences });
        }
        else
            result.push({ action: statement });
        statement = [];
    }
    if (statement.length)
        invalid("规则缺少分号");
    return result;
}
function effects(rule, input) {
    let action = rule.action;
    let raw;
    if (action.length >= 3 && action.at(-2) === "raw") {
        raw = quoted(action.at(-1));
        action = action.slice(0, -2);
    }
    const verb = action[0];
    const make = (key, value, selectors = []) => ({ key, value, selectors });
    if (verb === "show" || verb === "hide") {
        if (action.length !== 2)
            invalid("显示或隐藏规则需要唯一的目标题目/选项");
        const target = selector(quoted(action[1]));
        const sources = rule.conditionReferences ?? (rule.condition ? conditionSelectors(rule.condition) : []);
        if (sources.some(source => source.topic >= target.topic))
            invalid("题目/选项显示条件只能引用前面的题目");
        let display = rule.condition ?? constant(true);
        if (verb === "hide")
            display = negate(display);
        if (raw !== undefined) {
            const native = nativeRelation(raw);
            if (rule.condition && (!native || exprKey(native) !== exprKey(display)))
                invalid("raw 关联属性与显示条件不一致");
            if (native)
                display = native;
            else
                return [{ ...make(`display:${target.key}`, `raw:${raw}`, [target, ...sources]), exclusive: true }];
        }
        return [{ ...make(`display:${target.key}`, exprKey(display), [target, ...sources]), display,
                exclusive: rule.condition === undefined || raw !== undefined }];
    }
    if (verb === "jump" || verb === "branch") {
        if (action[1] !== "from")
            invalid("跳转规则缺少 from");
        let source = selector(quoted(action[2]));
        let index = 3;
        if (action[index] === "option" || action[index] === "item") {
            const child = quoted(action[index + 1]);
            const resolved = child.includes("::") ? selector(child, true) : selector(`${source.topic}::${child}`, true);
            if (resolved.topic !== source.topic || (source.child && source.key !== resolved.key))
                invalid("跳转选项必须属于来源题目");
            source = resolved;
            index += 2;
        }
        if (action[index++] !== "to" || index !== action.length - 1)
            invalid("跳转规则需要唯一的 to 目标");
        const value = quoted(action[index]);
        const target = value.toUpperCase() === "END" ? undefined : whole(value);
        if (target && target.topic <= source.topic)
            invalid("跳转目标必须在来源题目之后，结束问卷请使用 END");
        if (rule.condition) {
            const atom = rule.condition;
            if (atom.kind !== "atom" || atom.negative || !source.child || atom.value !== source.key)
                invalid("条件跳转必须对应同一来源题目的明确选项");
        }
        const destination = target?.key ?? "END";
        if (raw !== undefined && raw !== destination && !(destination === "END" && (raw === "1" || raw === "-1")))
            invalid("raw 跳转属性与目标不一致");
        return [make(`jump:${source.key}`, destination === "END" && raw === "-1" ? "END:-1" : destination, [source, ...(target ? [target] : [])])];
    }
    if (verb === "reference") {
        if (rule.condition || !["options", "rows", "title", "answer"].includes(action[1]) || action.length !== 6 || action[2] !== "from" || action[4] !== "to")
            invalid("引用需要 reference options/rows/title/answer from 来源题 to 后题");
        const source = whole(quoted(action[3])), target = whole(quoted(action[5]));
        if (source.topic >= target.topic)
            invalid("引用方向必须是前题 from 到后题 to，不能引用自身或后题");
        if (action[1] === "answer" && raw !== undefined)
            invalid("答案自动填入不支持 raw；请使用 reference answer from 来源整题 to 后面的填空整题");
        if (raw !== undefined && raw !== source.key)
            invalid("raw 引用属性与来源题目不一致");
        return [{ ...make(`reference:${action[1] === "rows" ? "options" : action[1]}:${target.key}`, source.key, [source, target]), referenceKind: action[1] }];
    }
    if (verb === "random") {
        if (rule.condition || !["options", "rows", "questions", "pages"].includes(action[1]))
            invalid("随机规则类型无效");
        const values = new Map();
        for (let index = 2; index < action.length; index += 2) {
            const key = action[index], value = action[index + 1];
            if (!["mode", "on", "from", "~", "count", "weight"].includes(key) || value === undefined || values.has(key))
                invalid("随机规则参数重复或不完整");
            values.set(key, ["mode", "count"].includes(key) ? String(positive(value)) : quoted(value));
        }
        const kind = action[1];
        if (kind === "questions" || kind === "pages") {
            if (values.has("on") || values.has("weight") || !values.has("from") || !values.has("~"))
                invalid("题目/分页随机必须提供完整 from 开始编号 ~ 结束编号范围");
            const nativeMode = kind === "pages" ? "6" : "4";
            const mode = values.get("mode") ?? nativeMode;
            if (input && mode !== nativeMode)
                invalid(kind === "pages" ? "分页随机仅支持 mode 6（按分页顺序随机）" : "题目随机仅支持 mode 4（按题号范围随机）");
            const start = whole(values.get("from")), end = whole(values.get("~"));
            if (start.topic > end.topic)
                invalid("题目随机范围必须从前题到后题");
            const count = Number(values.get("count") ?? end.topic - start.topic + 1);
            if (count > end.topic - start.topic + 1)
                invalid("随机抽取题数不能超过范围内题数");
            if (raw !== undefined && raw !== mode)
                invalid("raw 随机模式与 mode 不一致");
            return [make(`random:${kind}:${start.key}:${end.key}`, `${mode}:${start.key}:${end.key}:${count}`, [start, end])];
        }
        if (values.size !== 1 || !values.has("on"))
            invalid("选项/矩阵行随机仅支持 on 题号，不支持 mode/count/weight 或范围");
        const target = whole(values.get("on"));
        if (kind === "rows") {
            if (raw !== undefined && raw !== "true")
                invalid("矩阵行随机 raw 必须是 true");
            return [make(`random:rows:${target.key}`, "true", [target])];
        }
        const choice = raw === "true" ? "1" : raw ?? "1";
        positive(choice);
        return [make(`random:options:${target.key}`, choice, [target])];
    }
    if (verb === "raw" && !rule.condition && raw === undefined) {
        if (action.length === 2) {
            const value = quoted(action[1]);
            return [make(`opaque:${value}`, value)];
        }
        if (action[1] !== "attr" || action.at(-2) !== "=")
            invalid("raw attr 规则格式不完整");
        const attribute = quoted(action[2]), value = quoted(action.at(-1));
        let target;
        if (action.length > 5) {
            if (action[3] !== "question")
                invalid("raw attr 目标题目格式无效");
            target = whole(quoted(action[4]));
            if (action.length === 9 && action[5] === "item")
                target = selector(`${target.topic}::${quoted(action[6])}`, true);
            else if (action.length !== 7)
                invalid("raw attr 选项格式无效");
        }
        else if (action.length !== 5)
            invalid("raw attr 规则格式无效");
        if ((attribute === "Relation" || attribute === "ItemRelation") && target) {
            const display = nativeRelation(value);
            return [{ ...make(`display:${target.key}`, display ? exprKey(display) : `raw:${value}`, [target]), display, exclusive: true }];
        }
        if (input && ["RandomMode", "PartSet", "RandomBegin", "RandomEnd", "DisplayPart", "DisplayPartNum", "RandomPartSame",
            "RandomChoice", "RandomRow"].includes(attribute)) {
            invalid("随机属性必须使用已验证的结构化 random 规则；旧模式和分页随机请在编辑器配置");
        }
        if (attribute === "TitleTopic" && target && !target.child && /^[1-9]\d*(?:,[1-9]\d*)*$/.test(value)) {
            const sources = [...new Set(value.split(","))].map(whole);
            if (sources.some(source => source.topic >= target.topic))
                invalid("标题引用只能来自前面的题目");
            return [make(`reference:title:${target.key}`, sources.map(source => source.key).sort().join(","), [...sources, target])];
        }
        return [make(`raw:${attribute}:${target?.key ?? "root"}`, value, target ? [target] : [])];
    }
    return invalid("包含不支持或不完整的规则");
}
function groupEffects(parsed, input) {
    const grouped = new Map();
    for (const rule of parsed)
        for (const effect of effects(rule, input)) {
            const previous = grouped.get(effect.key);
            if (!previous) {
                grouped.set(effect.key, effect);
                continue;
            }
            if (effect.key.startsWith("reference:title:")) {
                grouped.set(effect.key, { ...effect, value: [...new Set([...previous.value.split(","), ...effect.value.split(",")])].sort().join(","),
                    selectors: [...previous.selectors, ...effect.selectors] });
            }
            else if (effect.display && previous.display && !effect.exclusive && !previous.exclusive) {
                const display = combine("and", [previous.display, effect.display]);
                grouped.set(effect.key, { ...effect, display, value: exprKey(display), selectors: [...previous.selectors, ...effect.selectors] });
            }
            else if (effect.value !== previous.value || (input && (effect.key.startsWith("display:") || effect.key.startsWith("reference:answer:"))))
                invalid("同一目标包含冲突或歧义规则");
        }
    if (input)
        for (const key of grouped.keys()) {
            if (key.startsWith("reference:options:") && grouped.has(`random:options:${key.slice("reference:options:".length)}`)) {
                invalid("引用选项的消费题不能同时启用选项随机");
            }
        }
    if (input) {
        const ranges = [...grouped.values()].filter(effect => effect.key.startsWith("random:questions:") || effect.key.startsWith("random:pages:"));
        if (ranges.some(effect => effect.key.startsWith("random:questions:")) && ranges.some(effect => effect.key.startsWith("random:pages:"))) {
            invalid("题目随机与分页随机不能混用");
        }
        for (let index = 0; index < ranges.length; index++)
            for (const other of ranges.slice(index + 1)) {
                if (ranges[index].selectors[0].topic <= other.selectors[1].topic && other.selectors[0].topic <= ranges[index].selectors[1].topic) {
                    invalid("随机范围不能重叠");
                }
            }
        for (const effect of grouped.values())
            if (effect.display && !nativeCondition(effect.display)) {
                invalid("此混合条件不能准确转换为问卷星原生关联，请拆分为可表达的条件");
            }
    }
    return grouped;
}
/** Validate the shared, native-backed logic grammar before any transport. */
export function prepareSurveyDslJson(value) {
    if (value === undefined)
        return undefined;
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1
        || !("logic" in value) || typeof value.logic !== "string")
        throw new TypeError("dsl 必须是仅包含字符串 logic 的 JSON 对象");
    const logic = normalizeModule(value.logic);
    groupEffects(rules(logic), true);
    return { logic };
}
/** Request native page nodes only when the logic addresses page identifiers. */
export function surveyLogicReadOptions(logic) {
    try {
        if (logic === undefined)
            return {};
        const parsed = rules(logic);
        groupEffects(parsed, true);
        return parsed.some(rule => rule.action[0] === "random" && rule.action[1] === "pages") ? { get_page_cut: true } : {};
    }
    catch {
        return {};
    }
}
function questionFor(target, questions) {
    const matches = questions.filter(question => String(question.q_index) === String(target.topic)
        && Number(question.q_type ?? question.qType) > 2);
    if (matches.length !== 1)
        return undefined;
    const question = matches[0];
    if (!target.child)
        return question;
    const field = target.kind === "row" ? "item_rows" : target.kind === "rightrow" ? "item_right_rows" : target.kind === "column" ? "item_columns" : "items";
    const items = question[field];
    if (!Array.isArray(items))
        return undefined;
    const found = items.filter((item, index) => String(item.item_index ?? index + 1) === target.child);
    return found.length === 1 ? found[0] : undefined;
}
function answerReferenceText(question) {
    return Number(question.q_type) === 5 && Number(question.q_subtype ?? 5) === 5
        && Number(question.mode ?? 0) === 0 && Number(question.verify ?? 0) === 0
        && ![question.q_ceshi, question.is_ceshi].some(value => value === true || value === "true" || value === 1 || value === "1");
}
function answerReferenceChoice(question) {
    return [3, 301].includes(Number(question.q_type)) && [3, 301].includes(Number(question.q_subtype ?? question.q_type))
        && Number(question.style ?? question.mode ?? 0) === 0 && Number(question.refer_topic ?? 0) === 0
        && Array.isArray(question.items) && question.items.length >= 2
        && !["is_panduan", "is_shelf", "is_shop", "is_qingjing", "is_random_label", "is_random_label_choice"]
            .some(key => question[key] === true || question[key] === "true" || question[key] === 1 || question[key] === "1");
}
/** Only reference consumers may replace the choices/rows copied by the service. */
export function surveyLogicPreservesQuestionContent(logic, before, after) {
    try {
        const consumers = new Set(logic === undefined ? [] : [...groupEffects(rules(logic), true).values()]
            .filter(effect => effect.key.startsWith("reference:options:")).map(effect => effect.selectors.at(-1).topic));
        const nativeKeys = new Set(["relation", "item_relation", "has_jump", "is_hide", "refer_topic", "title_topic", "random_mode", "randomchoice",
            "anytime_jumpto", "anytime_jump", "item_jump", "item_jump_rule", "choice_random", "choice_randomtype", "is_random_row"]);
        const content = (questions) => JSON.stringify(questions.map(question => {
            if (Number(question.q_type ?? question.qType) <= 2 || !consumers.has(Number(question.q_index)))
                return question;
            const result = { ...question };
            delete result[Number(question.q_type ?? question.qType) === 7 ? "item_rows" : "items"];
            return result;
        }), (key, value) => nativeKeys.has(key) ? undefined : value);
        return content(before) === content(after);
    }
    catch {
        return false;
    }
}
/** Compare the requested native effects with the complete XML projection. */
export function surveyLogicMatches(expected, actual, questions) {
    try {
        const requested = groupEffects(rules(expected), true), saved = groupEffects(rules(actual), false);
        if ([...saved.keys()].some(key => key.startsWith("opaque:")) && [...requested.keys()].some(key => key.startsWith("display:")))
            return false;
        return [...requested.values()].every(effect => {
            if (questions && !effect.key.startsWith("random:pages:") && effect.selectors.some(target => !questionFor(target, questions)))
                return false;
            const stored = saved.get(effect.key);
            if (effect.key.startsWith("display:")) {
                const target = effect.selectors[0];
                if (!questions)
                    return effect.display?.kind !== "constant" && stored?.value === effect.value;
                if (!questionFor(target, questions))
                    return false;
                if (!stored && effect.display?.kind === "constant" && effect.display.value) {
                    const question = questionFor(target, questions);
                    return question.is_hide !== true && question.item_hide !== true;
                }
                if (stored?.value !== effect.value)
                    return false;
                const row = questionFor(target, questions);
                if (effect.display?.kind === "constant") {
                    if (Object.hasOwn(row, "is_hide") && row.is_hide !== !effect.display.value)
                        return false;
                    if (Object.hasOwn(row, "item_hide") && row.item_hide !== !effect.display.value)
                        return false;
                }
                return true;
            }
            if (stored?.value !== effect.value)
                return false;
            if (questions && effect.key.startsWith("reference:")) {
                const source = questionFor(effect.selectors[0], questions);
                const target = questionFor(effect.selectors.at(-1), questions);
                // The server projects answer only from a native, editable gsData assignment;
                // it is distinct from TitleTopic and does not copy the source's options.
                if (effect.referenceKind === "answer")
                    return answerReferenceText(target)
                        && (answerReferenceText(source) || answerReferenceChoice(source));
                if (!effect.key.startsWith("reference:title:") && (Number(source.q_type) !== 4 || ![3, 4, 7].includes(Number(target.q_type))
                    || (effect.referenceKind === "rows" && Number(target.q_type) !== 7)))
                    return false;
                const native = effect.key.startsWith("reference:title:") ? target.title_topic : target.refer_topic;
                if (native !== undefined && [...new Set(String(native).split(","))].sort().join(",") !== effect.value)
                    return false;
                if (!effect.key.startsWith("reference:title:")) {
                    const consumed = Number(target.q_type) === 7 ? target.item_rows : target.items;
                    if (!Array.isArray(source.items) || !Array.isArray(consumed) || !source.items.length || source.items.length !== consumed.length
                        || source.items.some((item, index) => typeof item.item_title !== "string" || consumed[index]?.item_title !== item.item_title))
                        return false;
                    if (Number(target.anytime_jump ?? target.anytime_jumpto ?? 0) !== 0 || target.choice_random === true || Number(target.randomchoice ?? 0) > 0)
                        return false;
                    for (const name of ["items", "item_rows", "item_columns", "item_right_rows"]) {
                        if (Array.isArray(target[name]) && target[name].some((item) => (item.item_relation !== undefined && item.item_relation !== "") || Number(item.item_jump ?? 0) !== 0
                            || (item.item_jump_rule !== undefined && item.item_jump_rule !== "" && item.item_jump_rule !== "0")))
                            return false;
                    }
                }
            }
            if (questions && effect.key.startsWith("random:options:")) {
                const question = questionFor(effect.selectors[0], questions);
                if (![3, 4].includes(Number(question.q_type)) || !Array.isArray(question.items)
                    || question.items.length < 2 || Number(effect.value) >= question.items.length)
                    return false;
                if (Number(question.check_mode ?? 0) !== 0 || Number(question.refer_topic ?? 0) !== 0
                    || ["is_panduan", "is_shelf", "is_shop", "is_qingjing", "is_random_label", "is_random_label_choice"].some(key => question[key] === true || question[key] === 1 || question[key] === "1"))
                    return false;
                const native = question.randomchoice ?? question.choice_random;
                if (native !== undefined && String(native === true || native === "true" ? question.choice_randomtype ?? 1 : native) !== effect.value)
                    return false;
            }
            if (questions && effect.key.startsWith("random:rows:")) {
                const question = questionFor(effect.selectors[0], questions);
                if (Number(question.q_type) !== 7 || !Array.isArray(question.item_rows) || question.item_rows.length < 2)
                    return false;
                if (["is_random_label", "is_random_label_choice"].some(key => question[key] === true || question[key] === 1 || question[key] === "1"))
                    return false;
                const native = question.is_random_row;
                if (native !== undefined && native !== true && native !== "true")
                    return false;
            }
            if (questions && effect.key.startsWith("random:questions:")) {
                const real = questions.filter(question => Number(question.q_type ?? question.qType) > 2);
                if (!real.length || real.some((question, index) => Number(question.q_index) !== index + 1))
                    return false;
                const [start, end] = effect.selectors;
                if (end.topic > real.length || start.topic < 1)
                    return false;
            }
            if (effect.key.startsWith("random:pages:")) {
                if (!questions || Number(questions[0]?.q_type ?? questions[0]?.qType) !== 1)
                    return false;
                const pages = questions.filter(question => Number(question.q_type ?? question.qType) === 1);
                if (!pages.length || pages.some((page, index) => Number(page.q_index) !== index + 1 || Number(page.q_index) >= 80000))
                    return false;
                const [start, end] = effect.selectors;
                if (start.topic < 1 || end.topic > pages.length)
                    return false;
            }
            return true;
        });
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=logic.js.map