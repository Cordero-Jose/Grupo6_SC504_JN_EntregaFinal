// ── Ordenes de Servicio routes ── calls PKG_ORDENES ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all ordenes
// Pass ?sin_factura=1 to return only FINALIZADA orders that have no invoice yet
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        let sql = `SELECT o.id_orden, o.id_cita, o.id_usuario, u.nombre AS mecanico,
                    TO_CHAR(o.fecha_apertura,'YYYY-MM-DD') AS fecha_apertura,
                    o.estado, o.observaciones,
                    c.nombre AS cliente, v.placa
             FROM Ordenes_Servicio o
             JOIN Citas ci ON o.id_cita = ci.id_cita
             JOIN Clientes c ON ci.id_cliente = c.id_cliente
             JOIN Vehiculos v ON ci.id_vehiculo = v.id_vehiculo
             JOIN Usuarios u ON o.id_usuario = u.id_usuario`;
        if (req.query.sin_factura === '1') {
            sql += ` WHERE o.estado = 'FINALIZADA'
                     AND NOT EXISTS (SELECT 1 FROM Facturas f WHERE f.id_orden = o.id_orden)`;
        }
        sql += ` ORDER BY o.fecha_apertura DESC`;
        const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET orden resumen (subtotal, impuesto, total) for checkout
// Must be defined before /:id so Express does not match id="resumen"
router.get('/:id/resumen', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const orden = await conn.execute(
            `SELECT o.id_orden, o.id_cita, o.estado,
                    c.nombre AS cliente, v.placa
             FROM Ordenes_Servicio o
             JOIN Citas ci ON o.id_cita = ci.id_cita
             JOIN Clientes c ON ci.id_cliente = c.id_cliente
             JOIN Vehiculos v ON ci.id_vehiculo = v.id_vehiculo
             WHERE o.id_orden = :id`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (orden.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        // Service lines from Detalle_Servicio
        const srvRows = await conn.execute(
            `SELECT s.nombre_servicio AS nombre,
                    d.cantidad,
                    CASE WHEN d.precio_unitario > 0 THEN d.precio_unitario ELSE s.precio_base END AS precio_unitario,
                    d.cantidad * CASE WHEN d.precio_unitario > 0 THEN d.precio_unitario ELSE s.precio_base END AS subtotal,
                    'SERVICIO' AS tipo
             FROM Detalle_Servicio d
             JOIN Servicios s ON d.id_servicio = s.id_servicio
             WHERE d.id_orden = :id ORDER BY d.id_detalle`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Product lines from Inventario SALIDA movements linked to this order
        const prodRows = await conn.execute(
            `SELECT p.nombre_producto AS nombre,
                    i.cantidad,
                    p.precio_unitario,
                    i.cantidad * p.precio_unitario AS subtotal,
                    'PRODUCTO' AS tipo
             FROM Inventario i
             JOIN Productos p ON i.id_producto = p.id_producto
             WHERE i.tipo_movimiento = 'SALIDA'
               AND i.descripcion LIKE :1`,
            [`%orden ${req.params.id}%`], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const detalles = [...srvRows.rows, ...prodRows.rows];
        const subtotal  = detalles.reduce((s, d) => s + Number(d.SUBTOTAL), 0);
        const impuesto  = Math.round(subtotal * 0.13 * 100) / 100;
        const total     = Math.round((subtotal + impuesto) * 100) / 100;
        res.json({ orden: orden.rows[0], detalles, subtotal, impuesto, total });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET one orden with detalles
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const orden = await conn.execute(
            `SELECT id_orden, id_cita, id_usuario,
                    TO_CHAR(fecha_apertura,'YYYY-MM-DD') AS fecha_apertura,
                    estado, observaciones
             FROM Ordenes_Servicio WHERE id_orden = :id`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (orden.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const detalles = await conn.execute(
            `SELECT d.id_detalle, d.id_servicio, s.nombre_servicio,
                    d.cantidad, d.precio_unitario, d.subtotal
             FROM Detalle_Servicio d
             JOIN Servicios s ON d.id_servicio = s.id_servicio
             WHERE d.id_orden = :id ORDER BY d.id_detalle`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json({ orden: orden.rows[0], detalles: detalles.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insert orden via PKG_ORDENES.insertar_orden
router.post('/', async (req, res) => {
    const { id_orden, id_cita, id_usuario, fecha_apertura, estado, observaciones } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_ORDENES.insertar_orden(:1,:2,:3,TO_DATE(:4,'YYYY-MM-DD'),:5,:6); END;`,
            [id_orden, id_cita, id_usuario, fecha_apertura, estado || 'ABIERTA', observaciones || null]
        );
        res.status(201).json({ message: 'Orden creada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update orden (estado, observaciones)
router.put('/:id', async (req, res) => {
    const { estado, observaciones } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_ORDENES.actualizar_estado_orden(:1,:2); END;`,
            [req.params.id, estado]
        );
        if (observaciones !== undefined) {
            await conn.execute(
                `UPDATE Ordenes_Servicio SET observaciones = :1 WHERE id_orden = :2`,
                [observaciones || null, req.params.id]
            );
            await conn.execute(`COMMIT`);
        }
        res.json({ message: 'Orden actualizada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// DELETE via PKG_ORDENES.eliminar_orden
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_ORDENES.eliminar_orden(:1); END;`,
            [req.params.id]
        );
        res.json({ message: 'Orden eliminada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST add a detalle to an orden
router.post('/:id/detalles', async (req, res) => {
    const { id_detalle, id_servicio, cantidad, precio_unitario } = req.body;
    const ordenId = req.params.id;
    let conn;
    try {
        conn = await getConnection();
        const subtotal = Math.round(Number(cantidad) * Number(precio_unitario) * 100) / 100;
        await conn.execute(
            `INSERT INTO Detalle_Servicio
             (id_detalle, id_orden, id_servicio, cantidad, precio_unitario, subtotal)
             VALUES (:1, :2, :3, :4, :5, :6)`,
            [id_detalle, ordenId, id_servicio, Number(cantidad), Number(precio_unitario), subtotal]
        );
        await conn.execute(`COMMIT`);
        res.status(201).json({ message: 'Detalle agregado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// DELETE remove a detalle from an orden
router.delete('/:id/detalles/:detId', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `DELETE FROM Detalle_Servicio WHERE id_detalle = :1 AND id_orden = :2`,
            [req.params.detId, req.params.id]
        );
        await conn.execute(`COMMIT`);
        res.json({ message: 'Detalle eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
