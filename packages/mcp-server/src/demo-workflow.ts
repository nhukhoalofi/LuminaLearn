import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { DEFAULT_REPOSITORY_ROOT } from './server.js';

const jobId = process.argv[2];
if (!jobId || !/^job-[a-z0-9-]{8,64}$/.test(jobId)) {
  throw new Error('usage: pnpm --filter @luminalearn/mcp-server demo:workflow -- <job-id>');
}

const transport = new StdioClientTransport({
  command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  args: ['--filter', '@luminalearn/mcp-server', 'start'],
  cwd: DEFAULT_REPOSITORY_ROOT,
  stderr: 'pipe'
});
const client = new Client({ name: 'luminalearn-mentor-demo', version: '2.4.2' });

await client.connect(transport);
try {
  const steps = [
    ['list_visual_styles', {}],
    ['list_math_templates', {}],
    ['validate_math_spec', { spec: {
      topicId: 'calculus.integral.riemann_sum', visualization: 'riemann_sum',
      function: { type: 'polynomial', coefficients: [0, 0, 1] },
      parameters: { interval: [0, 1], partitions: [4, 8, 16], method: 'left' },
      boundClaimIds: ['claim_riemann_formula', 'claim_riemann_limit', 'claim_definite_integral']
    } }],
    ['inspect_storyboard', { jobId }],
    ['inspect_render_job', { jobId }]
  ] as const;
  for (const [name, args] of steps) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`${name} failed: ${JSON.stringify(result.content)}`);
    process.stdout.write(`${JSON.stringify({ tool: name, ok: true, result: result.structuredContent ?? result.content })}\n`);
  }
} finally {
  await client.close();
}
