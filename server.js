// ============================================================
// SISTEMA DE LUBRICENTRO - GRUPO 6 SC-504
// Servidor principal Express + Oracle Autonomous DB (Wallet)
// ============================================================

const express = require('express');
const path    = require('path');
const { initPool } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for cloud platforms
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// Diagnostic endpoint to pinpoint database connectivity
app.get('/api/debug-db', async (req, res) => {
    const fs = require('fs');
    const { getConnection } = require('./db');
    let conn;
    try {
        const walletDir = (process.env.WALLET_DIR && !process.env.WALLET_DIR.startsWith('/etc/secrets'))
            ? process.env.WALLET_DIR
            : path.join(__dirname, 'wallet_runtime');
        const files = fs.existsSync(walletDir) ? fs.readdirSync(walletDir) : [];
        
        conn = await getConnection();
        const testQuery = await conn.execute(`SELECT USER, SYSDATE FROM DUAL`);
        const tablesQuery = await conn.execute(`SELECT table_name FROM user_tables ORDER BY table_name`);
        const rolesCount = await conn.execute(`SELECT COUNT(*) AS total FROM Roles`);
        
        res.json({
            status: 'CONNECTED_SUCCESSFULLY',
            db_user_env: process.env.DB_USER,
            db_connect_string_env: process.env.DB_CONNECT_STRING,
            wallet_files_present: files,
            connected_as: testQuery.rows,
            user_tables: tablesQuery.rows,
            roles_count: rolesCount.rows
        });
    } catch (err) {
        res.status(500).json({
            status: 'CONNECTION_ERROR',
            error_message: err.message,
            error_code: err.code,
            db_user_env: process.env.DB_USER,
            db_connect_string_env: process.env.DB_CONNECT_STRING
        });
    } finally {
        if (conn) await conn.close();
    }
});

// ── Routes ───────────────────────────────────────────────
app.use('/api/clientes',   require('./routes/clientes'));
app.use('/api/vehiculos',  require('./routes/vehiculos'));
app.use('/api/citas',      require('./routes/citas'));
app.use('/api/ordenes',    require('./routes/ordenes'));
app.use('/api/productos',  require('./routes/productos'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/facturas',   require('./routes/facturas'));
app.use('/api/pagos',      require('./routes/pagos'));
app.use('/api/servicios',  require('./routes/servicios'));
app.use('/api/usuarios',   require('./routes/usuarios'));
app.use('/api/roles',      require('./routes/roles'));
app.use('/api/auditoria',  require('./routes/auditoria'));

// ── Start ────────────────────────────────────────────────
initPool()
    .then(() => {
        app.listen(PORT, () =>
            console.log(`🚀  Lubricentro app running at http://localhost:${PORT}`)
        );
    })
    .catch(err => {
        console.error('❌  Failed to start:', err);
        process.exit(1);
    });
