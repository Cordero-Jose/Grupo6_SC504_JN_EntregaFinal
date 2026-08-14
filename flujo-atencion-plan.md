# Plan: Flujo Unificado de Atención al Cliente

## Overview

Build a single page (`atencion.html`) that shows the full customer service lifecycle. The same page works for all roles — switching the role-switcher in the sidebar changes what you see and can do. No separate pages, no navigation required.

```
Recepcionista → Mecánico → Cajero
[Cliente+Vehículo+Cita] → [Orden+Servicios+Productos] → [Factura+Pago]
```

The page has **three tab-panels**, one per role. Switching the profile in the sidebar automatically activates the correct tab. The admin sees all three. Each panel shows the items relevant to that role's current work queue, and clicking any item opens its working view inline.

### Key DB facts
- `Citas` → `Ordenes_Servicio` (1-to-1, unique constraint on id_cita)
- `Ordenes_Servicio` → `Detalle_Servicio` (services added to the order)
- `Inventario` tracks product use as SALIDA movements (no separate order-product join table)
- `Ordenes_Servicio` → `Facturas` → `Pagos` (checkout chain)
- `PKG_COMPLEMENTOS.insertar_detalle_servicio` — inserts a service line item
- `PKG_FACTURAS.calcular_total` — applies 13% IVA
- `GET /api/ordenes/:id` already returns `{ orden, detalles[] }`

### Design decisions confirmed
- **Role inference**: The active role comes from the localStorage role-switcher. The `id_usuario` used when creating an order is the first ACTIVO user in the DB whose rol name matches the current role label.
- **Same page for all roles**: switching profile auto-activates the correct tab — Recepcionista sees the intake queue, Mecánico sees open orders, Cajero sees finalizada orders ready to pay.
- **No new DB tables**: products used are logged as Inventario SALIDA movements, services go into Detalle_Servicio.
- **Existing pages unchanged**: `clientes.html`, `ordenes.html`, etc. still work independently.

---

## Sub-Tasks

---

### Sub-Task 1 — New API endpoints needed by the workflow

**Intent:** The workflow page needs a few endpoints that don't exist yet:
1. `POST /api/ordenes/:id/detalles` — add a service line item to an order (calls `PKG_COMPLEMENTOS.insertar_detalle_servicio`)
2. `DELETE /api/ordenes/:id/detalles/:id_detalle` — remove a service line item
3. `GET /api/ordenes/:id/resumen` — returns the order with detalles + totals computed (subtotal sum, IVA 13%, total) — used by Cajero for checkout preview
4. `POST /api/facturas` already exists. `POST /api/pagos` already exists. These are reused as-is.

**Expected Outcomes:**
- `POST /api/ordenes/O001/detalles` with `{ id_detalle, id_servicio, cantidad, precio_unitario }` inserts a row and auto-computes subtotal
- `DELETE /api/ordenes/O001/detalles/DET001` removes the line item
- `GET /api/ordenes/O001/resumen` returns `{ orden, cliente, placa, detalles[], subtotal, impuesto, total }`

**Todo List:**
- [ ] In `routes/ordenes.js`: add `POST /:id/detalles` route using `PKG_COMPLEMENTOS.insertar_detalle_servicio`
- [ ] In `routes/ordenes.js`: add `DELETE /:id/detalles/:id_detalle` route with direct DELETE SQL + COMMIT
- [ ] In `routes/ordenes.js`: add `GET /:id/resumen` route that joins Ordenes_Servicio + Citas + Clientes + Vehiculos + Detalle_Servicio + Servicios and computes totals in SQL

**Relevant Context:**
- `routes/ordenes.js` — existing `GET /:id` shows the join pattern to follow
- `PKG_COMPLEMENTOS.insertar_detalle_servicio(id_detalle, id_orden, id_servicio, cantidad, precio_unitario, subtotal)`
- `nextId` pattern for `DET###` IDs — frontend will generate these
- `PKG_FACTURAS.calcular_total` — or just compute `subtotal * 1.13` directly in the resumen query

