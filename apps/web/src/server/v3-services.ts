import 'server-only';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EducationalPlannerV3,
  LessonDraftManagerV3,
  LiveGeminiAIProvider,
  EducationalSupervisorV3
} from '@luminalearn/agent';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const globals = globalThis as typeof globalThis & { __luminaDraftManagerV3?: LessonDraftManagerV3 };

export const draftManagerV3 = globals.__luminaDraftManagerV3 ?? new LessonDraftManagerV3({
  storageDir: resolve(repositoryRoot, 'outputs/.drafts-v3')
});
globals.__luminaDraftManagerV3 = draftManagerV3;

export function createPlannerV3(mode: 'mock' | 'live'): EducationalPlannerV3 {
  return mode === 'live'
    ? new EducationalPlannerV3({ aiProvider: new LiveGeminiAIProvider() })
    : new EducationalPlannerV3();
}

export function createSupervisorV3(mode: 'mock' | 'live'): EducationalSupervisorV3 {
  const planner = createPlannerV3(mode);
  return new EducationalSupervisorV3({
    planner,
    draftManager: draftManagerV3,
    storageDir: resolve(repositoryRoot, 'outputs/.drafts-v3')
  });
}

