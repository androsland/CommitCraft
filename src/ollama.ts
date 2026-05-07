import * as http from 'http';
import * as https from 'https';

function httpRequest(url: string, method: 'GET' | 'POST', body?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const opts: http.RequestOptions = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? '443' : '80'),
      path: u.pathname,
      method,
      headers: body
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        : {},
    };
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', (c: string) => (raw += c));
      res.on('end', () => resolve(raw));
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

export async function isOllamaRunning(host: string): Promise<boolean> {
  try {
    await httpRequest(`${host}/api/tags`, 'GET');
    return true;
  } catch {
    return false;
  }
}

export async function getOllamaModels(host: string): Promise<string[]> {
  const raw = await httpRequest(`${host}/api/tags`, 'GET');
  const data = JSON.parse(raw) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name);
}

export async function callOllama(host: string, model: string, prompt: string): Promise<string> {
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  });
  const raw = await httpRequest(`${host}/api/chat`, 'POST', body);
  const data = JSON.parse(raw) as { message: { content: string } };
  return data.message.content.trim();
}
