// Provider credentials stay in the Python backend, never in the browser bundle.
export function isAiApiConfigured() { return true; } // Backend connection enabled; health checked per request.
export function getAiApiConfig() { return { endpoint: '/api/assistant', provider: 'openai', model: 'server-configured', isConfigured: true }; }
export async function callAiChatApi({ prompt, messages = [], context = {} }) {
  const message = String(prompt || '').trim();
  if (!message) throw new Error('Please enter a question.');
  const turns = messages.filter(m => m.text?.trim());
  if (turns.at(-1)?.sender === 'user' && turns.at(-1).text.trim() === message) turns.pop();
  const history = turns.slice(-12).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 8000) }));
  let response;
  try {
    response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history, context }), signal: AbortSignal.timeout(60000) });
  } catch { throw new Error('Cannot reach the Python AI backend. Start it on port 8000 and retry.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : `AI backend request failed (HTTP ${response.status}). Check that the backend is running.`);
  if (!data?.response_text) throw new Error('AI backend returned no reply. Check the Vite proxy and restart the frontend.');
  return { text: data.response_text, action: data.action, source: 'live_api', model: data.provider || 'openai' };
}
