// Idempotent account-level prerequisite. Worker, assets and DO migrations live in wrangler.jsonc.
// API: https://developers.cloudflare.com/api/resources/workers/subresources/subdomains/methods/update/
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const desired = JSON.parse(
  await readFile(new URL("../infra/cloudflare.json", import.meta.url), "utf8"),
);
let token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  try {
    // Wrangler refreshes expired OAuth sessions and supports OS keychain/named profiles.
    // Capture credentials in memory; never forward subprocess output to deployment logs.
    const output = execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url)), 'auth', 'token', '--json'], {encoding:'utf8',stdio:['ignore','pipe','pipe']});
    token = JSON.parse(output).token;
  } catch { /* actionable, credential-free error below */ }
}
if (!token)
  throw new Error("Run npm run cf:login, or provide CLOUDFLARE_API_TOKEN.");
async function api(method, body) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${desired.accountId}/workers/subdomain`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  return r.json();
}
let current = await api("GET");
if (!current.success) {
  if (!current.errors?.some((e) => e.code === 10007))
    throw new Error(JSON.stringify(current.errors));
  current = await api("PUT", { subdomain: desired.workersSubdomain });
  if (!current.success) throw new Error(JSON.stringify(current.errors));
}
if (current.result.subdomain !== desired.workersSubdomain)
  throw new Error(
    `Existing subdomain ${current.result.subdomain} differs from infra/cloudflare.json; refusing to rename account-wide URLs.`,
  );
console.log(`Workers subdomain ready: ${current.result.subdomain}.workers.dev`);
