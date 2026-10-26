# API funcional mínima — propuesta, no contrato implementado

Todos los endpoints requieren identidad validada en servidor, salvo health interno que no revela datos.

- `GET /api/v1/me`: identidad autenticada (sin secretos).
- `GET|POST /api/v1/ingredients`, `GET|PATCH|DELETE /api/v1/ingredients/:id` (DELETE lógico si referenciado).
- `GET|POST /api/v1/suppliers`, `GET|PATCH /api/v1/suppliers/:id`.
- `GET|POST /api/v1/purchase-formats`, `GET /api/v1/price-history`, `POST /api/v1/price-history`.
- `GET|POST /api/v1/recipes`, `GET|PATCH /api/v1/recipes/:id`, `POST /api/v1/recipes/:id/duplicate`.
- `GET|POST /api/v1/menus`, `GET|PATCH /api/v1/menus/:id`.
- `GET|POST /api/v1/clients`, `GET|PATCH /api/v1/clients/:id`.
- `GET|POST /api/v1/events`, `GET|PATCH /api/v1/events/:id`, `POST /api/v1/events/:id/quote`, `POST /api/v1/events/:id/confirm`, `POST /api/v1/events/:id/complete`.
- `GET /api/v1/events/:id/cost-breakdown`, `GET /api/v1/events/:id/quote.pdf`, `GET /api/v1/events/:id/internal-report.pdf`.
- `GET|POST /api/v1/purchases`, `POST /api/v1/purchases/:id/receive` (idempotency header/body token).
- `GET /api/v1/stock`, `POST /api/v1/stock/adjust`, `GET /api/v1/shopping-lists?events=id,id`.
- `POST /api/v1/exports`, `POST /api/v1/imports/preview`, `POST /api/v1/imports/commit` (con tx + backup).
- `POST /api/v1/documents` (opcional P1), `GET /api/v1/documents/:id/file`, `POST /api/v1/documents/:id/review`.

**Notas:** esquemas Zod/server-side, errores estructurados, GET sin mutaciones, páginas de tamaño limitado, deduplicación, HTTPS, CSRF y versionado. Al usuario no se le pide diseñar API: Claude debe escoger y probar detalles.