**Status:** `[ ] pending`

---

### Sub-Task 2 — Recepcionista Step: "Recibir cliente" panel

**Intent:** When the Recepcionista opens `atencion.html`, they see a 3-step wizard:
1. **Buscar o crear cliente** — search existing clients by name/cedula, or open the existing "Nuevo cliente" flow inline
2. **Buscar o crear vehículo** — filtered to the selected client, or create new
3. **Crear cita** — fecha/hora, observación, estado=CONFIRMADA by default; at the bottom optionally pre-select 1+ services ("motivo de la visita")

On save, the cita is created and the page shows a confirmation card with the cita ID and a "Listo — esperando mecánico" message.

**Expected Outcomes:**
- Recepcionista can complete client intake from one page without navigating to 3 separate pages
- Cita is created with estado=CONFIRMADA
- Optional service pre-selection is stored as the cita observación (free text), NOT yet as Detalle_Servicio (that belongs to the Orden, which the mechanic creates)

**Todo List:**
- [ ] Create `public/atencion.html` with sidebar + role-aware rendering skeleton
- [ ] Step 1 panel: client search (live filter against `/api/clientes`) + "Crear nuevo" button that opens inline the same form fields as `clientes.html`
- [ ] Step 2 panel: vehicle select filtered by client ID + "Crear nuevo" vehicle inline
- [ ] Step 3 panel: datetime-local, observación textarea, estado fixed to CONFIRMADA
- [ ] "Confirmar cita" button calls existing `POST /api/citas`
- [ ] After success: show confirmation card and reset wizard

**Relevant Context:**
- `public/clientes.html` — reuse the same form fields and `POST /api/clientes` call
- `public/vehiculos.html` — reuse `loadVehiculos()` pattern filtering by `ID_CLIENTE`
- `public/citas.html` — reuse `POST /api/citas` body shape
- `app.js` `isAdmin()` / `currentRole()` for role gating

**Status:** `[ ] pending`

---

### Sub-Task 3 — Mecánico Step: "Atender orden" panel

**Intent:** The Mecánico opens `atencion.html` and sees a list of CONFIRMADA citas that have no order yet, plus existing ABIERTA/EN_PROCESO orders assigned to them. Clicking a cita:
1. Auto-creates an order (or opens existing one) — calls `POST /api/ordenes`
2. Shows an **order card** with client name, plate, cita observación
3. Shows a **services cart** — list of `Detalle_Servicio` rows with add/remove controls
   - "Agregar servicio" → searchable dropdown of `/api/servicios` + cantidad field → calls `POST /api/ordenes/:id/detalles`
   - Trash icon per line → calls `DELETE /api/ordenes/:id/detalles/:id_detalle`
4. Shows a **products used** section — shortcut to register inventory SALIDA movements (product + qty + description pre-filled as "Usado en orden OXXX")
5. "Mover a EN_PROCESO" / "Finalizar orden" buttons → `PUT /api/ordenes/:id` with new estado

**Expected Outcomes:**
- Mechanic can open any pending cita, create the order, add services, log product use, and finalize — all from one page
- Order total (sum of Detalle_Servicio subtotals) is shown live as a running tally
- Finalizing the order changes estado to FINALIZADA and the cita to ATENDIDA

