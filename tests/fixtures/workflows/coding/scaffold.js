export const scaffold = {
    packageName: 'coding',
    workflow: 'coding',
};

export const createScaffoldFiles = () => ({
    'config.json': JSON.stringify({ agents: { planner: { skills: ['general-coding'] } } }, null, 2),
    'graph.ts': "import { createGraph } from 'coding';\n\nexport const graph = createGraph();\n",
});
