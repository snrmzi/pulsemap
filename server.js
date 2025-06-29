const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'pulsemap-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Set up SQLite database
const db = new sqlite3.Database('./pulsemap.db');

// Create tables if they don't exist
db.serialize(() => {
  // Events table
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    magnitude REAL,
    depth REAL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    location TEXT,
    time INTEGER NOT NULL,
    url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Admin users table
  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create default admin user (password: admin123)
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO admin_users (username, password_hash) VALUES (?, ?)`, 
    ['admin', defaultPassword]);
});

// Route handlers
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Functions to fetch data from external APIs
const fetchEarthquakeData = async () => {
  try {
    const response = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
    const events = response.data.features;
    
    for (const event of events) {
      const props = event.properties;
      const coords = event.geometry.coordinates;
      
      db.run(`INSERT OR REPLACE INTO events 
        (event_id, type, title, magnitude, depth, latitude, longitude, location, time, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          'earthquake',
          props.title,
          props.mag,
          coords[2], // depth
          coords[1], // latitude
          coords[0], // longitude
          props.place,
          props.time,
          props.url
        ]);
    }
    console.log(`Updated ${events.length} earthquake events`);
  } catch (error) {
    console.error('Error fetching earthquake data:', error.message);
  }
};

// Fetch tsunami data from NOAA
const fetchTsunamiData = async () => {
  try {
    // Using NOAA's tsunami warning API - this gives us active warnings and watches
    const response = await axios.get('https://api.weather.gov/alerts/active?event=Tsunami%20Warning,Tsunami%20Watch,Tsunami%20Advisory');
    const features = response.data.features || [];
    
    for (const feature of features) {
      const props = feature.properties;
      const geometry = feature.geometry;
      
      // Some alerts might not have coordinates, skip those
      if (!geometry || !geometry.coordinates) continue;
      
      // Get the first coordinate pair for the marker position
      let coordinates;
      if (geometry.type === 'Polygon') {
        coordinates = geometry.coordinates[0][0]; // First point of first ring
      } else if (geometry.type === 'Point') {
        coordinates = geometry.coordinates;
      } else if (geometry.type === 'MultiPolygon') {
        coordinates = geometry.coordinates[0][0][0]; // First point of first ring of first polygon
      } else {
        continue; // Skip unsupported geometry types
      }
      
      // Extract threat level from event type
      let magnitude = 1; // Default threat level
      if (props.event.includes('Warning')) magnitude = 3;
      else if (props.event.includes('Watch')) magnitude = 2;
      else if (props.event.includes('Advisory')) magnitude = 1;
      
      // Generate unique ID from the alert ID and start time
      const eventId = `tsunami_${props.id}_${props.onset}`;
      
      db.run(`INSERT OR REPLACE INTO events 
        (event_id, type, title, description, magnitude, latitude, longitude, location, time, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          'tsunami',
          `${props.event}: ${props.headline}`,
          props.description || props.instruction,
          magnitude, // Use magnitude field for threat level
          coordinates[1], // latitude
          coordinates[0], // longitude
          props.areaDesc,
          new Date(props.onset || props.sent).getTime(),
          `https://api.weather.gov/alerts/${props.id}`
        ]);
    }
    console.log(`Updated ${features.length} tsunami events`);
  } catch (error) {
    console.error('Error fetching tsunami data:', error.message);
  }
};

// Schedule data fetching every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('Fetching latest disaster data...');
  fetchEarthquakeData();
  fetchTsunamiData();
});

// Get initial data on startup
fetchEarthquakeData();
fetchTsunamiData();

// Clean up old data every day at midnight (older than 7 days)
cron.schedule('0 0 * * *', () => {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  db.run('DELETE FROM events WHERE time < ?', [sevenDaysAgo], function(err) {
    if (err) {
      console.error('Error cleaning old data:', err);
    } else {
      console.log(`Cleaned up ${this.changes} old events`);
    }
  });
});

// Make db available to routes
app.locals.db = db;

app.listen(PORT, () => {
  console.log(`PulseMap server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`);
});

module.exports = app;
