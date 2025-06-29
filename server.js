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
    const allEvents = response.data.features;
    
    // Filter earthquakes to only include magnitude > 2
    const events = allEvents.filter(event => {
      const magnitude = event.properties.mag;
      return magnitude && magnitude > 2;
    });
    
    // Sort by time (most recent first) and limit to 50
    const limitedEvents = events
      .sort((a, b) => b.properties.time - a.properties.time)
      .slice(0, 50);
    
    // Clear existing earthquake data and insert new limited set
    db.run('DELETE FROM events WHERE type = "earthquake"', (err) => {
      if (err) {
        console.error('Error clearing earthquake data:', err);
        return;
      }
      
      for (const event of limitedEvents) {
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
    });
    
    console.log(`Updated ${limitedEvents.length} earthquake events (magnitude > 2.0, latest 50 from ${allEvents.length} total events)`);
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

// Fetch volcano data from Smithsonian Global Volcanism Program
const fetchVolcanoData = async () => {
  try {
    // Fetch volcano eruptions from 2010 onwards using Smithsonian API
    const response = await axios.get('https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Eruptions&maxFeatures=1000&outputFormat=application/json');
    
    if (!response.data || !response.data.features) {
      console.log('No volcano data received from Smithsonian API');
      return;
    }

    const eruptions = response.data.features;
    let validEruptions = [];
    
    // Process eruptions from 2010 onwards
    for (const eruption of eruptions) {
      const props = eruption.properties;
      const coords = eruption.geometry.coordinates;
      
      // Skip if no start year or coordinates
      if (!props.StartDateYear || !coords || props.StartDateYear < 2010) continue;
      
      // Calculate timestamp (use start of year if no specific date)
      const year = props.StartDateYear;
      const month = props.StartDateMonth || 1;
      const day = props.StartDateDay || 1;
      const timestamp = new Date(year, month - 1, day).getTime();
      
      // Generate unique event ID
      const eventId = `volcano_${props.Volcano_Number}_${props.Eruption_Number}`;
      
      // Determine alert level based on explosivity index
      let alertLevel = 1; // Default to Advisory
      if (props.ExplosivityIndexMax >= 4) alertLevel = 3; // Warning
      else if (props.ExplosivityIndexMax >= 2) alertLevel = 2; // Watch
      
      // Create title and description
      const title = `${props.Volcano_Name} - Eruption Alert`;
      const description = props.ActivityArea ? 
        `Volcanic activity at ${props.ActivityArea}` : 
        `${props.Activity_Type} volcanic activity`;
      
      validEruptions.push({
        eventId,
        title,
        description,
        alertLevel,
        latitude: coords[1],
        longitude: coords[0],
        location: props.Volcano_Name,
        timestamp,
        url: `https://volcano.si.edu/volcano.cfm?vn=${props.Volcano_Number}`
      });
    }
    
    // Sort by timestamp (most recent first) and limit to 50
    const limitedEruptions = validEruptions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
    
    // Clear existing volcano data and insert new limited set
    db.run('DELETE FROM events WHERE type = "volcano"', (err) => {
      if (err) {
        console.error('Error clearing volcano data:', err);
        return;
      }
      
      for (const eruption of limitedEruptions) {
        db.run(`INSERT OR REPLACE INTO events 
          (event_id, type, title, description, magnitude, latitude, longitude, location, time, url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eruption.eventId,
            'volcano',
            eruption.title,
            eruption.description,
            eruption.alertLevel, // Use magnitude field for alert level
            eruption.latitude,
            eruption.longitude,
            eruption.location,
            eruption.timestamp,
            eruption.url
          ]);
      }
    });
    
    console.log(`Updated ${limitedEruptions.length} volcano events from 2010-present (latest 50 from ${validEruptions.length} total valid eruptions)`);
    
  } catch (error) {
    console.error('Error fetching volcano data:', error.message);
  }
};

// Fetch wildfire data from NASA FIRMS
const fetchWildfireData = async () => {
  try {
    // Try the CSV endpoint instead and convert to JSON locally
    // NASA FIRMS provides global active fire data - last 24 hours
    let response;
    let fires = [];
    
    try {
      // Try CSV endpoint first
      response = await axios.get('https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv');
      
      if (response.data && response.data.trim().length > 0) {
        // Parse CSV data
        const lines = response.data.trim().split('\n');
        const headers = lines[0].split(',');
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length >= headers.length) {
            const fire = {};
            headers.forEach((header, index) => {
              fire[header.toLowerCase().trim()] = values[index] ? values[index].trim() : '';
            });
            
            // Map CSV fields to our expected format
            if (fire.latitude && fire.longitude && fire.bright_ti4) {
              fires.push({
                latitude: parseFloat(fire.latitude),
                longitude: parseFloat(fire.longitude),
                brightness: parseFloat(fire.bright_ti4) || 300,
                confidence: parseFloat(fire.confidence) || 50,
                acq_date: fire.acq_date,
                acq_time: fire.acq_time
              });
            }
          }
        }
      }
    } catch (csvError) {
      console.log('CSV endpoint failed:', csvError.message);
      console.log('No wildfire data available - API endpoint not accessible');
    }
    
    if (fires.length === 0) {
      console.log('No wildfire data available');
      return;
    }

    // Debug: check what dates we have
    const uniqueDates = [...new Set(fires.map(f => f.acq_date))].sort().reverse();
    console.log(`Available fire data dates: ${uniqueDates.slice(0, 5).join(', ')} (showing first 5)`);

    // Filter and limit fires efficiently
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Sort fires by confidence and date (best quality first), then filter
    const sortedFires = fires
      .filter(fire => {
        // More lenient filter: recent dates and reasonable confidence
        return (fire.acq_date === todayStr || fire.acq_date === yesterdayStr) && 
               fire.confidence >= 50; // Lower confidence threshold
      })
      .sort((a, b) => {
        // Sort by confidence first (higher is better), then by date/time
        const confidenceDiff = (b.confidence || 0) - (a.confidence || 0);
        if (confidenceDiff !== 0) return confidenceDiff;
        
        // Then sort by date (newest first)
        if (a.acq_date !== b.acq_date) {
          return b.acq_date.localeCompare(a.acq_date);
        }
        return (b.acq_time || '0000').localeCompare(a.acq_time || '0000');
      })
      .slice(0, 100); // Take only the 100 most recent and reliable
    
    console.log(`Selected ${sortedFires.length} most recent fires from ${fires.length} total (confidence 50%+, last 24h)`);
    
    let processedCount = 0;
    
    // Clean up old wildfire data (30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    db.run('DELETE FROM events WHERE type = "wildfire" AND time < ?', [thirtyDaysAgo]);
    
    for (const fire of sortedFires) {
      // Skip fires with very low confidence (redundant check, but keeping for safety)
      if (fire.confidence < 50) continue;
      
      // Generate unique event ID based on coordinates and date
      const eventId = `wildfire_${fire.latitude}_${fire.longitude}_${fire.acq_date}`;
      
      // Calculate intensity based on brightness and confidence
      // Brightness ranges typically 300-400K, confidence 0-100
      const normalizedBrightness = Math.min(Math.max((fire.brightness - 300) / 100, 0), 1);
      const normalizedConfidence = fire.confidence / 100;
      const intensity = Math.round((normalizedBrightness * 0.7 + normalizedConfidence * 0.3) * 10) / 10;
      
      // Create timestamp from acquisition date and time
      const dateTime = `${fire.acq_date} ${fire.acq_time}`;
      const timestamp = new Date(dateTime.replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00Z')).getTime();
      
      // Create title and description
      const title = `Active Fire Detection`;
      const description = `Fire detected by satellite with ${fire.confidence}% confidence. Brightness: ${fire.brightness}K`;
      
      db.run(`INSERT OR REPLACE INTO events 
        (event_id, type, title, description, magnitude, latitude, longitude, location, time, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          'wildfire',
          title,
          description,
          intensity, // Use magnitude field for fire intensity
          fire.latitude,
          fire.longitude,
          `${fire.latitude.toFixed(3)}, ${fire.longitude.toFixed(3)}`,
          timestamp,
          'https://firms.modaps.eosdis.nasa.gov/'
        ]);
      
      processedCount++;
    }
    
    console.log(`Updated ${processedCount} wildfire events from NASA FIRMS`);
    
  } catch (error) {
    console.error('Error fetching wildfire data:', error.message);
  }
};

// Schedule data fetching every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('Fetching latest disaster data...');
  fetchEarthquakeData();
  fetchTsunamiData();
  fetchVolcanoData();
  fetchWildfireData();
});

// Get initial data on startup
fetchEarthquakeData();
fetchTsunamiData();
fetchVolcanoData();
fetchWildfireData();

// Clean up old data every day at midnight with different retention policies
cron.schedule('0 0 * * *', () => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const fifteenYearsAgo = Date.now() - (15 * 365 * 24 * 60 * 60 * 1000);
  
  // Note: Earthquakes and volcanoes are now limited to 50 latest events each during fetch
  // So no time-based cleanup needed for them
  
  // Clean up wildfires older than 30 days
  db.run('DELETE FROM events WHERE type = "wildfire" AND time < ?', [thirtyDaysAgo], function(err) {
    if (err) {
      console.error('Error cleaning old wildfire data:', err);
    } else {
      console.log(`Cleaned up ${this.changes} old wildfire events`);
    }
  });
  
  // Clean up tsunamis older than 15 years
  db.run('DELETE FROM events WHERE type = "tsunami" AND time < ?', [fifteenYearsAgo], function(err) {
    if (err) {
      console.error('Error cleaning old tsunami data:', err);
    } else {
      console.log(`Cleaned up ${this.changes} old tsunami events`);
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
