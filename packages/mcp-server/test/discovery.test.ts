import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createLuminaMcpServer } from '../src/server.js';

test('official MCP client discovers and invokes the read-only tools', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createLuminaMcpServer();
  const client = new Client({ name: 'luminalearn-test-client', version: '0.1.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
      'inspect_render_job', 'inspect_storyboard', 'list_math_templates', 'list_visual_styles', 'validate_math_spec'
    ]);
    const response = await client.callTool({ name: 'list_visual_styles', arguments: {} });
    assert.match(JSON.stringify(response), /math_chalkboard/);
    const invalid = await client.callTool({ name: 'validate_math_spec', arguments: { spec: { topicId: '../secret' } } });
    assert.match(JSON.stringify(invalid), /"valid":false/);
  } finally {
    await client.close();
    await server.close();
  }
});
