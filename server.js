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
  secret: process.env.SESSION_SECRET || 'change-this-secure-session-secret-in-production',
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
    
    console.log(`Processing earthquake data - received ${allEvents.length} events from USGS`);
    
    // Filter earthquakes to only include magnitude > 2.0, process first 300 for performance
    const eventsToProcess = allEvents.slice(0, Math.min(allEvents.length, 300));
    const events = eventsToProcess.filter(event => {
      const magnitude = event.properties.mag;
      return magnitude && magnitude > 2.0;
    });
    
    // Sort by time (most recent first) and limit to 100
    const limitedEvents = events
      .sort((a, b) => b.properties.time - a.properties.time)
      .slice(0, 100);
    
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
    
    console.log(`Updated ${limitedEvents.length} earthquake events (magnitude > 2.0, latest 100 from ${events.length} filtered events, processed from first 300 of ${allEvents.length} total events)`);
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
    
    console.log(`Processing tsunami data - received ${features.length} tsunami alerts from NOAA`);
    
    // Process first 300 tsunami alerts for performance optimization (though typically much smaller)
    const featuresToProcess = features.slice(0, Math.min(features.length, 300));
    
    for (const feature of featuresToProcess) {
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
    console.log(`Updated ${featuresToProcess.length} tsunami events (processed from ${features.length} received alerts)`);
  } catch (error) {
    console.error('Error fetching tsunami data:', error.message);
  }
};

// Fetch volcano data from Smithsonian Global Volcanism Program
const fetchVolcanoData = async () => {
  try {
    // Fetch volcano eruptions from 2010 onwards using Smithsonian API
    // Get all features first, then filter and sort for latest 100
    const response = await axios.get('https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Eruptions&maxFeatures=1000&outputFormat=application/json');
    
    if (!response.data || !response.data.features) {
      console.log('No volcano data received from Smithsonian API');
      return;
    }

    const eruptions = response.data.features;
    let validEruptions = [];
    
    console.log(`Processing volcano eruptions from Smithsonian API to find latest 100 from 2010-present...`);
    
    // Process all eruptions from 2010 onwards to get full dataset for sorting
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
    
    // Sort by timestamp (most recent first) and limit to 100
    const limitedEruptions = validEruptions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
    
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
    
    console.log(`Updated ${limitedEruptions.length} volcano events from 2010-present (latest 100 from ${validEruptions.length} total valid eruptions, processed from first 300 records)`);
    
  } catch (error) {
    console.error('Error fetching volcano data:', error.message);
  }
};

