const express = require('express');
const router = express.Router();

// Get all events with optional filtering and limits
router.get('/events', (req, res) => {
  const db = req.app.locals.db;
  const { type } = req.query;
  
  if (type) {
    // Special case for wildfires: allow 300 events, others get 100 for consistency
    let limit = type === 'wildfire' ? 300 : 100;
    let query = `SELECT * FROM events WHERE type = ? ORDER BY time DESC LIMIT ${limit}`;
    
    db.all(query, [type], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  } else {
    // Get all events with limits: 300 for wildfires, 100 for others
    const queries = [
      'SELECT * FROM events WHERE type = "earthquake" ORDER BY time DESC LIMIT 100',
      'SELECT * FROM events WHERE type = "volcano" ORDER BY time DESC LIMIT 100',
      'SELECT * FROM events WHERE type = "tsunami" ORDER BY time DESC LIMIT 100',
      'SELECT * FROM events WHERE type = "wildfire" ORDER BY time DESC LIMIT 300',
      'SELECT * FROM events WHERE type = "flood" ORDER BY time DESC LIMIT 100',
      'SELECT * FROM events WHERE type NOT IN ("earthquake", "volcano", "tsunami", "wildfire", "flood") ORDER BY time DESC LIMIT 100'
    ];
    
    let allEvents = [];
    let completed = 0;
    
    queries.forEach(query => {
      db.all(query, (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        allEvents = allEvents.concat(rows);
        completed++;
        
        if (completed === queries.length) {
          // Sort all events by time descending
          allEvents.sort((a, b) => b.time - a.time);
          res.json(allEvents);
        }
      });
    });
  }
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
