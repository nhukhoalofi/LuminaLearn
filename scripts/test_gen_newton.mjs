async function generateVideo() {
  const topic = 'Định luật II Newton và mối quan hệ F = m·a';
  console.log('=== Step 1: Requesting AI Supervisor Planning for:', topic);
  
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
    console.error('Supervisor failed:', supData);
    return;
  }
  
  const draftId = supData.draftId;
  
  console.log('\n=== Step 2: Semantic Review by Teacher ===');
  const revRes = await fetch('http://localhost:3000/api/v3/lessons/' + draftId + '/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-dev-token' },
    body: JSON.stringify({
      expectedVersion: 1,
      semanticReviewConfirmed: true
    })
  });
  const revData = await revRes.json();
  console.log('Review status:', revRes.status, 'Version:', revData.version);
  
  console.log('\n=== Step 3: Teacher Approval & Job Creation ===');
  const appRes = await fetch('http://localhost:3000/api/v3/lessons/' + draftId + '/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-dev-token' },
    body: JSON.stringify({
      expectedVersion: revData.version
    })
  });
  const appData = await appRes.json();
  console.log('Approve status:', appRes.status, 'Job ID:', appData.job?.jobId);
  const jobId = appData.job?.jobId;
  if (!jobId) {
    console.error('Approve failed:', appData);
    return;
  }
  
  console.log('\n=== Step 4: Monitoring Job Progress ===');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 800));
    const jobRes = await fetch('http://localhost:3000/api/jobs/' + jobId, {
      headers: { 'Authorization': 'Bearer local-dev-token' }
    });
    const jobData = await jobRes.json();
    console.log(`[Job ${jobId}] Status: ${jobData.job?.status} | Progress: ${jobData.job?.progress}% | Stage: ${jobData.job?.stage || ''} | Msg: ${jobData.job?.message || ''}`);
    if (jobData.job?.status === 'completed' || jobData.job?.status === 'failed') {
      console.log('\nFinal Job Result:', jobData.job);
      return jobData.job;
    }
  }
}

generateVideo().catch(console.error);

