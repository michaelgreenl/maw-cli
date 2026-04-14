export type LanggraphSub = 'dev' | 'start';
export declare const LANGGRAPH_JSON: {
    readonly node_version: "20";
    readonly graphs: {
        readonly agent: "./.maw/graph.ts:graph";
    };
    readonly env: ".env";
    readonly dependencies: readonly ["."];
};
export declare const ensureLanggraphJson: (root: string) => Promise<void>;
export declare const spawnLanggraph: (sub: LanggraphSub, args: readonly string[]) => Promise<number>;
