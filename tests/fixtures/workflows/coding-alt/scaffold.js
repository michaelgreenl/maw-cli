export const scaffold = {
    packageName: 'coding-alt',
    workflow: 'coding',
};

export const createScaffoldFiles = () => ({
    'config.json': JSON.stringify({ agents: { reviewer: { skills: ['general-coding'] } } }, null, 2),
    'graph.ts': "import { createGraph } from 'coding-alt';\n\nexport const graph = createGraph();\n",
});
