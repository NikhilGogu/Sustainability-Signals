export async function onRequest(context) {
    // 1. Handle CORS Preflight
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    }

    // 2. Only allow POST
    if (context.request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const { messages, context: pdfContext } = await context.request.json();
        const apiKey = context.env.GOOGLE_API_KEY;

        if (!apiKey) {
            return new Response('Missing API Key configuration', { status: 500 });
        }

        if (!messages || !Array.isArray(messages)) {
            return new Response('Invalid messages format', { status: 400 });
        }

        // 3. Construct Gemini API Request
        // We use gemini-1.5-flash for speed and large context window
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // Prepare the conversation history
        // Gemini expects: contents: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // Add the PDF context as a system instruction or correctly injected context
        // For Gemini 1.5, we can use the `system_instruction` field for the context + persona
        const systemInstruction = {
            parts: [{
                text: `You are an intelligent assistant helping a user analyze a sustainability report. 
Here is the text content of the document they are viewing:

<document_context>
${pdfContext}
</document_context>

Answer their questions based MAINLY on this document. If the specific answer isn't in the document, say so.`
            }]
        };

        const payload = {
            contents,
            system_instruction: systemInstruction,
            generationConfig: {
                temperature: 0.3, // Lower temperature for more factual responses
            }
        };

        // 4. Call Gemini API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('No content generated');
        }

        // 5. Return response
        return new Response(JSON.stringify({ response: generatedText }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
