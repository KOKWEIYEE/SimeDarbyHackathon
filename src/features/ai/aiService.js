// The browser sends no provider credentials; server.js owns the OpenAI connection.
export const AI_CONFIG = { endpoint: '/api/chat', healthEndpoint: '/api/health' };
export function isAiApiConfigured() { return true; }
export function getAiApiConfig() { return {isConfigured:true,isBackendSecured:true,provider:'backend-proxy',...AI_CONFIG}; }
export async function callAiChatApi({prompt,messages=[],context={}}) {
 const question=String(prompt || '').trim();
 if (!question) throw new Error('Please enter a message.');
 const history=messages.filter(m=>['user','bot'].includes(m.sender)&&m.text&&m.id!==1);
 if (history.at(-1)?.sender==='user' && history.at(-1).text===question) history.pop();
 const res=await fetch(AI_CONFIG.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(55000),body:JSON.stringify({prompt:question,messages:history.slice(-12),context})});
 const data=await res.json().catch(()=>null);
 if(!res.ok) throw new Error(data?.error || `AI request failed (HTTP ${res.status}).`);
 if(!data?.text) throw new Error('AI returned no reply. Please retry.');
 return data;
}
