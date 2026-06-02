const http = require('http');
const { URL } = require('url');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3001);

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return databaseUrl;
}

const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_enrollment_traces (
      transaction_id TEXT PRIMARY KEY,
      customer_email_hash TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL,
      stage TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_password_change_traces (
      request_id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      customer_email_hash TEXT NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL,
      stage TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_login_traces (
      login_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      customer_email_hash TEXT NOT NULL,
      authenticated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL,
      stage TEXT NOT NULL
    )
  `);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('payload_too_large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    try {
      const [enrollmentCountResult, passwordChangeCountResult, loginCountResult] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS count FROM customer_enrollment_traces'),
        pool.query('SELECT COUNT(*)::int AS count FROM customer_password_change_traces'),
        pool.query('SELECT COUNT(*)::int AS count FROM customer_login_traces'),
      ]);
      return sendJson(res, 200, {
        status: 'ok',
        service: 'core-customer',
        storage: 'postgres',
        receivedTransactions: enrollmentCountResult.rows[0].count,
        receivedPasswordChanges: passwordChangeCountResult.rows[0].count,
        receivedLogins: loginCountResult.rows[0].count,
      });
    } catch (error) {
      return sendJson(res, 500, {
        status: 'error',
        service: 'core-customer',
        message: 'database_unavailable',
      });
    }
  }

  if (req.method === 'GET' && url.pathname === '/v1/customer-enrollments') {
    const result = await pool.query(
      `SELECT transaction_id, customer_email_hash, received_at, source, stage
       FROM customer_enrollment_traces
       ORDER BY received_at DESC`,
    );

    return sendJson(res, 200, {
      total: result.rows.length,
      items: result.rows.map(mapRow),
    });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/v1/customer-enrollments/')) {
    const transactionId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const result = await pool.query(
      `SELECT transaction_id, customer_email_hash, received_at, source, stage
       FROM customer_enrollment_traces
       WHERE transaction_id = $1`,
      [transactionId],
    );

    const record = result.rows[0];

    if (!record) {
      return sendJson(res, 404, {
        status: 'not_found',
        transactionId,
      });
    }

    return sendJson(res, 200, mapRow(record));
  }

  if (req.method === 'POST' && url.pathname === '/v1/customer-enrollments') {
    try {
      const raw = await collectBody(req);
      const body = raw ? JSON.parse(raw) : {};

      if (!body.transactionId || !body.customerEmailHash) {
        return sendJson(res, 400, {
          status: 'error',
          message: 'transactionId and customerEmailHash are required',
        });
      }

      const result = await pool.query(
        `INSERT INTO customer_enrollment_traces (
          transaction_id,
          customer_email_hash,
          source,
          stage
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (transaction_id)
        DO UPDATE SET
          customer_email_hash = EXCLUDED.customer_email_hash,
          source = EXCLUDED.source,
          stage = EXCLUDED.stage
        RETURNING transaction_id, customer_email_hash, received_at, source, stage`,
        [body.transactionId, body.customerEmailHash, 'bff-customer', 'core_received'],
      );

      const record = mapRow(result.rows[0]);

      return sendJson(res, 201, {
        status: 'accepted',
        transactionId: record.transactionId,
        receivedAt: record.receivedAt,
        storage: 'postgres',
      });
    } catch (error) {
      return sendJson(res, 400, {
        status: 'error',
        message: error.message === 'payload_too_large' ? 'payload too large' : 'invalid json payload',
      });
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/v1/customer-password-changes/')) {
    const requestId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const result = await pool.query(
      `SELECT request_id, transaction_id, customer_email_hash, requested_at, source, stage
       FROM customer_password_change_traces
       WHERE request_id = $1`,
      [requestId],
    );

    const record = result.rows[0];

    if (!record) {
      return sendJson(res, 404, {
        status: 'not_found',
        requestId,
      });
    }

    return sendJson(res, 200, mapPasswordChangeRow(record));
  }

  if (req.method === 'POST' && url.pathname === '/v1/customer-password-changes') {
    try {
      const raw = await collectBody(req);
      const body = raw ? JSON.parse(raw) : {};

      if (!body.requestId || !body.transactionId || !body.customerEmailHash) {
        return sendJson(res, 400, {
          status: 'error',
          message: 'requestId, transactionId and customerEmailHash are required',
        });
      }

      const result = await pool.query(
        `INSERT INTO customer_password_change_traces (
          request_id,
          transaction_id,
          customer_email_hash,
          source,
          stage
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (request_id)
        DO UPDATE SET
          transaction_id = EXCLUDED.transaction_id,
          customer_email_hash = EXCLUDED.customer_email_hash,
          source = EXCLUDED.source,
          stage = EXCLUDED.stage
        RETURNING request_id, transaction_id, customer_email_hash, requested_at, source, stage`,
        [
          body.requestId,
          body.transactionId,
          body.customerEmailHash,
          'bff-customer',
          'password_change_requested',
        ],
      );

      const record = mapPasswordChangeRow(result.rows[0]);

      return sendJson(res, 201, {
        status: 'accepted',
        requestId: record.requestId,
        transactionId: record.transactionId,
        requestedAt: record.requestedAt,
        storage: 'postgres',
      });
    } catch (error) {
      return sendJson(res, 400, {
        status: 'error',
        message: error.message === 'payload_too_large' ? 'payload too large' : 'invalid json payload',
      });
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/v1/customer-logins/')) {
    const loginId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const result = await pool.query(
      `SELECT login_id, request_id, transaction_id, customer_email_hash, authenticated_at, source, stage
       FROM customer_login_traces
       WHERE login_id = $1`,
      [loginId],
    );

    const record = result.rows[0];

    if (!record) {
      return sendJson(res, 404, {
        status: 'not_found',
        loginId,
      });
    }

    return sendJson(res, 200, mapLoginRow(record));
  }

  if (req.method === 'POST' && url.pathname === '/v1/customer-logins') {
    try {
      const raw = await collectBody(req);
      const body = raw ? JSON.parse(raw) : {};

      if (!body.loginId || !body.requestId || !body.transactionId || !body.customerEmailHash) {
        return sendJson(res, 400, {
          status: 'error',
          message: 'loginId, requestId, transactionId and customerEmailHash are required',
        });
      }

      const result = await pool.query(
        `INSERT INTO customer_login_traces (
          login_id,
          request_id,
          transaction_id,
          customer_email_hash,
          source,
          stage
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (login_id)
        DO UPDATE SET
          request_id = EXCLUDED.request_id,
          transaction_id = EXCLUDED.transaction_id,
          customer_email_hash = EXCLUDED.customer_email_hash,
          source = EXCLUDED.source,
          stage = EXCLUDED.stage
        RETURNING login_id, request_id, transaction_id, customer_email_hash, authenticated_at, source, stage`,
        [
          body.loginId,
          body.requestId,
          body.transactionId,
          body.customerEmailHash,
          'bff-customer',
          'authenticated',
        ],
      );

      const record = mapLoginRow(result.rows[0]);

      return sendJson(res, 201, {
        status: 'accepted',
        loginId: record.loginId,
        requestId: record.requestId,
        transactionId: record.transactionId,
        authenticatedAt: record.authenticatedAt,
        storage: 'postgres',
      });
    } catch (error) {
      return sendJson(res, 400, {
        status: 'error',
        message: error.message === 'payload_too_large' ? 'payload too large' : 'invalid json payload',
      });
    }
  }

  return sendJson(res, 404, {
    status: 'not_found',
    path: url.pathname,
  });
});

function mapRow(row) {
  return {
    transactionId: row.transaction_id,
    customerEmailHash: row.customer_email_hash,
    receivedAt: new Date(row.received_at).toISOString(),
    source: row.source,
    stage: row.stage,
  };
}

function mapPasswordChangeRow(row) {
  return {
    requestId: row.request_id,
    transactionId: row.transaction_id,
    customerEmailHash: row.customer_email_hash,
    requestedAt: new Date(row.requested_at).toISOString(),
    source: row.source,
    stage: row.stage,
  };
}

function mapLoginRow(row) {
  return {
    loginId: row.login_id,
    requestId: row.request_id,
    transactionId: row.transaction_id,
    customerEmailHash: row.customer_email_hash,
    authenticatedAt: new Date(row.authenticated_at).toISOString(),
    source: row.source,
    stage: row.stage,
  };
}

async function start() {
  await initDb();
  server.listen(PORT, () => {
    console.log(`core-customer listening on http://localhost:${PORT} using postgres`);
  });
}

start().catch((error) => {
  console.error('Failed to start core-customer', error);
  process.exit(1);
});
