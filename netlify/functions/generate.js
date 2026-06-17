// Netlify serverless function — calls Google Gemini API securely
// Your GEMINI_API_KEY is stored in Netlify environment variables (never exposed to the browser)

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
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured on the server" }) };
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

Each script should be 2–5 sentences and feel like something a real person would actually say.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Failed to reach AI service. Please try again." }),
      };
    }

    const data = await response.json();

    // Extract text from Gemini response structure
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Empty response from Gemini");
    }

    // Strip any accidental markdown code fences Gemini sometimes adds
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    const scripts = JSON.parse(cleaned);

    if (!scripts.gentle || !scripts.direct || !scripts.firm) {
      throw new Error("Incomplete scripts returned from AI");
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
    console.error("Function error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong generating your scripts. Please try again." }),
    };
  }
};
