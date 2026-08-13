// ── db.js — shared Oracle connection helper ──
require('dotenv').config();
const oracledb = require('oracledb');
const path     = require('path');

const WALLET_DIR = path.join(__dirname, 'wallet');

async function initPool() {
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
