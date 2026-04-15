export interface MawConfig {
    workspace: string;
    graph: {
        name: string;
        agent?: string;
    };
    openviking: {
        enabled: boolean;
        host: string;
        port: number;
    };
    llm: {
        provider: string;
        apiKey: string;
    };
    templates: {
        sources: string[];
        customPath: string;
        gitRepos: string[];
        globalSnippets: string[];
        agents: Record<string, {
            snippets: string[];
        }>;
    };
}
export declare const ensureConfig: (root: string) => Promise<string>;
export declare const readConfig: (root: string) => Promise<MawConfig>;