**Todo List:**
- [ ] Mechanic panel: fetch citas with estado=CONFIRMADA and no id_orden from `/api/citas`
- [ ] "Abrir orden" button: if order exists load it, else call `POST /api/ordenes` (auto-generate id, use today's date, estado=ABIERTA, id_usuario = first ACTIVO user whose rol matches the current role-switcher selection — fetched via `GET /api/usuarios` filtered client-side)
- [ ] Services cart: `GET /api/ordenes/:id` to load existing detalles; render as editable list
- [ ] "Agregar servicio": select from `/api/servicios`, enter qty, auto-fill precio_unitario from service, compute subtotal, call `POST /api/ordenes/:id/detalles`
- [ ] Remove service: `DELETE /api/ordenes/:id/detalles/:id_detalle` then re-render
- [ ] Products used: reuse `POST /api/inventario` (tipo=SALIDA) with description pre-filled
- [ ] Running total display: sum all detalle subtotals client-side
- [ ] "Finalizar": `PUT /api/ordenes/:id` with estado=FINALIZADA + `PUT /api/citas/:id` with estado=ATENDIDA

**Relevant Context:**
- `routes/ordenes.js` `GET /:id` returns `{ orden, detalles[] }` — use this to load the cart
- New `POST /:id/detalles` from Sub-Task 1
- New `DELETE /:id/detalles/:id_detalle` from Sub-Task 1
- `routes/inventario.js` `POST /` for product SALIDA — already exists

**Status:** `[ ] pending`

---

### Sub-Task 4 — Cajero Step: "Cobrar" panel

**Intent:** The Cajero opens `atencion.html` and sees a list of FINALIZADA orders that have no invoice yet. Clicking one shows a **checkout card**:
- Client name, vehicle plate, order ID
- Line-item breakdown of services (from Detalle_Servicio)
- Subtotal, IVA (13%), **Total**
- Payment method selector (EFECTIVO / TARJETA / SINPE / TRANSFERENCIA)
- Reference field (optional)
- "Cobrar" button

On "Cobrar":
1. `POST /api/facturas` — creates the invoice with computed subtotal/impuesto/total, estado=PENDIENTE
2. `POST /api/pagos` — registers the payment, which auto-marks the invoice as PAGADA
3. Shows a success receipt card with factura ID, total paid, method

**Expected Outcomes:**
- Cajero can complete checkout in one click after reviewing the breakdown
- No manual entry of amounts — all pulled from the order's detalles
- After payment the order disappears from the pending list

**Todo List:**
- [ ] Cajero panel: fetch FINALIZADA orders with no invoice via `GET /api/ordenes?sin_factura=1`
- [ ] Clicking an order calls `GET /api/ordenes/:id/resumen` (Sub-Task 1) to get the full breakdown
- [ ] Render receipt preview: service lines, subtotal, impuesto, total
- [ ] Payment method selector + optional reference input
- [ ] "Cobrar": sequential calls `POST /api/facturas` then `POST /api/pagos`
- [ ] After success: show receipt card, remove order from pending list

**Relevant Context:**
- `GET /api/ordenes?sin_factura=1` — already exists in `routes/ordenes.js`
- New `GET /:id/resumen` from Sub-Task 1
- `routes/facturas.js` `POST /` — body: `{ id_factura, id_orden, fecha_emision, subtotal, impuesto, total, estado }`
- `routes/pagos.js` `POST /` — body: `{ id_pago, id_factura, fecha_pago, monto, metodo_pago, referencia }` — also auto-marks factura as PAGADA

**Status:** `[ ] pending`

---

### Sub-Task 5 — Navigation & Role Routing

**Intent:** Add `atencion.html` to the sidebar for all roles and make each role land on their relevant step automatically.

**Expected Outcomes:**
- All roles see "Atención" in their sidebar
- Opening the page shows the correct panel based on `currentRole()`:
  - RECEPCIONISTA → Step 2 (intake wizard) visible by default
  - MECANICO → Step 3 (order/cart) visible by default
  - CAJERO → Step 4 (checkout) visible by default
  - ADMINISTRADOR → sees all three panels / a tab switcher

**Todo List:**
- [ ] Add `atencion.html` to `_ROLES` pages list for all four roles in `app.js`
- [ ] Add "Atención al cliente" link in the sidebar `<nav>` of every existing HTML page
- [ ] On page load, auto-select the active tab based on `currentRole()`

**Relevant Context:**
- `public/app.js` `_ROLES` object — add `atencion.html` to each role's pages array
- All existing HTML files share the same sidebar nav structure — update all of them

**Status:** `[ ] pending`
