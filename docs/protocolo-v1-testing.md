# Plan de Pruebas — Protocolo Operativo v1.0

> Fecha de generación: 2026-06-08  
> Proyecto: solicitudes.mercadoelineas.com  
> Plataforma: Base44 · Supabase · React 18

---

## Índice de cambios implementados

| ID | Componente | Descripción | Archivo(s) |
|----|-----------|-------------|-----------|
| R1 | Regla 1 | 11 tipos de solicitud con prioridad sugerida y tooltip de ayuda | `RequestModals.jsx` |
| R2 | Regla 2 | 9 estados con transiciones validadas en frontend y DB | `requestService.jsx`, `KanbanBoard.jsx`, `valid_transitions` (DB) |
| R3 | Regla 3 | SLA P1–P4 con cálculo por horas y semáforo visual | `slaUtils.js`, `sla_config` (DB), `sla_status_view` (DB) |
| R4 | Regla 4 | Ciclo de vida visual en modal de detalle | `RequestModals.jsx` → `LifecycleBar` |
| R5 | Regla 5 | Campo origen (WhatsApp/Presencial/Email/Web) | `RequestModals.jsx`, `Requests.jsx` |
| R6 | Regla 6 | Detección y alerta de reincidencia de incidentes (>2 en 30 días) | `Incidents.jsx`, trigger `trg_incident_recurrence` (DB) |
| MA | Mejora A | Semáforo SLA en tabla, kanban y cards | `RequestsTable.jsx`, `KanbanBoard.jsx`, `Requests.jsx` |
| MB | Mejora B | Formulario simplificado + confirmación + página pública `/track/:token` + emails | `RequestModals.jsx`, `TrackRequest.jsx`, `App.jsx`, `emailNotifications.jsx` |
| MD | Mejora D | Heatmap de cobertura 24/7 de guardias (7 días × 24h en bloques de 4h) | `Guards.jsx` → `CoverageHeatmap` |

---

## Casos de prueba por regla

### R1 — Tipos de solicitud y prioridad sugerida

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| 1.1 | Crear nueva solicitud → seleccionar "Reparación / Bug" | Prioridad se auto-completa a "P1 — Crítica" |
| 1.2 | Seleccionar "Mantenimiento" | Prioridad se auto-completa a "P4 — Baja" |
| 1.3 | Seleccionar "Nueva Implementación" | Aparece hint: "Requiere análisis previo..." |
| 1.4 | Cambiar tipo a "Consulta o Asesoría" | Hint: "Se responderá en ≤ 24h" |
| 1.5 | Verificar que los 11 tipos aparecen en el dropdown | Todos visibles sin duplicados |

### R2 — Estados y transiciones

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| 2.1 | Kanban: arrastrar de "Pendiente" → "Finalizado" | Toast de error: transición no permitida |
| 2.2 | Kanban: arrastrar de "En Proceso" → "En Validación" | Abre modal de evidencia antes de mover |
| 2.3 | Kanban: arrastrar de "Finalizado" → cualquier estado | Toast de error: estado terminal |
| 2.4 | Crear solicitud → verificar estado inicial | Estado = "Pendiente" |
| 2.5 | Botón "Atender" en solicitud Pendiente | Cambia a "En Proceso" y registra `started_at` |
| 2.6 | Botón "Enviar a validación" en "En Proceso" | Abre modal de evidencia |
| 2.7 | Admin: "Aprobar y Finalizar" en "En Validación" | Estado → "Finalizado", se registra `completion_date` |

### R3 — SLA y semáforo

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| 3.1 | Ver tabla de solicitudes → columna SLA | Barra de progreso con color: verde/amarillo/rojo |
| 3.2 | Solicitud P1 creada hace >9h sin resolver | Semáforo = rojo pulsante, badge "⚠ Vencida" |
| 3.3 | Solicitud P4 activa | Columna SLA muestra "—" (sin límite) |
| 3.4 | Solicitud "Finalizado" | Columna SLA muestra "—" (cerrada) |
| 3.5 | Tarjeta kanban: solicitud con SLA > 80% | Barra roja bajo la tarjeta |
| 3.6 | Card de solicitud en Requests: SLA vencida | Punto rojo pulsante junto al título |

### R4 — Ciclo de vida visual

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| 4.1 | Abrir detalle de solicitud "En Proceso" | `LifecycleBar` muestra 2 pasos activos (Pendiente ✓, En Proceso activo) |
| 4.2 | Solicitud "Finalizado" | Todos los pasos marcados con ✓ en verde |
| 4.3 | Solicitud "Cancelado" | Banner especial 🚫 en lugar de barra de progreso |
| 4.4 | Solicitud "Retrasado" | Paso "En Proceso" pulsa en rojo con etiqueta "⚠ Retrasado" |
| 4.5 | Solicitud con historial | Cada paso muestra la fecha real en que se alcanzó |

### R5 — Campo Origen

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| 5.1 | Crear nueva solicitud → seleccionar "WhatsApp" | Botón se activa en azul |
| 5.2 | Guardar solicitud con origen seleccionado | Card muestra "💬 WhatsApp" en tags |
| 5.3 | Abrir detalle → pestaña Resumen | Fila "Origen" muestra el canal con ícono |
| 5.4 | Crear sin seleccionar origen | Se guarda sin error, origen = null |
| 5.5 | Editar solicitud existente → cambiar origen | Se actualiza correctamente |

