async function runNewtonTest() {
  const topic = 'Định luật II Newton và mối quan hệ F = m·a';
  console.log('=== Step 1: AI Supervisor Planning ===');
  const supRes = await fetch('http://localhost:3000/api/v3/supervisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-dev-token' },
    body: JSON.stringify({
      requestId: 'req_newton_' + Date.now(),
      topic,
      domain: 'physics',
      targetDurationSeconds: 60
    })
  });
  
  const supData = await supRes.json();
  console.log('Supervisor status:', supRes.status, 'Draft ID:', supData.draftId);
  if (!supData.draftId) {
    console.error('Failed:', supData);
    return;
  }
  
  const draftId = supData.draftId;
  console.log('Lesson Title:', supData.lessonPlan?.title);
  console.log('Scenes Count:', supData.lessonPlan?.storyboard?.scenes?.length);
  supData.lessonPlan?.storyboard?.scenes?.forEach((s, idx) => {
    console.log(`  Scene ${idx + 1}: [${s.sceneType}] "${s.title}" (${s.durationSeconds}s)`);
  });

  console.log('\n=== Step 2: Teacher Semantic Review ===');
  const revRes = await fetch('http://localhost:3000/api/v3/lessons/' + draftId + '/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-dev-token' },
    body: JSON.stringify({ expectedVersion: 1, semanticReviewConfirmed: true })
  });
  const revData = await revRes.json();
  console.log('Review status:', revRes.status, 'Version:', revData.version);

  console.log('\n=== Step 3: Approve & Start Job ===');
  const appRes = await fetch('http://localhost:3000/api/v3/lessons/' + draftId + '/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-dev-token' },
    body: JSON.stringify({ expectedVersion: revData.version })
  });
  const appData = await appRes.json();
  console.log('Approve status:', appRes.status, 'Job ID:', appData.job?.jobId);
  const jobId = appData.job?.jobId;
  if (!jobId) {
    console.error('Approve failed:', appData);
    return;
  }

  console.log('\n=== Step 4: Tracking Rendering Job ===');
  let finalJob = null;
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const jobRes = await fetch('http://localhost:3000/api/jobs/' + jobId, {
      headers: { 'Authorization': 'Bearer local-dev-token' }
    });
    const jobData = await jobRes.json();
    console.log(`[T+${i + 1}s] Status: ${jobData.status} | Progress: ${jobData.progress}% | Msg: ${jobData.message || ''}`);
    if (jobData.status === 'completed' || jobData.status === 'failed') {
      finalJob = jobData;
      break;
    }
  }

  if (finalJob && finalJob.status === 'completed') {
    console.log('\n✓ VIDEO GENERATION SUCCESSFUL!');
    console.log('Output Video Path:', finalJob.outputPath);
    console.log('Video URL:', finalJob.videoUrl);
  } else {
    console.log('\nFinal state:', finalJob);
  }
}

runNewtonTest().catch(console.error);

