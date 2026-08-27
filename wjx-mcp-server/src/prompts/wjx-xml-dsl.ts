import { WJX_XML_DSL_GUIDE } from "../resources/wjx-xml-dsl-reference.js";

export const WJX_XML_DSL_FORMAT_INSTRUCTIONS = `
Use WJX XML DSL v1. Generate a complete questionnaire document, not JSONL,
legacy text DSL, or an XML fragment. Keep Topic values unique and positive,
preserve unknown attributes/nodes, and do not invent internal questionnaire IDs.
Use only the production base Types and matrix Modes listed in the DSL reference
supportMatrix. Matrix child shapes and advanced-attribute compatibility notes
are part of that contract; do not invent a new Type for a subtype.

Public DSL workflow:
1. Create with create_survey_by_wjx_dsl.
2. Query an existing questionnaire with query_wjx_dsl using its traditional vid.
3. Modify the returned complete dsl and submit it with update_wjx_dsl.
Breaking changes that could require Answer/AnswerItem migration are rejected.

${WJX_XML_DSL_GUIDE.example}`;

export const WJX_XML_DSL_NPS_EXAMPLE = WJX_XML_DSL_GUIDE.example;
export const WJX_XML_DSL_DIMENSION_EXAMPLE = WJX_XML_DSL_GUIDE.example;
export const WJX_XML_DSL_EXAM_NOTE = "Use only DSL attributes accepted by the server; unsupported mappings fail before persistence.";
