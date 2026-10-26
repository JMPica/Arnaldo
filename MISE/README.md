# MISE — Private Chef OS · paquete de desarrollo para Claude Code

**Empieza por [`00_EMPIEZA_AQUI.md`](00_EMPIEZA_AQUI.md).**

El paquete contiene la aplicación local v1 original intacta y los materiales de trabajo para convertirla en una web privada de producción. No es una aplicación online ya desplegada, y no requiere un ZIP diferente para ejecutarse en Claude Code.

La misión, reglas automáticas y especificaciones están en `01_MENSAJE_PARA_CLAUDE_CODE.md`, `CLAUDE.md` y `docs/`. Para comprobar la entrega original sin instalar nada:

```bash
python3 scripts/verificar_paquete.py
```

**Objetivo:** mayor autonomía posible de Claude Code sin sacrificar seguridad, costes controlados ni pruebas ejecutadas. Para autenticación Cloudflare y publicación se necesita autorización humana de cuenta y, si procede, de gasto.
