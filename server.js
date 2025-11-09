// server.js
app.post('/api/assemblyai-token', async (req, res) => {
  try {
    console.log('🔑 Generating AssemblyAI temporary token...');
    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
    if (!ASSEMBLYAI_API_KEY) {
      console.error('❌ ASSEMBLYAI_API_KEY not set in environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'AssemblyAI API key not configured',
      });
    }

    // Accept TTL from query/body, default to 60s, clamp to 1–600
    const ttlRaw =
      req.query?.expires_in_seconds ??
      req.body?.expires_in_seconds ??
      60;
    const expiresInSeconds = Math.min(600, Math.max(1, Number(ttlRaw) || 60));

    // Optional: cap session duration (defaults to 10800 = 3h)
    const maxSessionRaw =
      req.query?.max_session_duration_seconds ??
      req.body?.max_session_duration_seconds ??
      10800;
    const maxSessionDurationSeconds = Math.min(10800, Math.max(60, Number(maxSessionRaw) || 10800));

    const url = new URL('https://streaming.assemblyai.com/v3/token');
    url.search = new URLSearchParams({
      expires_in_seconds: String(expiresInSeconds),
      max_session_duration_seconds: String(maxSessionDurationSeconds),
    }).toString();

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: ASSEMBLYAI_API_KEY },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AssemblyAI token generation failed:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Failed to generate token',
        details: errorText,
      });
    }

    const data = await response.json();
    console.log('✅ AssemblyAI token generated successfully');
    // Return the field names exactly as v3 returns them
    res.json({
      token: data.token,
      expires_in_seconds: data.expires_in_seconds,
    });
  } catch (error) {
    console.error('❌ Error generating AssemblyAI token:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
