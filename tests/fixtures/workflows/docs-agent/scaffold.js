export const scaffold = {
    packageName: 'docs-agent',
    workflow: 'docs-agent',
};

export const createScaffoldFiles = () => ({
    'config.json': JSON.stringify({ agents: { planner: { skills: ['general-coding'] } } }, null, 2),
    'graph.ts': "import { createGraph } from 'docs-agent';\n\nexport const graph = createGraph();\n",
});
