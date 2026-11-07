import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';
import sceneSchema from '@luminalearn/scene-schema';

const {
  MathVisualizationSpecV2Schema,
  StoryboardV2Schema,
  defaultTemplateRegistry,
  listVisualStyles
} = sceneSchema;

const packageDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const repositoryRoot = resolve(packageDirectory, '../../..');
const outputsRoot = resolve(repositoryRoot, 'outputs');
const SafeId = z.string().regex(/^[a-zA-Z0-9_-]{3,120}$/);
const ToolOutput = z.object({ result: z.unknown() }).strict();

const result = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: { result: value }
});

async function readJobJson(jobId: string, fileName: 'storyboard.json' | 'final.mp4.metadata.json' | 'visual-qa-report.json'): Promise<unknown> {
  // jobId and fileName are closed schemas, so this never accepts a caller-controlled path.
  return JSON.parse(await readFile(resolve(outputsRoot, jobId, fileName), 'utf8'));
}

export function createLuminaMcpServer(): McpServer {
  const server = new McpServer({ name: 'luminalearn-readonly', version: '0.1.0' });

  server.registerTool('list_math_templates', {
    description: 'List registered LuminaLearn math visualization templates. Read-only and offline.',
    inputSchema: z.object({}).strict(), outputSchema: ToolOutput, annotations: { readOnlyHint: true }
  }, async () => result(defaultTemplateRegistry.listAll().map((template) => ({
    id: template.templateId,
    name: template.name,
    supportedTopics: template.topicIds,
    renderer: template.renderer,
    validatorKeys: template.validatorKeys
  }))));

  server.registerTool('list_visual_styles', {
    description: 'List approved typed educational visual styles. Read-only and offline.',
    inputSchema: z.object({}).strict(), outputSchema: ToolOutput, annotations: { readOnlyHint: true }
  }, async () => result(listVisualStyles()));

  server.registerTool('inspect_storyboard', {
    description: 'Inspect and schema-validate storyboard.json for one safe LuminaLearn job ID.',
    inputSchema: z.object({ jobId: SafeId }).strict(), outputSchema: ToolOutput, annotations: { readOnlyHint: true }
  }, async ({ jobId }) => result(StoryboardV2Schema.parse(await readJobJson(jobId, 'storyboard.json'))));

  server.registerTool('validate_math_spec', {
    description: 'Structurally validate a MathVisualizationSpecV2 without inference or paid API calls.',
    inputSchema: z.object({ spec: z.unknown() }).strict(), outputSchema: ToolOutput, annotations: { readOnlyHint: true }
  }, async ({ spec }) => {
    const parsed = MathVisualizationSpecV2Schema.safeParse(spec);
    return result(parsed.success ? { valid: true, spec: parsed.data } : { valid: false, issues: parsed.error.issues });
  });

  server.registerTool('inspect_render_job', {
    description: 'Inspect final FFprobe metadata and visual QA for one safe LuminaLearn job ID.',
    inputSchema: z.object({ jobId: SafeId }).strict(), outputSchema: ToolOutput, annotations: { readOnlyHint: true }
  }, async ({ jobId }) => result({
    metadata: await readJobJson(jobId, 'final.mp4.metadata.json'),
    visualQa: await readJobJson(jobId, 'visual-qa-report.json')
  }));

  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void serveStdio(createLuminaMcpServer);
  console.error('LuminaLearn read-only MCP server running on stdio');
}
