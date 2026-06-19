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

  const { situation, goal, length } = body;

  if (!situation || !goal || !length) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY environment variable is not set" }) };
  }

  const lengthGuide = {
    "One sentence": "Each script must be exactly one sentence.",
    "Text message": "Each script should be 2-3 sentences, casual and natural, as if sent over text.",
    "Short paragraph": "Each script should be a short paragraph of 3-5 sentences.",
    "Conversation": "Each script should be a full conversational response of 4-6 sentences with natural pacing.",
  };

  const lengthInstruction = lengthGuide[length] || "Each script should be 2-4 sentences.";

  const prompt = `You are an expert at helping people communicate their boundaries clearly and compassionately. You infer the relationship context from the situation described.

The user has provided:
- Situation: ${situation}
- Goal: ${goal}
- Length: ${length}

Length instruction: ${lengthInstruction}

Generate exactly 3 boundary-setting scripts. Each should sound natural and spoken, not corporate or stiff. Use first-person voice ("I...").

Return ONLY a valid JSON object with no markdown, no code fences, no explanation — just raw JSON:
{
  "gentle": "...",
  "direct": "...",
  "firm": "..."
}

Tone guidelines:
- gentle: Warm, kind, acknowledges the relationship and the other person's feelings. Sets the boundary clearly but with care. Not apologetic or self-undermining.
- direct: Clear and confident. No filler. States the boundary without excessive justification. Respectful but leaves no ambiguity.
- firm: Unambiguous and strong. For when a clear line must be drawn. Does not leave room for negotiation on the core boundary. Still civil, never aggressive.

Each script must feel like something a real person would actually say in this situation.`;

  const models = [
    "gemini-3-flash-preview",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
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
            temperature: 0.85,
            maxOutputTokens: 1200,
          },
        }),
      });

      const responseText = await response.text();
      console.log(`Model ${model} status: ${response.status}`);

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
