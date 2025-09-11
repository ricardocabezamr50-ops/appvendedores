"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ping = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
// Gen2 HTTP healthcheck simple
exports.ping = (0, https_1.onRequest)({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
    firebase_functions_1.logger.info('ping ok');
    res.status(200).send('ok');
});
