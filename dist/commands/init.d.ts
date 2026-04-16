import { type CommandDefinition } from './shared.js';
interface WorkflowScaffold {
    packageName: string;
    workflow: string;
}
type WorkflowFiles = Record<'graph.ts' | 'config.json', string>;
interface WorkflowModule {
    scaffold: WorkflowScaffold;
    createScaffoldFiles: () => WorkflowFiles | Promise<WorkflowFiles>;
}
export declare const loadWorkflows: (root: string) => Promise<WorkflowModule[]>;
export declare const runInit: (_args: readonly string[], root?: string) => Promise<number>;
export declare const initCommand: CommandDefinition<'init'>;
export {};
