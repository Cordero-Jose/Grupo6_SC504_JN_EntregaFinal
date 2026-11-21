// ── db.js — shared Oracle connection helper ──
require('dotenv').config();
const oracledb = require('oracledb');
const fs       = require('fs');
const path     = require('path');

const WALLET_DIR = process.env.WALLET_DIR || path.join(__dirname, 'wallet');

function ensureWallet() {
    if (!fs.existsSync(WALLET_DIR)) {
        try {
            fs.mkdirSync(WALLET_DIR, { recursive: true });
        } catch (e) {
            console.warn('Could not create WALLET_DIR:', e.message);
        }
    }
    if (process.env.CWALLET_BASE64) {
        fs.writeFileSync(
            path.join(WALLET_DIR, 'cwallet.sso'),
            Buffer.from(process.env.CWALLET_BASE64.trim(), 'base64')
        );
    }
    if (process.env.EWALLET_BASE64) {
        fs.writeFileSync(
            path.join(WALLET_DIR, 'ewallet.p12'),
            Buffer.from(process.env.EWALLET_BASE64.trim(), 'base64')
        );
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
        poolMin       : 2,
        poolMax       : 10,
        poolIncrement : 1
    });
    console.log('✅  Oracle connection pool created');
}

async function getConnection() {
    return oracledb.getConnection();
}

module.exports = { initPool, getConnection };
