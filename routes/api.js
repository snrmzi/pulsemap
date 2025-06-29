const express = require('express');
const router = express.Router();

// Get all events with optional filtering
router.get('/events', (req, res) => {
  const db = req.app.locals.db;
  const { type } = req.query;
  
  let query = 'SELECT * FROM events ORDER BY time DESC';
  let params = [];
  
  if (type) {
    query = 'SELECT * FROM events WHERE type = ? ORDER BY time DESC';
    params = [type];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get recent events for sidebar (last 20)
router.get('/events/recent', (req, res) => {
  const db = req.app.locals.db;
  
  db.all('SELECT * FROM events ORDER BY time DESC LIMIT 20', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get event by ID
router.get('/events/:id', (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  db.get('SELECT * FROM events WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(row);
  });
});

// Get statistics
router.get('/stats', (req, res) => {
  const db = req.app.locals.db;
  
  const stats = {};
  
  // Get total counts by type
  db.all(`SELECT type, COUNT(*) as count FROM events GROUP BY type`, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    rows.forEach(row => {
      stats[row.type] = row.count;
    });
    
    // Get total count
    db.get('SELECT COUNT(*) as total FROM events', (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      stats.total = row.total;
      res.json(stats);
    });
  });
});

module.exports = router;
