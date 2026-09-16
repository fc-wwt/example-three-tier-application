const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const startTime = Date.now();

app.use(express.json());

// Enhanced health check handler
const healthCheck = async (_req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000), // seconds
    service: 'api',
    version: process.env.npm_package_version || '1.0.0'
  };

  // Check database connectivity
  try {
    const result = await db.query('SELECT 1 as health_check');
    health.database = {
      status: 'connected',
      responseTime: 'ok'
    };
  } catch (error) {
    health.status = 'degraded';
    health.database = {
      status: 'disconnected',
      error: error.message
    };
    return res.status(503).json(health);
  }

  res.json(health);
};

// Health check endpoints (three paths for the same functionality)
app.get('/health', healthCheck);
app.get('/status', healthCheck);
app.get('/health-status', healthCheck);

// GET /tasks — list all tasks
app.get('/tasks', async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM tasks ORDER BY created_at ASC');
  res.json(rows);
});

// POST /tasks — create a task
app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const { rows } = await db.query(
    'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
    [title.trim()]
  );
  res.status(201).json(rows[0]);
});

// PATCH /tasks/:id — update a task (complete/uncomplete or rename)
app.patch('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { completed, title } = req.body;

  const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const current = rows[0];
  const newCompleted = completed !== undefined ? Boolean(completed) : current.completed;
  const newTitle = title !== undefined ? title.trim() : current.title;

  const { rows: updated } = await db.query(
    'UPDATE tasks SET completed = $1, title = $2 WHERE id = $3 RETURNING *',
    [newCompleted, newTitle, id]
  );
  res.json(updated[0]);
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
