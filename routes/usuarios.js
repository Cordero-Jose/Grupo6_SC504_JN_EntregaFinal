// ── Usuarios routes ── calls PKG_COMPLEMENTOS.insertar_usuario ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all usuarios
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT u.id_usuario, u.id_rol, r.nombre_rol, u.nombre,
                    u.correo, u.estado
             FROM Usuarios u
             JOIN Roles r ON u.id_rol = r.id_rol
             ORDER BY u.nombre`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET one usuario
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_usuario, id_rol, nombre, correo, estado
             FROM Usuarios WHERE id_usuario = :id`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insert via PKG_COMPLEMENTOS.insertar_usuario
router.post('/', async (req, res) => {
    const { id_usuario, id_rol, nombre, correo, contrasena, estado } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_COMPLEMENTOS.insertar_usuario(:1,:2,:3,:4,:5,:6); END;`,
            [id_usuario, id_rol, nombre, correo, contrasena, estado || 'ACTIVO']
        );
        res.status(201).json({ message: 'Usuario creado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update usuario (nombre, correo, id_rol, estado)
router.put('/:id', async (req, res) => {
    const { nombre, correo, id_rol, estado } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `UPDATE Usuarios SET
                nombre  = NVL(:1, nombre),
                correo  = NVL(:2, correo),
                id_rol  = NVL(:3, id_rol),
                estado  = NVL(:4, estado)
             WHERE id_usuario = :5`,
            [nombre || null, correo || null, id_rol || null, estado || null, req.params.id]
        );
        await conn.execute(`COMMIT`);
        res.json({ message: 'Usuario actualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
