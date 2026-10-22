import type { Env } from "./db";

// Notificaciones opcionales por Telegram (gratuitas). Si no hay credenciales
// configuradas no hace nada. Nunca lanza: una notificación fallida no debe
// interrumpir el motor.
export async function notify(env: Env, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    });
  } catch {
    /* ignorado */
  }
}
