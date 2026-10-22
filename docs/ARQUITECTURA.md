# APEX — Arquitectura y seguridad

## Componentes

```
                    ┌──────────────────────────── Cloudflare (plan gratuito) ───────────────────────────┐
 iPhone (Safari) ──▶│  Worker "apex"                                                                     │
   APEX Control     │   ├─ /            panel estático (public/)                                         │
                    │   ├─ /api/*       API autenticada (sesión) ── controles, estado, informes           │
                    │   ├─ cron */5     APEX Engine: runTick() ──▶ Kraken Futures API pública (precios)   │
                    │   └─ cron día 1   informe mensual                                                  │
                    │  D1 (SQLite)      estado, órdenes, operaciones, decisiones, eventos, informes      │
                    └────────────────────────────────────────────────────────────────────────────────────┘
                                 ▲ /api/research (token)
 GitHub Actions ─────────────────┘  aprendizaje semanal (walk-forward, Monte Carlo) · vigilante cada 6 h
                                    CI con pruebas · despliegue · descarga de datos
```

- **`src/core/`** — núcleo puro y determinista: indicadores, estrategias, motor de riesgo, máquina de estados (`processHour`), backtest, métricas, walk-forward y criterios de aceptación. Lo usan **igual** el motor en producción y la investigación: lo que se prueba es lo que se ejecuta.
- **`src/worker/`** — el Worker: ciclo del motor (`engine.ts`), API y controles (`index.ts`), autenticación (`auth.ts`), datos de Kraken (`market.ts`), aprendizaje (`learning.ts`), informes (`reports.ts`).
- **`public/`** — panel para iPhone (HTML/CSS/JS sin dependencias externas, instalable en la pantalla de inicio).
- **`research/`** — investigación (`run.ts`), ciclo semanal (`learn.ts`), descarga de datos (`fetch/`), datos (`data/`) y resultados (`out/`).

## Ciclo del motor (cada 5 minutos)

1. Toma un **bloqueo** en la base de datos (evita dos ciclos simultáneos).
2. Lee el precio, el índice y el funding de Kraken (`PF_XBTUSD`). Sin datos, no opera y registra el error.
3. Si hay un cambio de estrategia aprobado y **no hay posición abierta**, lo aplica.
4. Procesa cada vela de 1 h cerrada desde la última procesada (idempotente: una vela nunca se procesa dos veces):
   stop de protección contra el rango de la vela → funding → control de caída del 20 % → decisión de la estrategia al cierre de su vela (1 d) → validación del motor de riesgo → ejecución simulada.
5. Comprueba el stop con el último precio entre cierres.
6. Ejecuta una parada de emergencia pendiente, si la hay.
7. Guarda **todo en una única transacción** (estado, órdenes, operaciones, decisiones, eventos, latido). Si algo falla, no se guarda nada a medias y el siguiente ciclo lo reintenta.

## Controles de riesgo independientes

`src/core/risk.ts` vuelve a calcular cada orden desde cero y la rechaza si:

| Regla | Valor |
|---|---|
| Apalancamiento tras la orden | ≤ 2x (tope duro, no configurable al alza) |
| Pérdida hasta el stop, con comisiones y deslizamiento | ≤ 1 % del capital |
| Posiciones simultáneas | 1 |
| Caída acumulada (desde el inicial o desde el máximo) | 20 % → suspende nuevas entradas hasta que el propietario lo revise |
| Stop de protección | obligatorio y en el lado correcto |
| Datos de mercado | con menos de 2 h 10 min de antigüedad |
| Precio de ejecución | dentro del 3 % del índice de Kraken (fuente independiente) |
| Órdenes por día | ≤ 12 |
| Modo real | bloqueado salvo secreto de despliegue `LIVE_TRADING_APPROVED`; el panel no puede activarlo |

