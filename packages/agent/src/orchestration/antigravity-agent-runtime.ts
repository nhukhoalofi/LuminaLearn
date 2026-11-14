/**
 * Antigravity Agent Runtime Engine
 * Tích hợp kiến trúc Antigravity Multi-Agent hoàn chỉnh vào pipeline LuminaLearn.
 *
 * Quản lý vòng đời, điều phối thông điệp (inter-agent messaging) và lưu vết
 * của 6 Antigravity Agents chuyên trách trong hệ thống:
 * 1. Antigravity Curriculum Planner Agent
 * 2. Antigravity Math & Science Specialist Agent
 * 3. Antigravity Knowledge Validation Agent (SymPy Proof Engine)
 * 4. Antigravity Visual Director Agent (Remotion Visual DSL)
 * 5. Antigravity Narration Director Agent (Vietnamese Voice & Subtitles)
 * 6. Antigravity Pedagogical Reviewer Agent (Quality & Misconception Auditor)
 */

export interface AntigravityAgentDescriptor {
  id: string;
  role: string;
  name: string;
  vietnameseTitle: string;
  icon: string;
  systemPromptSummary: string;
  capabilities: string[];
}

export interface AntigravityAgentTaskExecution {
  taskId: string;
  agentId: string;
  agentName: string;
  role: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  outputSummary?: string;
}

export interface AntigravityRuntimeReport {
  runtimeVersion: string;
  orchestrator: string;
  totalAgentsRegistered: number;
  executedTasks: AntigravityAgentTaskExecution[];
  systemHealthy: boolean;
  totalDurationMs: number;
}

export class AntigravityAgentRuntime {
  private readonly agents = new Map<string, AntigravityAgentDescriptor>();
  private readonly executions: AntigravityAgentTaskExecution[] = [];

  constructor() {
    this.registerStandardAgents();
  }

  private registerStandardAgents(): void {
    const registry: AntigravityAgentDescriptor[] = [
      {
        id: 'curriculum-planner',
        role: 'curriculum_planner',
        name: 'Antigravity Curriculum Planner',
        vietnameseTitle: 'Chuyên gia Lập Kế hoạch Sư phạm Antigravity',
        icon: '🧠',
        systemPromptSummary: 'Phân rã chủ đề theo thang đo nhận thức Bloom, phân chia chương hồi bài giảng.',
        capabilities: ['blooms_taxonomy', 'chapter_sequencing', 'pedagogical_beats']
      },
      {
        id: 'math-specialist',
        role: 'math_specialist',
        name: 'Antigravity Math & Science Specialist',
        vietnameseTitle: 'Chuyên gia Tri thức Khoa học Antigravity',
        icon: '📐',
        systemPromptSummary: 'Hình thức hóa mệnh đề toán học & kiểm định tiền đề vật lý/quang học.',
        capabilities: ['formal_mathematics', 'symbolic_verification', 'optical_physics']
      },
      {
        id: 'visual-director',
        role: 'visual_director',
        name: 'Antigravity Visual Director',
        vietnameseTitle: 'Đạo diễn Thị giác & Chuyển động Remotion Antigravity',
        icon: '🎬',
        systemPromptSummary: 'Thiết kế bố cục chuyển động 9:16, ánh xạ Visual DSL và vùng an toàn hiển thị.',
        capabilities: ['remotion_dsl', 'physics_canvas', 'safe_zone_inspection']
      },
      {
        id: 'narration-director',
        role: 'narration_director',
        name: 'Antigravity Narration Director',
        vietnameseTitle: 'Đạo diễn Lời bình & Giọng đọc Tiếng Việt Antigravity',
        icon: '🎙️',
        systemPromptSummary: 'Biên soạn lời thuyết minh tiếng Việt, nhịp độ WPM chuẩn và phụ đề khớp khung hình.',
        capabilities: ['vietnamese_speech', 'wpm_cognitive_pacing', 'subtitle_sync']
      },
      {
        id: 'pedagogical-reviewer',
        role: 'pedagogical_reviewer',
        name: 'Antigravity Pedagogical Reviewer',
        vietnameseTitle: 'Thẩm định viên Chất lượng Sư phạm Antigravity',
        icon: '🔍',
        systemPromptSummary: 'Phát hiện ngộ nhận khoa học, chấm điểm độ rõ ràng và rà soát mâu thuẫn câu từ.',
        capabilities: ['misconception_detection', 'pedagogy_clarity_score', 'advisory_review']
      },
      {
        id: 'educational-supervisor',
        role: 'supervisor',
        name: 'Antigravity Multi-Agent Supervisor',
        vietnameseTitle: 'Tổng Điều phối Đa Agent Antigravity',
        icon: '👑',
        systemPromptSummary: 'Giám sát toàn diện 10 chốt chặn nhất quán liên Agent và tạo bản thảo giáo viên.',
        capabilities: ['cross_agent_arbitration', 'checkpoint_f_validation', 'draft_assembly']
      }
    ];

    for (const ag of registry) {
      this.agents.set(ag.id, ag);
    }
  }

  public getRegisteredAgents(): AntigravityAgentDescriptor[] {
    return Array.from(this.agents.values());
  }

  public getAgent(id: string): AntigravityAgentDescriptor | undefined {
    return this.agents.get(id);
  }

  public recordAgentStart(taskId: string, agentId: string, title: string): AntigravityAgentTaskExecution {
    const agent = this.agents.get(agentId);
    const execution: AntigravityAgentTaskExecution = {
      taskId,
      agentId,
      agentName: agent ? agent.name : agentId,
      role: agent ? agent.role : 'specialist',
      title,
      status: 'running',
      startedAt: new Date().toISOString()
    };
    this.executions.push(execution);
    return execution;
  }

  public recordAgentCompletion(taskId: string, outputSummary: string, status: 'completed' | 'failed' = 'completed'): void {
    let execution: AntigravityAgentTaskExecution | undefined;
    for (let index = this.executions.length - 1; index >= 0; index--) {
      const candidate = this.executions[index];
      if (candidate.taskId === taskId && candidate.status === 'running') {
        execution = candidate;
        break;
      }
    }
    if (execution) {
      const now = Date.now();
      execution.status = status;
      execution.completedAt = new Date(now).toISOString();
      execution.durationMs = Math.max(1, now - new Date(execution.startedAt).getTime());
      execution.outputSummary = outputSummary;
    }
  }

  public generateRuntimeReport(): AntigravityRuntimeReport {
    const totalMs = this.executions.reduce((sum, e) => sum + (e.durationMs || 0), 0);
    const failed = this.executions.some((e) => e.status === 'failed');

    return {
      runtimeVersion: '3.0.0-antigravity-core',
      orchestrator: 'Antigravity Educational Supervisor v3',
      totalAgentsRegistered: this.agents.size,
      executedTasks: [...this.executions],
      systemHealthy: !failed,
      totalDurationMs: totalMs
    };
  }
}

export const antigravityAgentRuntime = new AntigravityAgentRuntime();

