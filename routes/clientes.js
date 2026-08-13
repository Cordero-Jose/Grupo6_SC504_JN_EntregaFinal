// ── Clientes routes ── calls PKG_CLIENTES stored procedures ──
const express = require('express');
const router  = express.Router();
const { getConnection } = require('../db');

// GET all clientes
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_cliente, nombre, cedula, telefono, correo, direccion
             FROM Clientes ORDER BY nombre`,
            [], { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET one cliente
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_cliente, nombre, cedula, telefono, correo, direccion
             FROM Clientes WHERE id_cliente = :id`,
            [req.params.id], { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insert cliente via PKG_CLIENTES.insertar_cliente
router.post('/', async (req, res) => {
    const { id_cliente, nombre, cedula, telefono, correo, direccion } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_CLIENTES.insertar_cliente(:1,:2,:3,:4,:5,:6); END;`,
            [id_cliente, nombre, cedula, telefono || null, correo || null, direccion || null]
        );
        res.status(201).json({ message: 'Cliente creado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update cliente via PKG_CLIENTES.actualizar_cliente
router.put('/:id', async (req, res) => {
    const { nombre, telefono, correo, direccion } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_CLIENTES.actualizar_cliente(:1,:2,:3,:4,:5); END;`,
            [req.params.id, nombre, telefono || null, correo || null, direccion || null]
        );
        res.json({ message: 'Cliente actualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// DELETE cliente via PKG_CLIENTES.eliminar_cliente
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_CLIENTES.eliminar_cliente(:1); END;`,
            [req.params.id]
        );
        res.json({ message: 'Cliente eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
