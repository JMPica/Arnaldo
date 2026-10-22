// Prepara Cloudflare para el despliegue (lo ejecuta GitHub Actions):
//  - obtiene el subdominio workers.dev de la cuenta (y lo enmascara en los logs),
//  - crea la base de datos D1 "apex" si no existe y escribe su id en wrangler.toml.
// Variables: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) throw new Error("faltan CLOUDFLARE_API_TOKEN o CLOUDFLARE_ACCOUNT_ID");
const api = async (path, init = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const j = await r.json();
  if (!j.success) throw new Error(`${path}: ${JSON.stringify(j.errors)}`);
  return j.result;
};

let sub = null;
try {
  sub = (await api("/workers/subdomain")).subdomain;
} catch (e) {
  console.log("::warning::La cuenta no tiene subdominio workers.dev todavía. Abre Workers & Pages en el panel de Cloudflare una vez para activarlo.");
}
if (sub) {
  console.log(`::add-mask::${sub}`);
  const url = `https://apex.${sub}.workers.dev`;
  console.log(`::add-mask::${url}`);
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `APEX_URL=${url}\n`);
}

const dbs = await api("/d1/database?name=apex");
let db = dbs.find((d) => d.name === "apex");
if (!db) db = await api("/d1/database", { method: "POST", body: JSON.stringify({ name: "apex" }) });
const toml = readFileSync("wrangler.toml", "utf8").replace(/database_id = "[^"]*"/, `database_id = "${db.uuid}"`);
writeFileSync("wrangler.toml", toml);
console.log("Base de datos D1 lista");
