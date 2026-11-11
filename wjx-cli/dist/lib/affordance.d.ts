export interface Affordance {
    command: string;
    when: string;
    prerequisites?: string[];
    skill?: string;
}
export declare function resolveAffordance(command: string): Affordance | undefined;
