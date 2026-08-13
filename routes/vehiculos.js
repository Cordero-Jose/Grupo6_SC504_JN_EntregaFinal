// ── Vehiculos routes ── calls PKG_VEHICULOS ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all marcas (for dropdowns)
router.get('/catalogos/marcas', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_marca, nombre_marca FROM Marcas ORDER BY nombre_marca`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST nueva marca via PKG_COMPLEMENTOS.insertar_marca
router.post('/catalogos/marcas', async (req, res) => {
    const { id_marca, nombre_marca } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_COMPLEMENTOS.insertar_marca(:1,:2); END;`,
            [id_marca, nombre_marca]
        );
        res.status(201).json({ message: 'Marca creada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET all modelos (used for nextId)
router.get('/catalogos/modelos', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_modelo, nombre_modelo, anio FROM Modelos ORDER BY id_modelo`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET modelos by marca
router.get('/catalogos/modelos/:id_marca', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_modelo, nombre_modelo, anio FROM Modelos
             WHERE id_marca = :id ORDER BY nombre_modelo`,
            [req.params.id_marca], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST nuevo modelo via PKG_COMPLEMENTOS.insertar_modelo
router.post('/catalogos/modelos', async (req, res) => {
    const { id_modelo, id_marca, nombre_modelo, anio } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_COMPLEMENTOS.insertar_modelo(:1,:2,:3,:4); END;`,
            [id_modelo, id_marca, nombre_modelo, parseInt(anio)]
        );
        res.status(201).json({ message: 'Modelo creado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET all vehiculos (with view)
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_cliente, cliente, cedula, telefono, correo,
                    id_vehiculo, placa, marca, modelo, anio, kilometraje, color
             FROM VW_CLIENTES_VEHICULOS ORDER BY cliente`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET one vehiculo
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT v.id_vehiculo, v.id_cliente, v.id_modelo, v.placa,
                    v.kilometraje, v.color, ma.nombre_marca, mo.nombre_modelo, mo.anio
             FROM Vehiculos v
             JOIN Modelos mo ON v.id_modelo = mo.id_modelo
             JOIN Marcas ma ON mo.id_marca = ma.id_marca
             WHERE v.id_vehiculo = :id`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insert via PKG_VEHICULOS.insertar_vehiculo
router.post('/', async (req, res) => {
    const { id_vehiculo, id_cliente, id_modelo, placa, kilometraje, color } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_VEHICULOS.insertar_vehiculo(:1,:2,:3,:4,:5,:6); END;`,
            [id_vehiculo, id_cliente, id_modelo, placa, kilometraje || 0, color || null]
        );
        res.status(201).json({ message: 'Vehiculo creado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update vehiculo (placa, color, kilometraje, id_modelo, id_cliente)
router.put('/:id', async (req, res) => {
    const { kilometraje, placa, color, id_modelo, id_cliente } = req.body;
    let conn;
    try {
        conn = await getConnection();
        if (placa !== undefined || color !== undefined || id_modelo !== undefined || id_cliente !== undefined) {
            // Full update
            await conn.execute(
                `UPDATE Vehiculos SET
                    placa      = NVL(:1, placa),
                    color      = NVL(:2, color),
                    id_modelo  = NVL(:3, id_modelo),
                    id_cliente = NVL(:4, id_cliente),
                    kilometraje = NVL(:5, kilometraje)
                 WHERE id_vehiculo = :6`,
                [placa || null, color || null, id_modelo || null, id_cliente || null, kilometraje !== undefined ? kilometraje : null, req.params.id]
            );
            await conn.execute(`COMMIT`);
        } else {
            // Legacy km-only update
            await conn.execute(
                `BEGIN PKG_VEHICULOS.actualizar_kilometraje(:1,:2); END;`,
                [req.params.id, kilometraje]
            );
        }
        res.json({ message: 'Vehículo actualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// DELETE via PKG_VEHICULOS.eliminar_vehiculo
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_VEHICULOS.eliminar_vehiculo(:1); END;`,
            [req.params.id]
        );
        res.json({ message: 'Vehiculo eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
