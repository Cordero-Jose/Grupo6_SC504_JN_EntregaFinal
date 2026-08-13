// ── Servicios routes ── calls PKG_COMPLEMENTOS.insertar_servicio ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all servicios
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_servicio, nombre_servicio, descripcion,
                    precio_base, duracion_estimada
             FROM Servicios ORDER BY nombre_servicio`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET one servicio
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_servicio, nombre_servicio, descripcion, precio_base, duracion_estimada
             FROM Servicios WHERE id_servicio = :id`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insert servicio via PKG_COMPLEMENTOS.insertar_servicio
router.post('/', async (req, res) => {
    const { id_servicio, nombre_servicio, descripcion, precio_base, duracion_estimada } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_COMPLEMENTOS.insertar_servicio(:1,:2,:3,:4,:5); END;`,
            [id_servicio, nombre_servicio, descripcion || null, precio_base, duracion_estimada]
        );
        res.status(201).json({ message: 'Servicio creado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update servicio — only allowed for ADMINISTRADOR role
router.put('/:id', async (req, res) => {
    const role = req.headers['x-role'] || '';
    if (role !== 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Solo el Administrador puede editar servicios.' });
    }
    const { nombre_servicio, descripcion, precio_base, duracion_estimada } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `UPDATE Servicios SET
                nombre_servicio   = NVL(:1, nombre_servicio),
                descripcion       = NVL(:2, descripcion),
                precio_base       = NVL(:3, precio_base),
                duracion_estimada = NVL(:4, duracion_estimada)
             WHERE id_servicio = :5`,
            [nombre_servicio || null, descripcion || null,
             precio_base !== undefined ? precio_base : null,
             duracion_estimada !== undefined ? duracion_estimada : null,
             req.params.id]
        );
        await conn.execute(`COMMIT`);
        res.json({ message: 'Servicio actualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
