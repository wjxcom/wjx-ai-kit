export declare function schemaFor(query: string): {
    id: string;
    command: string | undefined;
    service: "default" | "user-system" | "subuser" | "contacts";
    action: string;
    input: Record<string, unknown>;
    response: Record<string, unknown>;
    risk: import("../lib/runtime/risk.js").RiskLevel;
    identities: ("unknown" | "user" | "bot")[];
    pagination: Record<string, unknown> | null;
};