### R6 — Reincidencia de incidentes

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| 6.1 | Crear 3+ incidentes del mismo departamento en <30 días | `recurrence_count` se incrementa automáticamente (DB trigger) |
| 6.2 | Ver lista de incidencias | Badge rojo "⟳ Reincidente ×N" en cards con count ≥ 2 |
| 6.3 | KPI "Reincidentes" | Muestra conteo correcto |
| 6.4 | Clic en KPI Reincidentes | Activa filtro, solo muestra incidencias recurrentes |
| 6.5 | Botón "⟳ Reincidentes" en filtros | Alterna filtro on/off |
| 6.6 | Crear incidente con departamento que ya tiene 2+ activos | Aparece alerta en el formulario antes de enviar |
| 6.7 | Hay ≥3 incidentes recurrentes y usuario es staff | Banner naranja en la lista |

### MA — Semáforo SLA

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| A.1 | Tabla de solicitudes | Columna SLA con barra y porcentaje |
| A.2 | Solicitud P2 en estado "En Proceso" a las 5h de 9h de SLA | Semáforo amarillo (55%) |
| A.3 | Solicitud SLA vencida en tabla | Punto rojo pulsante en columna Título |

### MB — Formulario simplificado y tracking público

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| B.1 | Login como `employee` → crear solicitud | Formulario muestra solo: título, descripción, tipo, urgencia, canal, departamento |
| B.2 | Login como `support` → crear solicitud | Formulario completo con P1–P4, dificultad, horas, fecha compromiso |
| B.3 | `employee` selecciona urgencia "Urgente" | Mapeado internamente a prioridad "P2 — Alta" |
| B.4 | `employee` selecciona urgencia "Crítico" | Mapeado a "P1 — Crítica" |
| B.5 | Guardar solicitud como cualquier rol | Pantalla de confirmación con Ticket #XXXXXXXX + enlace tracking |
| B.6 | Clic "Copiar enlace" en confirmación | URL copiada al clipboard |
| B.7 | Abrir `/track/{public_token}` sin login | Página pública con estado, historial, datos básicos |
| B.8 | `/track/token-invalido` | Pantalla "Solicitud no encontrada" |
| B.9 | Cambiar estado a "En Proceso" vía Kanban | Solicitante recibe email "🔧 Tu solicitud está en proceso" |
| B.10 | Cambiar estado a "Requiere Información" | Solicitante recibe email "⚠️ Tu solicitud requiere información" |
| B.11 | Cambiar estado a "Finalizado" | Solicitante recibe email "✅ Solicitud finalizada" |

### MD — Cobertura 24/7 de guardias

| # | Pasos | Resultado esperado |
|---|-------|-------------------|
| D.1 | Ir a módulo Guardias como admin/support | Heatmap visible con 7 filas (días) × 6 columnas (bloques de 4h) |
| D.2 | Sin guardias creadas | Todas las celdas rojas, cobertura 0% |
| D.3 | Crear guardia de 08:00 a 17:00 hoy | Celdas 08h, 12h del día actual se vuelven verdes |
| D.4 | Guardia activa "ahora" | Celda actual tiene borde azul |
| D.5 | 2 guardias overlapping en el mismo bloque | Celda verde oscuro con número "2" |
| D.6 | Porcentaje cobertura | Se calcula como (bloques cubiertos / 42 total) × 100 |
| D.7 | Hover sobre celda cubierta | Tooltip con nombre del técnico |
| D.8 | Login como `employee` | Heatmap NO visible (solo admins/techs) |

---

## Checklist de regresión general

- [ ] Build sin errores (`npm run build`)
- [ ] No hay referencias a estados viejos: "En progreso", "Finalizada", "Rechazada", "Pendiente aprobación"
- [ ] No hay referencias a prioridades viejas: "Alta", "Media", "Baja" (sin prefijo P)
- [ ] Todas las transiciones de estado respetan el protocolo v1.0
- [ ] La página `/track/:token` no redirige al login
- [ ] La página `/login` redirige al dashboard si ya está autenticado
- [ ] Los emails no fallan si `requester_id` es null
- [ ] `ClassifyModal` muestra P1–P4 (no Alta/Media/Baja)
- [ ] `export default function Guards` renderiza sin error con 0 guardias

---

## Notas de implementación

### Columna `origin` en DB
La migración SQL ya incluyó `ADD COLUMN IF NOT EXISTS origin TEXT` en requests. Si la columna aún no existe en producción, ejecutar:
```sql
ALTER TABLE requests ADD COLUMN IF NOT EXISTS origin TEXT;
```

### Columna `public_token` en DB
Ya incluida en la migración principal. Para verificar:
```sql
SELECT id, public_token FROM requests LIMIT 5;
```
Si `public_token` es null en registros existentes, ejecutar:
```sql
UPDATE requests SET public_token = encode(gen_random_bytes(16), 'hex') WHERE public_token IS NULL;
```

### Columna `recurrence_count` en DB
Ya incluida. El trigger `trg_incident_recurrence` solo se dispara en INSERT, no en UPDATE. Los registros existentes tendrán `recurrence_count = 0`.

### SLA en frontend vs DB
- **Frontend** (`slaUtils.js`): cálculo en horas de calendario (aproximación). Usado para UI en tiempo real.
- **DB** (`sla_status_view`): cálculo exacto en horas hábiles (09:00–18:00, Lun–Sáb). Usado para reportes.