- **Sin martingala:** el tamaño solo depende del capital vigente y de la distancia al stop; tras pérdidas, el tamaño baja.
- **Sin cambios durante una operación:** los límites de riesgo y la estrategia no se pueden cambiar con una posición abierta.
- **Sin retiradas:** el código no contiene ninguna función de retirada ni de transferencia de fondos.
- **Órdenes sin duplicados:** cada orden tiene un identificador determinista (`T<hora>-<n>-entry/exit`) con clave única en la base de datos; las velas se procesan una sola vez; un bloqueo impide ciclos concurrentes.

## Seguridad

| Medida | Implementación |
|---|---|
| Acceso solo del propietario | contraseña verificada con PBKDF2-SHA256; el hash vive en un secreto del Worker |
| Segundo factor (opcional) | TOTP (RFC 6238) |
| Sesión | token aleatorio de 256 bits en cookie `HttpOnly; Secure; SameSite=Strict`; en la base de datos solo se guarda su SHA-256; caduca a los 30 días |
| Fuerza bruta | 5 intentos fallidos por IP cada 15 minutos |
| CSRF | `SameSite=Strict` + comprobación de origen + cabecera propia en toda petición que cambia estado |
| Cabeceras | CSP estricta (`default-src 'self'`), `frame-ancestors 'none'`, HSTS, `nosniff`, `no-referrer`, `noindex` |
| Secretos | solo en GitHub Secrets y en secretos del Worker; nunca en el código, el panel ni los registros. La URL privada se enmascara en los registros de GitHub |
| Auditoría | cada acción de control, acceso y cambio queda en la tabla `events` |
| Máquina a máquina | el ciclo de aprendizaje usa un token derivado (HMAC) de la contraseña; solo puede enviar resultados de investigación, no controlar el bot |

## Aprendizaje

Cada domingo GitHub Actions descarga datos nuevos y, con el mismo núcleo:

1. Reevalúa las cinco familias con su rejilla de parámetros fija (walk-forward, Monte Carlo, estrés de costes ×2, estabilidad).
2. Prueba variantes nuevas de parámetros. Solo se adoptan si superan los criterios **y** mejoran el Sharpe fuera de muestra en ≥ 0,2 (la exploración aleatoria tiende a sobreajustar: lo comprobamos).
3. Compara las operaciones simuladas del motor con las del backtest sobre los mismos datos de Kraken (control de deriva).
4. Envía todo al Worker, que **vuelve a aplicar los criterios**, lo registra en el historial y programa el cambio de estrategia solo si procede. El cambio se aplica sin posición abierta. Si ninguna estrategia supera los criterios, el motor pasa a modo observación.

## Persistencia y recuperación

- Todo el estado vive en D1. Un reinicio, despliegue o caída no pierde nada (probado en `test/e2e.test.ts`).
- Si el motor deja de ejecutarse durante horas, al volver procesa las velas pendientes: aplica stops y funding con los datos reales, pero no abre posiciones con señales viejas.
- Vigilancia: el panel marca el motor en rojo si no late en 15 minutos; GitHub Actions comprueba `/api/health` cada 6 horas y avisa (correo de GitHub por fallo y Telegram si está configurado).

## Pruebas

`npx vitest run` ejecuta 44 pruebas:

- 32 del núcleo: indicadores, agregación de velas, dimensionado, cada regla del motor de riesgo, stops con hueco, funding, suspensión por caída, idempotencia, **ausencia de sesgo de futuro** (alterar velas futuras no cambia operaciones pasadas), contabilidad exacta y topes duros.
- 12 de extremo a extremo: arrancan el Worker real (workerd + D1) contra un Kraken simulado y comprueban por HTTP el acceso, los controles, el ciclo del motor, el aprendizaje, la apertura de una operación respetando 2x y 1 %, la ausencia de duplicados, la persistencia tras reiniciar, la parada de emergencia, el informe mensual y el cierre de sesión.

## Pendiente para dinero real (fase 2, requiere tu autorización)

La ejecución contra la API privada de Kraken (envío de órdenes con stop en el propio exchange, conciliación de posiciones y saldo) **no está implementada**: no se puede probar sin una cuenta y no forma parte de la fase de paper trading. Se hará y se probará primero en el entorno demo de Kraken cuando lo autorices.
