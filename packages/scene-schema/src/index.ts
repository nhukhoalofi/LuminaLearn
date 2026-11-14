export * from './types';
export * from './storyboard.schema';
export * from './validation';
export * from './math.schema';
export * from './math.types';
export * from './math.validation';
export * from './hybrid.schema';
export * from './hybrid.types';
export * from './hybrid.validation';
export * from './narration.schema';
export * from './v2';
export * from './v3';

import rawSimpsonFixture from './fixtures/simpson.json';
import type { LessonStoryboard } from './types';

export const simpsonFixture: LessonStoryboard = rawSimpsonFixture as unknown as LessonStoryboard;
