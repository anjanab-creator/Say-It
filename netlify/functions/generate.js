// Netlify serverless function — calls Google Gemini API securely

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const { situation, relationship, goal } = body;

  if (!situation || !relationship || !goal) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY environment variable is not set" }) };
  }

  const prompt = `You are an expert at helping people communicate their boundaries clearly and compassionately.

The user has provided the following:
- Situation: ${situation}
- Their relationship with this person: ${relationship}
- Their goal: ${goal}

Generate exactly 3 boundary-setting scripts. Each should sound natural and spoken, not corporate or stiff. Use first-person voice ("I...").

Return ONLY a valid JSON object with no markdown, no code fences, no explanation — just the raw JSON:
{
  "gentle": "...",
  "direct": "...",
  "firm": "..."
}

Tone guidelines:
- gentle: Warm, acknowledges the relationship, uses softening language but still sets the boundary clearly. Not apologetic or self-undermining.
- direct: Clear and confident. No filler. States the boundary without excessive justification. Respectful but leaves no ambiguity.
- firm: Unambiguous. For when it may not be the first time, or when a strong boundary is needed. Does not leave room for negotiation on the core boundary. Still civil.

Each script should be 2-5 sentences and feel like something a real person would actually say.`;

  const models = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-8b",
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      console.log(`Trying model: ${model}`);

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
          },
        }),
      });

      const responseText = await response.text();
      console.log(`Model ${model} status: ${response.status}`);
      console.log(`Model ${model} body: ${responseText}`);

      if (!response.ok) {
        lastError = `Model ${model} failed (${response.status}): ${responseText}`;
        continue;
      }

      const data = JSON.parse(responseText);
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        lastError = `Model ${model} returned empty text`;
        continue;
      }

      const cleaned = rawText.replace(/```json|```/g, "").trim();
      const scripts = JSON.parse(cleaned);

      if (!scripts.gentle || !scripts.direct || !scripts.firm) {
        lastError = `Model ${model} returned incomplete scripts`;
        continue;
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ scripts }),
      };

    } catch (err) {
      lastError = `Model ${model} threw error: ${err.message}`;
      console.error(lastError);
      continue;
    }
  }

  console.error("All models failed. Last error:", lastError);
  return {
    statusCode: 500,
    body: JSON.stringify({ error: `All models failed. Last error: ${lastError}` }),
  };
};
