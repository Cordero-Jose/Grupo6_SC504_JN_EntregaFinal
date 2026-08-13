// ── Citas routes ── calls PKG_CITAS ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all citas via VW_CITAS_ORDENES
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_cita, id_cliente, cliente, id_vehiculo, placa,
                    TO_CHAR(fecha_hora,'YYYY-MM-DD HH24:MI') AS fecha_hora,
                    estado_cita, observacion, id_orden,
                    TO_CHAR(fecha_apertura,'YYYY-MM-DD') AS fecha_apertura,
                    estado_orden
             FROM VW_CITAS_ORDENES ORDER BY fecha_hora DESC`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET one cita
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_cita, id_cliente, id_vehiculo,
                    TO_CHAR(fecha_hora,'YYYY-MM-DD HH24:MI') AS fecha_hora,
                    estado, observacion FROM Citas WHERE id_cita = :id`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insert via PKG_CITAS.insertar_cita
router.post('/', async (req, res) => {
    const { id_cita, id_cliente, id_vehiculo, fecha_hora, estado, observacion } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_CITAS.insertar_cita(:1,:2,:3,TO_DATE(:4,'YYYY-MM-DD HH24:MI'),:5,:6); END;`,
            [id_cita, id_cliente, id_vehiculo, fecha_hora, estado || 'PENDIENTE', observacion || null]
        );
        res.status(201).json({ message: 'Cita creada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update cita (fecha_hora, estado, observacion)
router.put('/:id', async (req, res) => {
    const { estado, fecha_hora, observacion } = req.body;
    let conn;
    try {
        conn = await getConnection();
        // Always update estado
        await conn.execute(
            `BEGIN PKG_CITAS.actualizar_estado_cita(:1,:2); END;`,
            [req.params.id, estado]
        );
        // Update fecha_hora and observacion directly if provided
        if (fecha_hora !== undefined || observacion !== undefined) {
            await conn.execute(
                `UPDATE Citas SET
                    fecha_hora  = NVL(TO_DATE(:1,'YYYY-MM-DD HH24:MI'), fecha_hora),
                    observacion = NVL(:2, observacion)
                 WHERE id_cita = :3`,
                [fecha_hora || null, observacion !== undefined ? (observacion || null) : null, req.params.id]
            );
            await conn.execute(`COMMIT`);
        }
        res.json({ message: 'Cita actualizada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// DELETE via PKG_CITAS.eliminar_cita
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_CITAS.eliminar_cita(:1); END;`,
            [req.params.id]
        );
        res.json({ message: 'Cita eliminada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
