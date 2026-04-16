export const scaffold = {
    packageName: 'docs-agent-alt',
    workflow: 'docs-agent',
};

export const createScaffoldFiles = () => ({
    'config.json': JSON.stringify({ agents: { reviewer: { skills: ['general-coding'] } } }, null, 2),
    'graph.ts': "import { createGraph } from 'docs-agent-alt';\n\nexport const graph = createGraph();\n",
});
