// ============================================================
// SISTEMA DE LUBRICENTRO - GRUPO 6 SC-504
// Servidor principal Express + Oracle Autonomous DB (Wallet)
// ============================================================

const express = require('express');
const path    = require('path');
const { initPool } = require('./db');

const app  = express();
const PORT = 3000;

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
