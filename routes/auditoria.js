// ── Auditoria routes ── read-only audit log ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_auditoria, tabla_afectada, accion, descripcion,
                    TO_CHAR(fecha_registro,'YYYY-MM-DD HH24:MI:SS') AS fecha_registro,
                    usuario_bd
             FROM Auditoria_Sistema
             ORDER BY id_auditoria DESC
             FETCH FIRST 200 ROWS ONLY`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
