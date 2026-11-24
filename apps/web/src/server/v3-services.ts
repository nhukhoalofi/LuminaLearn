import 'server-only';
import { resolve } from 'node:path';
import {
  EducationalPlannerV3,
  LessonDraftManagerV3,
  LiveGeminiAIProvider,
  OpenAICodexAIProvider,
  EducationalSupervisorV3
} from '@luminalearn/agent';
import { getStorageRoot } from './storage-root';

const repositoryRoot = getStorageRoot();
const globals = globalThis as typeof globalThis & { __luminaDraftManagerV3?: LessonDraftManagerV3 };

export const draftManagerV3 = globals.__luminaDraftManagerV3 ?? new LessonDraftManagerV3({
  storageDir: resolve(repositoryRoot, 'outputs/.drafts-v3')
});
globals.__luminaDraftManagerV3 = draftManagerV3;

export function createPlannerV3(mode: 'mock' | 'live', provider: 'gemini' | 'codex' = 'gemini'): EducationalPlannerV3 {
  return mode === 'live'
    ? new EducationalPlannerV3({
        aiProvider: provider === 'codex'
          ? new OpenAICodexAIProvider()
          : new LiveGeminiAIProvider()
      })
    : new EducationalPlannerV3();
}

export function createSupervisorV3(mode: 'mock' | 'live', provider: 'gemini' | 'codex' = 'gemini'): EducationalSupervisorV3 {
  const planner = createPlannerV3(mode, provider);
  return new EducationalSupervisorV3({
    planner,
    draftManager: draftManagerV3,
    storageDir: resolve(repositoryRoot, 'outputs/.drafts-v3')
  });
}

