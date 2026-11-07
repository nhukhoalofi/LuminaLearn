import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createLuminaMcpServer, DEFAULT_REPOSITORY_ROOT } from '../src/server.js';

async function createFixtureRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'lumina-mcp-'));
  const jobDir = join(root, 'outputs', 'job-20261107171652-3cc5c0df');
  await mkdir(jobDir, { recursive: true });
  await writeFile(join(root, '.env'), 'GEMINI_API_KEY=must-never-be-readable\n', 'utf8');
  await writeFile(join(jobDir, 'storyboard.json'), JSON.stringify({
    storyboardId: 'sb_fixture', lessonId: 'lesson_fixture', topicId: 'calculus.integral.riemann_sum',
    scenes: [
      { sceneId: 'scene_intro', templateId: 'function_graph', sceneType: 'intro', durationFrames: 24, parameters: { title: 'Mở bài' }, layout: { aspectRatio: '9:16', safeAreaPadding: 48 }, mathematicalBinding: { boundClaimIds: [], latexFormulas: [] }, sourceReferenceIds: [] },
      { sceneId: 'scene_summary', templateId: 'function_graph', sceneType: 'summary', durationFrames: 24, parameters: { title: 'Tổng kết' }, layout: { aspectRatio: '9:16', safeAreaPadding: 48 }, mathematicalBinding: { boundClaimIds: [], latexFormulas: [] }, sourceReferenceIds: [] }
    ],
    visualTemplateIds: ['function_graph'], mathematicalData: {}, narrationObjectives: [], estimatedDurationFrames: 48, sourceReferences: []
  }), 'utf8');
  await writeFile(join(jobDir, 'final.mp4.metadata.json'), JSON.stringify({ width: 720, height: 1280, fps: 24 }), 'utf8');
  await writeFile(join(jobDir, 'visual-qa-report.json'), JSON.stringify({ schemaVersion: 'visual-qa-v1', passed: true }), 'utf8');
  return root;
}

test('all five read-only tools work over the in-memory MCP protocol with controlled files', async () => {
  const fixtureRoot = await createFixtureRepository();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createLuminaMcpServer({ repositoryRoot: fixtureRoot });
  const client = new Client({ name: 'luminalearn-test-client', version: '0.1.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
      'inspect_render_job', 'inspect_storyboard', 'list_math_templates', 'list_visual_styles', 'validate_math_spec'
    ]);
    assert.match(JSON.stringify(await client.callTool({ name: 'list_math_templates', arguments: {} })), /riemann_sum/);
    assert.match(JSON.stringify(await client.callTool({ name: 'list_visual_styles', arguments: {} })), /math_chalkboard/);
    assert.match(JSON.stringify(await client.callTool({ name: 'inspect_storyboard', arguments: { jobId: 'job-20261107171652-3cc5c0df' } })), /sb_fixture/);
    assert.match(JSON.stringify(await client.callTool({ name: 'inspect_render_job', arguments: { jobId: 'job-20261107171652-3cc5c0df' } })), /720/);
    assert.match(JSON.stringify(await client.callTool({ name: 'validate_math_spec', arguments: { spec: { topicId: '../secret' } } })), /"valid":false/);
    for (const invalidId of ['../.env', '..\\.env', 'job-20261107171652-3cc5c0df/storyboard.json']) {
      const response = await client.callTool({ name: 'inspect_storyboard', arguments: { jobId: invalidId } });
      assert.equal(response.isError, true);
      assert.doesNotMatch(JSON.stringify(response), /must-never-be-readable/);
    }
  } finally {
    await client.close();
    await server.close();
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('default repository root resolves to LuminaLearn rather than its parent', () => {
  assert.equal(resolve(DEFAULT_REPOSITORY_ROOT), resolve(fileURLToPath(new URL('../../../', import.meta.url))));
});

test('documented stdio launcher is discoverable by a real MCP client', async () => {
  const transport = new StdioClientTransport({
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['--filter', '@luminalearn/mcp-server', 'start'],
    cwd: DEFAULT_REPOSITORY_ROOT,
    stderr: 'pipe'
  });
  const client = new Client({ name: 'luminalearn-stdio-test', version: '0.1.0' });
  await client.connect(transport);
  try {
    assert.equal((await client.listTools()).tools.length, 5);
    assert.match(JSON.stringify(await client.callTool({ name: 'list_visual_styles', arguments: {} })), /clean_educational_infographic/);
  } finally {
    await client.close();
  }
});
