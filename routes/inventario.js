// ── Inventario routes ── calls PKG_INVENTARIO ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all movimientos
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT i.id_movimiento, i.id_producto, p.nombre_producto,
                    i.tipo_movimiento, i.cantidad,
                    TO_CHAR(i.fecha_movimiento,'YYYY-MM-DD') AS fecha_movimiento,
                    i.descripcion
             FROM Inventario i
             JOIN Productos p ON i.id_producto = p.id_producto
             ORDER BY i.fecha_movimiento DESC`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET existencia of a product via PKG_INVENTARIO.obtener_existencia
router.get('/existencia/:id_producto', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN :existencia := PKG_INVENTARIO.obtener_existencia(:id); END;`,
            {
                existencia: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                id: req.params.id_producto
            }
        );
        res.json({ existencia: result.outBinds.existencia });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update movimiento (tipo, cantidad, fecha, descripcion)
router.put('/:id', async (req, res) => {
    const { tipo_movimiento, cantidad, fecha_movimiento, descripcion } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `UPDATE Inventario SET
                tipo_movimiento  = NVL(:1, tipo_movimiento),
                cantidad         = NVL(:2, cantidad),
                fecha_movimiento = NVL(TO_DATE(:3,'YYYY-MM-DD'), fecha_movimiento),
                descripcion      = NVL(:4, descripcion)
             WHERE id_movimiento = :5`,
            [tipo_movimiento || null,
             cantidad !== undefined ? cantidad : null,
             fecha_movimiento || null,
             descripcion !== undefined ? (descripcion || null) : null,
             req.params.id]
        );
        await conn.execute(`COMMIT`);
        res.json({ message: 'Movimiento actualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST registrar movimiento via PKG_INVENTARIO.registrar_movimiento
router.post('/', async (req, res) => {
    const { id_movimiento, id_producto, tipo_movimiento, cantidad, fecha_movimiento, descripcion } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_INVENTARIO.registrar_movimiento(:1,:2,:3,:4,TO_DATE(:5,'YYYY-MM-DD'),:6); END;`,
            [id_movimiento, id_producto, tipo_movimiento, cantidad, fecha_movimiento, descripcion || null]
        );
        res.status(201).json({ message: 'Movimiento registrado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
