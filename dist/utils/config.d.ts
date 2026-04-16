export interface MawProjectConfig {
    workspace: string;
    openviking: {
        enabled: boolean;
        host: string;
        port: number;
    };
    templates: {
        customPath: string;
    };
}
export declare const ensureConfig: (root: string) => Promise<string>;
export declare const readConfig: (root: string) => Promise<MawProjectConfig>;
