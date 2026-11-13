import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { AntigravityAgentRuntime } from '../src/orchestration/antigravity-agent-runtime';
import { EducationalSupervisorV3 } from '../src/orchestration/educational-supervisor-v3';

test('Antigravity runtime matches the six-agent registry and closes the latest duplicate task safely', () => {
  const runtime = new AntigravityAgentRuntime();
  assert.equal(runtime.getRegisteredAgents().length, 6);

  runtime.recordAgentStart('task_shared', 'visual-director', 'first run');
  runtime.recordAgentCompletion('task_shared', 'completed first run');
  runtime.recordAgentStart('task_shared', 'visual-director', 'second run');
  runtime.recordAgentCompletion('task_shared', 'failed second run', 'failed');

  const report = runtime.generateRuntimeReport();
  assert.equal(report.executedTasks[0].status, 'completed');
  assert.equal(report.executedTasks[1].status, 'failed');
  assert.equal(report.systemHealthy, false);
});

test('Antigravity physics coordination preserves cinematic profile and reports verification truthfully', async () => {
  const storageDir = resolve(process.cwd(), '../../outputs/antigravity-qa/test-drafts');
  const supervisor = new EducationalSupervisorV3({ storageDir });
  const result = await supervisor.coordinate({
    requestId: 'req_antigravity_projectile_contract',
    topic: 'Chuyển động ném xiên có quỹ đạo parabol như thế nào?',
    domain: 'physics',
    targetAudience: 'high_school',
    targetDurationSeconds: 60,
    generationMode: 'mock',
    narrationMode: 'none',
    subtitlesEnabled: true,
    fps: 30,
    width: 1080,
    height: 1920,
    ownerId: 'local-single-user'
  });

  const persisted = JSON.parse(await readFile(resolve(storageDir, `${result.draftId}.json`), 'utf8')) as {
    request: { fps: number; width: number; height: number };
  };
  assert.equal(persisted.request.fps, 30);
  assert.equal(persisted.request.width, 1080);
  assert.equal(persisted.request.height, 1920);

  const specialist = result.trace.tasks.find((task) => task.taskId === 'task_3_specialist');
  const verification = result.trace.tasks.find((task) => task.taskId === 'task_4_verification');
  const narration = result.trace.tasks.find((task) => task.taskId === 'task_6_narration_direction');
  assert.equal(specialist?.role, 'math_specialist');
  assert.equal(verification?.validationStatus, 'advisory_warning');
  assert.equal(verification?.result?.verifiedCount, 0);
  assert.equal(narration?.validationStatus, 'advisory_warning');
  assert.doesNotMatch(result.trace.humanReadableSummary, /toàn bộ.*SymPy/i);
  assert.match(result.trace.humanReadableSummary, /Không có mệnh đề nào được gắn nhãn chứng minh hình thức/);
  assert.equal(result.teacherApprovalRequired, true);
});
