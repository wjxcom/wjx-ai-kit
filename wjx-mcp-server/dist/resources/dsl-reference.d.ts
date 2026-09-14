export declare const DSL_SYNTAX_GUIDE: {
    title: string;
    version: number;
    purpose: string;
    header: string[];
    example: string;
    grammar: {
        statements: string;
        root: string;
        attributes: string;
        question: string;
        raw: string;
    };
    base_types: {
        radio: string;
        radio_down: string;
        check: string;
        question: string;
        gapfill: string;
        fileupload: string;
        sum: string;
        slider: string;
        matrix: string;
        page: string;
        cut: string;
    };
    common_aliases: string[];
    invalid_types_note: string;
    advanced_types_note: string;
    advanced_types_examples: {
        NPS: string;
        评价星级: string;
        社会阶层: string;
        性别学历等: string;
        手机日期邮箱: string;
        矩阵高级模型: string;
        考试题: string;
    };
    advanced_types_caveat: string;
    question_examples: {
        check: string;
        gapfill: string;
        matrix: string;
    };
    logic: string[];
    logic_rules: {
        references: string;
        validation: string;
    };
    raw_policy: string;
    api: {
        query: string;
        create: string;
        update: string;
        update_vid: string;
    };
};
