const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.session.adminUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Admin login page
router.get('/', (req, res) => {
  if (req.session.adminUser) {
    res.sendFile('admin.html', { root: './public' });
  } else {
    res.sendFile('login.html', { root: './public' });
  }
});

// Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = req.app.locals.db;
  
  db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.adminUser = { id: user.id, username: user.username };
    res.json({ success: true, message: 'Login successful' });
  });
});

// Admin logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logout successful' });
});

// Get all events for admin
router.get('/events', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  
  db.all('SELECT * FROM events ORDER BY time DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Update event
router.put('/events/:id', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { title, magnitude, depth, latitude, longitude, location } = req.body;
  
  db.run(`UPDATE events 
    SET title = ?, magnitude = ?, depth = ?, latitude = ?, longitude = ?, location = ?
    WHERE id = ?`,
    [title, magnitude, depth, latitude, longitude, location, id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      res.json({ success: true, message: 'Event updated successfully' });
    });
});

// Delete event
router.delete('/events/:id', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  
  db.run('DELETE FROM events WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ success: true, message: 'Event deleted successfully' });
  });
});

// Clean old data manually
router.post('/cleanup', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  db.run('DELETE FROM events WHERE time < ?', [sevenDaysAgo], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ 
      success: true, 
      message: `Cleaned up ${this.changes} old events`,
      deletedCount: this.changes 
    });
  });
});

module.exports = router;
