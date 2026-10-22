// Genera el hash PBKDF2 de la contraseña del propietario en el formato que
// verifica el Worker. Lee la contraseña de la variable APEX_PASSWORD (nunca
// de la línea de comandos, para que no quede en el historial ni en los logs).
import { webcrypto as crypto } from "node:crypto";
const pw = process.env.APEX_PASSWORD ?? "";
if (pw.length < 12) {
  console.error("APEX_PASSWORD debe tener al menos 12 caracteres");
  process.exit(1);
}
const iterations = 20000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
const b64 = (a) => Buffer.from(a).toString("base64");
process.stdout.write(`pbkdf2:${iterations}:${b64(salt)}:${b64(bits)}`);
