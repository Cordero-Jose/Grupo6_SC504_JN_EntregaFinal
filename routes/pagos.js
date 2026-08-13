// ── Pagos routes ── calls PKG_COMPLEMENTOS.insertar_pago ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all pagos
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_pago, id_factura,
                    TO_CHAR(fecha_pago,'YYYY-MM-DD') AS fecha_pago,
                    monto, metodo_pago, referencia
             FROM Pagos ORDER BY fecha_pago DESC`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insertar pago via PKG_COMPLEMENTOS.insertar_pago
router.post('/', async (req, res) => {
    const { id_pago, id_factura, fecha_pago, monto, metodo_pago, referencia } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_COMPLEMENTOS.insertar_pago(:1,:2,TO_DATE(:3,'YYYY-MM-DD'),:4,:5,:6); END;`,
            [id_pago, id_factura, fecha_pago, monto, metodo_pago, referencia || null]
        );
        // After payment, mark the factura as PAGADA
        await conn.execute(
            `BEGIN PKG_FACTURAS.actualizar_estado_factura(:1,'PAGADA'); END;`,
            [id_factura]
        );
        res.status(201).json({ message: 'Pago registrado y factura marcada como PAGADA' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
