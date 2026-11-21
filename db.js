// ── db.js — shared Oracle connection helper ──
require('dotenv').config();
const oracledb = require('oracledb');
const fs       = require('fs');
const path     = require('path');

// Use a local writable directory inside the project
const WALLET_DIR = (process.env.WALLET_DIR && !process.env.WALLET_DIR.startsWith('/etc/secrets'))
    ? process.env.WALLET_DIR
    : path.join(__dirname, 'wallet_runtime');

function ensureWallet() {
    if (!fs.existsSync(WALLET_DIR)) {
        fs.mkdirSync(WALLET_DIR, { recursive: true });
    }

    // Copy from local ./wallet directory if present
    const localWallet = path.join(__dirname, 'wallet');
    if (fs.existsSync(localWallet) && path.resolve(localWallet) !== path.resolve(WALLET_DIR)) {
        const files = fs.readdirSync(localWallet);
        for (const file of files) {
            const dest = path.join(WALLET_DIR, file);
            if (!fs.existsSync(dest)) {
                fs.copyFileSync(path.join(localWallet, file), dest);
            }
        }
    }

    // Fallback: If environment variables provide wallet Base64/Content
    if (process.env.TNSNAMES_CONTENT) {
        fs.writeFileSync(path.join(WALLET_DIR, 'tnsnames.ora'), process.env.TNSNAMES_CONTENT, 'utf8');
    }
    if (process.env.SQLNET_CONTENT) {
        fs.writeFileSync(path.join(WALLET_DIR, 'sqlnet.ora'), process.env.SQLNET_CONTENT, 'utf8');
    }
    if (process.env.CWALLET_BASE64) {
        fs.writeFileSync(path.join(WALLET_DIR, 'cwallet.sso'), Buffer.from(process.env.CWALLET_BASE64.trim(), 'base64'));
    }
    if (process.env.PEM_BASE64) {
        fs.writeFileSync(path.join(WALLET_DIR, 'ewallet.pem'), Buffer.from(process.env.PEM_BASE64.trim(), 'base64'));
    }
    if (process.env.P12_BASE64) {
        fs.writeFileSync(path.join(WALLET_DIR, 'ewallet.p12'), Buffer.from(process.env.P12_BASE64.trim(), 'base64'));
    }
}

async function initPool() {
    ensureWallet();
    await oracledb.createPool({
        user          : process.env.DB_USER,
        password      : process.env.DB_PASSWORD,
        connectString : process.env.DB_CONNECT_STRING,
        configDir     : WALLET_DIR,
        walletLocation: WALLET_DIR,
        walletPassword: process.env.WALLET_PASSWORD,
        poolMin       : 0,
        poolMax       : 10,
        poolIncrement : 1,
        poolTimeout   : 60,
        queueTimeout  : 30000
    });
    console.log('✅  Oracle connection pool created');
}

async function getConnection() {
    return oracledb.getConnection();
}

module.exports = { initPool, getConnection };
