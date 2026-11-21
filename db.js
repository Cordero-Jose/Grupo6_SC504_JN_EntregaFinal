// ── db.js — shared Oracle connection helper ──
require('dotenv').config();
const oracledb = require('oracledb');
const fs       = require('fs');
const path     = require('path');

// Use a local writable directory inside the project
const WALLET_DIR = (process.env.WALLET_DIR && !process.env.WALLET_DIR.startsWith('/etc/secrets'))
    ? process.env.WALLET_DIR
    : path.join(__dirname, 'wallet_runtime');

const DEFAULT_TNSNAMES = `lenguajesbd_high = (description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.sa-saopaulo-1.oraclecloud.com))(connect_data=(service_name=ga6d7ae30503140_lenguajesbd_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))
lenguajesbd_medium = (description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.sa-saopaulo-1.oraclecloud.com))(connect_data=(service_name=ga6d7ae30503140_lenguajesbd_medium.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))
lenguajesbd_low = (description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.sa-saopaulo-1.oraclecloud.com))(connect_data=(service_name=ga6d7ae30503140_lenguajesbd_low.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))
lenguajesbd_tp = (description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.sa-saopaulo-1.oraclecloud.com))(connect_data=(service_name=ga6d7ae30503140_lenguajesbd_tp.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))
lenguajesbd_tpurgent = (description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.sa-saopaulo-1.oraclecloud.com))(connect_data=(service_name=ga6d7ae30503140_lenguajesbd_tpurgent.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))
`;

const DEFAULT_SQLNET = `WALLET_LOCATION = (SOURCE = (METHOD = file) (METHOD_DATA = (DIRECTORY="?/network/admin")))
SSL_SERVER_DN_MATCH=yes
`;

function ensureWallet() {
    if (!fs.existsSync(WALLET_DIR)) {
        fs.mkdirSync(WALLET_DIR, { recursive: true });
    }

    // Write default network config files if not present
    const tnsPath = path.join(WALLET_DIR, 'tnsnames.ora');
    if (!fs.existsSync(tnsPath)) {
        fs.writeFileSync(tnsPath, process.env.TNSNAMES_CONTENT || DEFAULT_TNSNAMES, 'utf8');
    }

    const sqlnetPath = path.join(WALLET_DIR, 'sqlnet.ora');
    if (!fs.existsSync(sqlnetPath)) {
        fs.writeFileSync(sqlnetPath, process.env.SQLNET_CONTENT || DEFAULT_SQLNET, 'utf8');
    }

    // Write binary credentials from base64 env vars
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

    // Copy from local ./wallet directory if present (e.g. in local development)
    const localWallet = path.join(__dirname, 'wallet');
    if (fs.existsSync(localWallet) && localWallet !== WALLET_DIR) {
        const files = fs.readdirSync(localWallet);
        for (const file of files) {
            const dest = path.join(WALLET_DIR, file);
            if (!fs.existsSync(dest)) {
                fs.copyFileSync(path.join(localWallet, file), dest);
            }
        }
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
