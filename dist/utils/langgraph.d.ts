export interface LanggraphConfig {
    node_version: string;
    graphs: Record<string, string>;
    env: string;
    dependencies?: readonly string[];
}
export declare const createWorkflowLanggraphJson: (name: string) => LanggraphConfig;
export declare const ensureWorkflowFiles: (dir: string) => Promise<void>;
export declare const spawnLanggraph: (sub: "dev", args: readonly string[]) => Promise<number>;
