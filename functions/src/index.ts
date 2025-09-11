import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

// Gen2 HTTP healthcheck simple
export const ping = onRequest(
  { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB' },
  async (req, res) => {
    logger.info('ping ok');
    res.status(200).send('ok');
  }
);
