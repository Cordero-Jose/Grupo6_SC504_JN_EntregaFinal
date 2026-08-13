// ── Productos routes ── calls PKG_PRODUCTOS ──
const express  = require('express');
const router   = express.Router();
const oracledb = require('oracledb');
const { getConnection } = require('../db');

// GET all productos con existencia (via VW_EXISTENCIAS_PRODUCTO)
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_producto, nombre_producto, marca_producto, nombre_categoria,
                    precio_unitario, stock_minimo, existencia_actual
             FROM VW_EXISTENCIAS_PRODUCTO ORDER BY nombre_categoria, nombre_producto`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET one producto
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT p.id_producto, p.id_categoria, p.nombre_producto, p.marca_producto,
                    p.precio_unitario, p.stock_minimo, cp.nombre_categoria
             FROM Productos p
             JOIN Categorias_Producto cp ON p.id_categoria = cp.id_categoria
             WHERE p.id_producto = :id`,
            [req.params.id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// GET categorias (for dropdown)
router.get('/catalogos/categorias', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `SELECT id_categoria, nombre_categoria FROM Categorias_Producto ORDER BY nombre_categoria`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// POST insert via PKG_PRODUCTOS.insertar_producto
router.post('/', async (req, res) => {
    const { id_producto, id_categoria, nombre_producto, marca_producto, precio_unitario, stock_minimo } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_PRODUCTOS.insertar_producto(:1,:2,:3,:4,:5,:6); END;`,
            [id_producto, id_categoria, nombre_producto, marca_producto || null, precio_unitario, stock_minimo || 0]
        );
        res.status(201).json({ message: 'Producto creado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// PUT update producto (nombre, marca, categoria, precio, stock)
router.put('/:id', async (req, res) => {
    const { nombre_producto, marca_producto, id_categoria, precio_unitario, stock_minimo } = req.body;
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `UPDATE Productos SET
                nombre_producto = NVL(:1, nombre_producto),
                marca_producto  = NVL(:2, marca_producto),
                id_categoria    = NVL(:3, id_categoria),
                precio_unitario = NVL(:4, precio_unitario),
                stock_minimo    = NVL(:5, stock_minimo)
             WHERE id_producto = :6`,
            [nombre_producto || null, marca_producto || null,
             id_categoria || null,
             precio_unitario !== undefined ? precio_unitario : null,
             stock_minimo !== undefined ? stock_minimo : null,
             req.params.id]
        );
        await conn.execute(`COMMIT`);
        res.json({ message: 'Producto actualizado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

// DELETE via PKG_PRODUCTOS.eliminar_producto
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        await conn.execute(
            `BEGIN PKG_PRODUCTOS.eliminar_producto(:1); END;`,
            [req.params.id]
        );
        res.json({ message: 'Producto eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (conn) await conn.close(); }
});

module.exports = router;
