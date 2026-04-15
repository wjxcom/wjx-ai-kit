export declare const ANALYSIS_METHODS: {
    NPS: {
        name: string;
        formula: string;
        scale: string;
        categories: {
            promoters: string;
            passives: string;
            detractors: string;
        };
        benchmarks: {
            excellent: string;
            good: string;
            average: string;
            poor: string;
        };
    };
    CSAT: {
        name: string;
        formula: string;
        typical_scale: string;
        benchmarks: {
            excellent: string;
            good: string;
            average: string;
            poor: string;
        };
    };
    CES: {
        name: string;
        formula: string;
        typical_scale: string;
        interpretation: string;
        benchmarks: {
            excellent: string;
            good: string;
            average: string;
            poor: string;
        };
    };
};
export declare const RESPONSE_FORMAT_GUIDE: {
    format: string;
    separators: {
        question: string;
        answer: string;
        option: string;
    };
    examples: {
        single_choice: string;
        multiple_choice: string;
        fill_in: string;
        scale: string;
        ranking: string;
    };
};
