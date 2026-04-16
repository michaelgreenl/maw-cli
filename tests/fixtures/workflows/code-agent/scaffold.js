export const scaffold = {
    packageName: 'code-agent',
    workflow: 'code-agent',
};

export const createScaffoldFiles = () => ({
    'config.json': JSON.stringify({ agents: { coder: { skills: ['general-coding'] } } }, null, 2),
    'graph.ts': "import { createGraph } from 'code-agent';\n\nexport const graph = createGraph();\n",
});
