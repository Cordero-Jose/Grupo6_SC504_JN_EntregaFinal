// ── Facturas routes ── calls PKG_FACTURAS ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all facturas via VW_FACTURAS_PAGOS
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_factura, id_orden,
                    TO_CHAR(fecha_emision,'YYYY-MM-DD') AS fecha_emision,
                    subtotal, impuesto, total, estado,
                    id_pago, TO_CHAR(fecha_pago,'YYYY-MM-DD') AS fecha_pago,
                    monto, metodo_pago
             FROM VW_FACTURAS_PAGOS ORDER BY fecha_emision DESC`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET calcular total con impuesto via PKG_FACTURAS.calcular_total
router.get('/calcular/:subtotal', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN :total := PKG_FACTURAS.calcular_total(:sub); END;`,
            {
                total: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                sub: parseFloat(req.params.subtotal)
            }
        );
        res.json({ total: result.outBinds.total });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET one factura
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_factura, id_orden,
                    TO_CHAR(fecha_emision,'YYYY-MM-DD') AS fecha_emision,
                    subtotal, impuesto, total, estado
             FROM Facturas WHERE id_factura = :id`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insert factura via PKG_FACTURAS.insertar_factura
router.post('/', async (req, res) => {
    const { id_factura, id_orden, fecha_emision, subtotal, impuesto, total, estado } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_FACTURAS.insertar_factura(:1,:2,TO_DATE(:3,'YYYY-MM-DD'),:4,:5,:6,:7); END;`,
            [id_factura, id_orden, fecha_emision, subtotal, impuesto, total, estado || 'PENDIENTE']
        );
        res.status(201).json({ message: 'Factura creada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update estado factura via PKG_FACTURAS.actualizar_estado_factura
router.put('/:id', async (req, res) => {
    const { estado } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_FACTURAS.actualizar_estado_factura(:1,:2); END;`,
            [req.params.id, estado]
        );
        res.json({ message: 'Estado de factura actualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
