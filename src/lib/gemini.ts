export async function generateDiagnosisReasoning(variables: Record<string, number>, affinityRank: any[], textAnswers: string): Promise<any> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ variables, affinityRank, textAnswers })
  });

  if (!response.ok) {
    let errMessage = 'Failed to analyze data';
    try {
      const errData = await response.json();
      if (errData.details) {
        // Attempt to parse nested JSON error from SDK
        try {
          const nested = JSON.parse(errData.details);
          if (nested?.error?.message) {
            errMessage = nested.error.message;
          } else {
            errMessage = errData.details;
          }
        } catch {
          errMessage = errData.details;
        }
      }
    } catch(e) {}
    throw new Error(errMessage);
  }

  return response.json();
}

export async function improveTextWithAI(text: string): Promise<string> {
  const response = await fetch('/api/improve-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    let errMessage = 'Failed to improve text';
    try {
      const errData = await response.json();
      if (errData.details) errMessage = errData.details;
    } catch(e) {}
    throw new Error(errMessage);
  }

  const data = await response.json();
  return data.text;
}
