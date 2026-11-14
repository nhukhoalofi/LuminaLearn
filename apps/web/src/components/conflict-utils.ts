export interface FieldConflict {
  field: string;
  label: string;
  localValue: string;
  serverValue: string;
}

export interface MinimalLessonDraft {
  version: number;
  lessonPlan: {
    title: string;
    summary: string;
    mathematicalClaims: Array<{
      id: string;
      statement: string;
      expectedExpression: string;
    }>;
  };
  narrationPlan?: {
    segments: Array<{
      segmentId: string;
      text: string;
      subtitleText: string;
    }>;
  };
  renderConfig?: {
    renderMode?: string;
    narrationMode?: string;
    visualStyleId?: string;
    subtitlesEnabled?: boolean;
  };
}

export function detectDraftConflicts(
  localDraft: MinimalLessonDraft,
  serverDraft: MinimalLessonDraft
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];

  // 1. Check title
  if (localDraft.lessonPlan.title !== serverDraft.lessonPlan.title) {
    conflicts.push({
      field: 'title',
      label: 'Tiêu đề bài học',
      localValue: localDraft.lessonPlan.title,
      serverValue: serverDraft.lessonPlan.title
    });
  }

  // 2. Check summary
  if (localDraft.lessonPlan.summary !== serverDraft.lessonPlan.summary) {
    conflicts.push({
      field: 'summary',
      label: 'Tóm tắt bài học',
      localValue: localDraft.lessonPlan.summary,
      serverValue: serverDraft.lessonPlan.summary
    });
  }

  // 3. Check mathematical claims
  const serverClaimsMap = new Map(
    serverDraft.lessonPlan.mathematicalClaims.map((c) => [c.id, c])
  );
  const localClaimsMap = new Map(
    localDraft.lessonPlan.mathematicalClaims.map((c) => [c.id, c])
  );

  for (const [id, localClaim] of localClaimsMap.entries()) {
    const serverClaim = serverClaimsMap.get(id);
    if (!serverClaim) {
      conflicts.push({
        field: `claim_${id}_removed_on_server`,
        label: `Mệnh đề toán học [${id}]`,
        localValue: `${localClaim.statement} (= ${localClaim.expectedExpression})`,
        serverValue: '(Đã bị xóa trên máy chủ)'
      });
    } else if (
      localClaim.statement !== serverClaim.statement ||
      localClaim.expectedExpression !== serverClaim.expectedExpression
    ) {
      conflicts.push({
        field: `claim_${id}`,
        label: `Mệnh đề toán học [${id}]`,
        localValue: `${localClaim.statement} (= ${localClaim.expectedExpression})`,
        serverValue: `${serverClaim.statement} (= ${serverClaim.expectedExpression})`
      });
    }
  }

  for (const [id, serverClaim] of serverClaimsMap.entries()) {
    if (!localClaimsMap.has(id)) {
      conflicts.push({
        field: `claim_${id}_new_on_server`,
        label: `Mệnh đề toán học mới [${id}]`,
        localValue: '(Chưa có trong bản nháp này)',
        serverValue: `${serverClaim.statement} (= ${serverClaim.expectedExpression})`
      });
    }
  }

  // 4. Check narration texts
  const serverSegments = new Map(
    (serverDraft.narrationPlan?.segments ?? []).map((s) => [s.segmentId, s])
  );
  const localSegments = new Map(
    (localDraft.narrationPlan?.segments ?? []).map((s) => [s.segmentId, s])
  );

  for (const [segId, localSeg] of localSegments.entries()) {
    const serverSeg = serverSegments.get(segId);
    if (serverSeg) {
      if (localSeg.text !== serverSeg.text) {
        conflicts.push({
          field: `narration_${segId}_text`,
          label: `Lời dẫn phân đoạn [${segId}]`,
          localValue: localSeg.text,
          serverValue: serverSeg.text
        });
      }
      if (localSeg.subtitleText !== serverSeg.subtitleText) {
        conflicts.push({
          field: `narration_${segId}_subtitle`,
          label: `Phụ đề phân đoạn [${segId}]`,
          localValue: localSeg.subtitleText,
          serverValue: serverSeg.subtitleText
        });
      }
    }
  }

  // 5. Check render configuration
  if (
    localDraft.renderConfig &&
    serverDraft.renderConfig
  ) {
    if (localDraft.renderConfig.renderMode !== serverDraft.renderConfig.renderMode) {
      conflicts.push({
        field: 'renderMode',
        label: 'Chế độ render',
        localValue: String(localDraft.renderConfig.renderMode),
        serverValue: String(serverDraft.renderConfig.renderMode)
      });
    }
    if (localDraft.renderConfig.narrationMode !== serverDraft.renderConfig.narrationMode) {
      conflicts.push({
        field: 'narrationMode',
        label: 'Chế độ giọng đọc',
        localValue: String(localDraft.renderConfig.narrationMode),
        serverValue: String(serverDraft.renderConfig.narrationMode)
      });
    }
  }

  return conflicts;
}

