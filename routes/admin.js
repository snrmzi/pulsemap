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
    
    // Save the session before responding
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session error' });
      }
      console.log('Session saved successfully for user:', username);
      res.json({ success: true, message: 'Login successful' });
    });
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

// Create new event
router.post('/events', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { type, title, location, latitude, longitude, magnitude, depth, description, timestamp } = req.body;
  
  // Convert timestamp to Unix timestamp in milliseconds
  const time = timestamp ? new Date(timestamp).getTime() : Date.now();
  
  db.run(`INSERT INTO events (type, title, location, latitude, longitude, magnitude, depth, description, time, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, title, location, latitude, longitude, magnitude, depth, description, time, 'admin'],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ success: true, message: 'Event created successfully', id: this.lastID });
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
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  db.run('DELETE FROM events WHERE time < ?', [twentyFourHoursAgo], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ 
      success: true, 
      message: `Cleaned up ${this.changes} events older than 24 hours`,
      deletedCount: this.changes 
    });
  });
});

// Refresh all disaster data manually
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const refreshAllData = req.app.locals.refreshAllData;
    if (!refreshAllData) {
      return res.status(500).json({ error: 'Refresh function not available' });
    }
    
    console.log('Manual data refresh triggered by admin');
    await refreshAllData();
    
    res.json({ 
      success: true, 
      message: 'All disaster data refreshed successfully' 
    });
  } catch (error) {
    console.error('Error refreshing data:', error);
    res.status(500).json({ 
      error: 'Failed to refresh data', 
      details: error.message 
    });
  }
});

module.exports = router;