// Fetch wildfire data from NASA FIRMS
const fetchWildfireData = async () => {
  try {
    // NASA FIRMS provides global active fire data - last 24 hours
    let response;
    let fires = [];
    
    try {
      // Fetch CSV data with early termination for performance
      response = await axios.get('https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv', {
        responseType: 'text',
        timeout: 30000 // 30 second timeout
      });
      
      if (response.data && response.data.trim().length > 0) {
        // Parse CSV data with early termination - take first 300 fires (most recent)
        const lines = response.data.trim().split('\n');
        const headers = lines[0].split(',');
        
        console.log(`Processing first 300 fires from NASA FIRMS for better performance...`);
        
        // Process only the first 300 lines (after header) for performance
        const linesToProcess = Math.min(lines.length - 1, 300);
        
        for (let i = 1; i <= linesToProcess; i++) {
          const values = lines[i].split(',');
          if (values.length >= headers.length) {
            const fire = {};
            headers.forEach((header, index) => {
              fire[header.toLowerCase().trim()] = values[index] ? values[index].trim() : '';
            });
            
            // Only require basic coordinate data (no confidence filtering)
            if (fire.latitude && fire.longitude && fire.bright_ti4) {
              fires.push({
                latitude: parseFloat(fire.latitude),
                longitude: parseFloat(fire.longitude),
                brightness: parseFloat(fire.bright_ti4) || 300,
                confidence: parseFloat(fire.confidence) || 0,
                acq_date: fire.acq_date || '',
                acq_time: fire.acq_time || '0000'
              });
            }
          }
        }
        
        console.log(`Collected ${fires.length} fires from first 300 records`);
      }
    } catch (csvError) {
      console.log('CSV endpoint failed:', csvError.message);
      console.log('No wildfire data available - API endpoint not accessible');
      return;
    }
    
    if (fires.length === 0) {
      console.log('No wildfire data available');
      return;
    }

    // Sort by quality (confidence and brightness) and take top 300
    const sortedFires = fires
      .sort((a, b) => {
        // Sort by confidence first (higher is better)
        const confidenceDiff = b.confidence - a.confidence;
        if (confidenceDiff !== 0) return confidenceDiff;
        
        // Then sort by brightness (higher is better)
        const brightnessDiff = b.brightness - a.brightness;
        if (brightnessDiff !== 0) return brightnessDiff;
        
        // Finally sort by date (newest first)
        if (a.acq_date !== b.acq_date) {
          return b.acq_date.localeCompare(a.acq_date);
        }
        return b.acq_time.localeCompare(a.acq_time);
      })
      .slice(0, 300); // Take exactly 300 fires for display
    
    console.log(`Selected top ${sortedFires.length} highest quality fires for display`);
    
    let processedCount = 0;
    
    // Clear existing wildfire data and insert new limited set
    db.run('DELETE FROM events WHERE type = "wildfire"', (err) => {
      if (err) {
        console.error('Error clearing wildfire data:', err);
        return;
      }
      
      for (const fire of sortedFires) {
        // Generate unique event ID based on coordinates and date
        const eventId = `wildfire_${fire.latitude}_${fire.longitude}_${fire.acq_date}`;
        
        // Calculate intensity based on brightness and confidence
        // Brightness ranges typically 300-400K, confidence 0-100
        const normalizedBrightness = Math.min(Math.max((fire.brightness - 300) / 100, 0), 1);
        const normalizedConfidence = Math.max(fire.confidence / 100, 0.1); // Minimum 10% for calculation
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
    });
    
    console.log(`Updated ${processedCount} wildfire events from NASA FIRMS`);
    
  } catch (error) {
    console.error('Error fetching wildfire data:', error.message);
  }
};

// Fetch flood data from NOAA
const fetchFloodData = async () => {
  try {
    // NOAA Weather Service alerts API for flood warnings, watches, and advisories
    const response = await axios.get('https://api.weather.gov/alerts/active?event=Flood%20Warning,Flood%20Watch,Flood%20Advisory,Flash%20Flood%20Warning,Flash%20Flood%20Watch,Flash%20Flood%20Statement,River%20Flood%20Warning,River%20Flood%20Statement,Coastal%20Flood%20Warning,Coastal%20Flood%20Watch,Coastal%20Flood%20Advisory,Urban%20and%20Small%20Stream%20Flood%20Advisory', {
      timeout: 30000 // 30 second timeout
    });
    
    const features = response.data.features || [];
    
    console.log(`Processing flood data - received ${features.length} flood alerts from NOAA`);
    
    // Process first 300 flood alerts for performance optimization
    const featuresToProcess = features.slice(0, Math.min(features.length, 300));
    let validFloods = [];
    
    for (const feature of featuresToProcess) {
      const props = feature.properties;
      const geometry = feature.geometry;
      
      // Some alerts might not have coordinates, skip those
      if (!geometry || !geometry.coordinates) continue;
      
      // Get the first coordinate pair for the marker position
      let coordinates;
      let affectedAreaRadius = 25; // Default 25km radius
      
      if (geometry.type === 'Polygon') {
        coordinates = geometry.coordinates[0][0]; // First point of first ring
        // Calculate rough radius from polygon bounds for affected area
        const coords = geometry.coordinates[0];
        if (coords.length > 2) {
          const lats = coords.map(c => c[1]);
          const lons = coords.map(c => c[0]);
          const latRange = Math.max(...lats) - Math.min(...lats);
          const lonRange = Math.max(...lons) - Math.min(...lons);
          affectedAreaRadius = Math.max(25, Math.min(100, (latRange + lonRange) * 55)); // Rough km conversion
        }
      } else if (geometry.type === 'Point') {
        coordinates = geometry.coordinates;
        affectedAreaRadius = 15; // Smaller radius for point-based floods
      } else if (geometry.type === 'MultiPolygon') {
        coordinates = geometry.coordinates[0][0][0]; // First point of first ring of first polygon
        affectedAreaRadius = 50; // Larger radius for multi-polygon floods
      } else {
        continue; // Skip unsupported geometry types
      }
      
      // Extract severity level from event type and urgency
      let severity = 1; // Default severity (Advisory)
      let severityLabel = 'Advisory';
      
      if (props.event.includes('Warning')) {
        severity = 3;
        severityLabel = 'Warning';
      } else if (props.event.includes('Watch')) {
        severity = 2;
        severityLabel = 'Watch';
      } else if (props.event.includes('Advisory')) {
        severity = 1;
        severityLabel = 'Advisory';
      }
      
      // Enhance severity based on urgency and certainty
      if (props.urgency === 'Immediate' && severity < 3) severity += 0.5;
      if (props.certainty === 'Likely' && severity < 3) severity += 0.3;
      
      // Generate unique ID from the alert ID and start time
      const eventId = `flood_${props.id}_${props.onset || props.sent}`;
      
      // Create timestamp
      const timestamp = new Date(props.onset || props.sent).getTime();
      
      // Extract water level information if available
      let waterLevelInfo = '';
      if (props.description) {
        const levelMatch = props.description.match(/(\d+\.?\d*)\s*(feet|ft|foot|meters?|m)\s*(above|below)/i);
        if (levelMatch) {
          waterLevelInfo = ` - Water Level: ${levelMatch[1]} ${levelMatch[2]} ${levelMatch[3]} normal`;
        }
      }
      
      validFloods.push({
        eventId,
        title: `${props.event}: ${props.headline}`,
        description: (props.description || props.instruction || 'Flood alert issued') + waterLevelInfo,
        severity,
        severityLabel,
        latitude: coordinates[1],
        longitude: coordinates[0],
        location: props.areaDesc,
        timestamp,
        url: `https://api.weather.gov/alerts/${props.id}`,
        affectedAreaRadius
      });
    }
    
    // Sort by severity and recency, then take top 100
    const limitedFloods = validFloods
      .sort((a, b) => {
        // Sort by severity first (higher is more urgent)
        const severityDiff = b.severity - a.severity;
        if (severityDiff !== 0) return severityDiff;
        
        // Then sort by timestamp (newest first)
        return b.timestamp - a.timestamp;
      })
      .slice(0, 100);
    
    console.log(`Selected top ${limitedFloods.length} highest severity floods from ${validFloods.length} total flood alerts (processed from first 300 of ${features.length} received)`);
    
    // Clear existing flood data and insert new limited set
    db.run('DELETE FROM events WHERE type = "flood"', (err) => {
      if (err) {
        console.error('Error clearing flood data:', err);
        return;
      }
      
      let processedCount = 0;
      
      for (const flood of limitedFloods) {
        db.run(`INSERT OR REPLACE INTO events 
          (event_id, type, title, description, magnitude, latitude, longitude, location, time, url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            flood.eventId,
            'flood',
            flood.title,
            flood.description,
            flood.severity, // Use magnitude field for severity level
            flood.latitude,
            flood.longitude,
            flood.location,
            flood.timestamp,
            flood.url
          ]);
        
        processedCount++;
      }
      
      console.log(`Updated ${processedCount} flood events from NOAA`);
    });
    
  } catch (error) {
    console.error('Error fetching flood data:', error.message);
  }
};

// Create a function to refresh all disaster data
const refreshAllData = async () => {
  console.log('Refreshing all disaster data...');
  try {
    await Promise.all([
      fetchEarthquakeData(),
      fetchTsunamiData(),
      fetchVolcanoData(),
      fetchWildfireData(),
      fetchFloodData()
    ]);
    console.log('All disaster data refreshed successfully');
  } catch (error) {
    console.error('Error refreshing disaster data:', error);
  }
};

// Get initial data on startup only
console.log('Server starting - fetching initial disaster data...');
refreshAllData();

// Note: Automatic cleanup removed - now only manual cleanup via admin dashboard
// All cleanup operations are available through the admin interface

// Make functions and db available to routes
app.locals.db = db;
app.locals.refreshAllData = refreshAllData;

app.listen(PORT, () => {
  console.log(`PulseMap server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`);
});

module.exports = app;
