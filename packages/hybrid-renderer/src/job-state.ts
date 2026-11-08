export const JOB_STATES = ['queued', 'planning', 'validating', 'rendering_manim', 'narrating', 'synthesizing_audio', 'rendering_remotion', 'completed', 'failed', 'interrupted'] as const;
export type JobState = (typeof JOB_STATES)[number];

const transitions: Record<JobState, readonly JobState[]> = {
  queued: ['planning', 'failed'], planning: ['validating', 'failed'], validating: ['rendering_manim', 'rendering_remotion', 'failed'],
  rendering_manim: ['narrating', 'failed'], narrating: ['synthesizing_audio', 'rendering_remotion', 'failed'],
  synthesizing_audio: ['rendering_remotion', 'failed'], rendering_remotion: ['completed', 'failed'],
  completed: [], failed: [], interrupted: []
};

export function assertJobTransition(from: JobState, to: JobState): void {
  if (!transitions[from].includes(to)) throw new Error(`Invalid job state transition: ${from} -> ${to}`);
}

