import { readFileSync } from 'node:fs';

// Vite preview does not apply Cloudflare's _headers. Apply the artifact's global
// headers in browser QA so the actual demo's CSP is exercised before deployment.
const headers = {};
if (process.env.SL_BROWSER_DIST === 'dist-demo') {
  for (const line of readFileSync(new URL('../dist-demo/_headers', import.meta.url), 'utf8')
    .split('\n')
    .slice(1)) {
    if (!line.startsWith('  ')) break;
    const at = line.indexOf(':');
    headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
}
export async function continueLocal(route) {
  if (!Object.keys(headers).length) return route.continue();
  const response = await route.fetch();
  return route.fulfill({ response, headers: { ...response.headers(), ...headers } });
}
