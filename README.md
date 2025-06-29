# PulseMap - Live Natural Disaster Monitoring

PulseMap is a real-time web application that provides live updates on natural disasters around the world including earthquakes, tsunamis, volcanoes, wildfires, floods, and solar flares.

## Features

- **Interactive World Map**: Dark-themed world map with color-coded markers for different disaster types
- **Manual Data Refresh**: Admin-controlled data updates on server startup and via refresh button
- **Event Filtering**: Filter events by type using the dropdown menu
- **Detailed Information**: Click on map markers or sidebar events to view comprehensive details
- **Admin Dashboard**: Secure admin panel for managing events and manual data refresh/cleanup
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Intelligent Data Management**: Event limits: 100 for earthquakes/volcanoes/floods, 300 for wildfires, and all available for tsunamis
- **Clean Architecture**: Separated HTML, CSS, and JavaScript for maintainability
- **Interactive Navigation**: Click sidebar events to center and zoom map to event location
- **24-Hour Data Cleanup**: Manual cleanup removes all data older than 24 hours

## Current Data Sources

- **🌍 Earthquakes**: USGS Earthquake API (magnitude > 2.0, latest 100 events)
- **🌊 Tsunamis**: NOAA Tsunami Warning API (active alerts + 1 demo event)
- **🌋 Volcanoes**: Smithsonian Global Volcanism Program (2010-present, latest 100 events)
- **🔥 Wildfires**: NASA FIRMS API (latest 300 highest quality fires by confidence and brightness)
- **💧 Floods**: NOAA Weather Service API (latest 100 highest severity flood alerts)

## Planned Features

Future development will include:
- **☀️ Solar Flares**: Space weather and solar activity monitoring  
- ** Real-time Notifications**: Push alerts for critical events
- **📊 Enhanced Analytics**: Historical trends and patterns
- **🔍 Advanced Filtering**: More sophisticated search and filter options

## Technical Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite with optimized data retention policies
- **Frontend**: Vanilla HTML/CSS/JavaScript (fully separated and organized)
- **Maps**: Leaflet.js with custom styling
- **Authentication**: bcryptjs + express-session
- **APIs**: USGS Earthquake API, NOAA Tsunami API, NOAA Weather Service API, Smithsonian Global Volcanism Program, NASA FIRMS API
- **Deployment**: Configured for Fly.io with Docker support

## Color Coding

Events are color-coded for easy identification:
- **Earthquakes**: White markers
- **Tsunamis**: Cyan markers  
- **Volcanoes**: Orange markers
- **Wildfires**: Brown markers
- **Floods**: Blue markers
- **Solar Flares**: Yellow markers

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd pulsemap
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application**:
   ```bash
   npm start
   ```

4. **Access the application**:
   - Main application: http://localhost:3000
   - Admin dashboard: http://localhost:3000/admin

## Admin Access

Default login:
- **Username**: admin
- **Password**: admin123

**Note**: Change the default password before deploying to production!

## Data Sources

The application integrates with multiple real-time APIs:
- **USGS Earthquake API**: Live earthquake data (magnitude 2.0+)
- **NOAA Tsunami API**: Active tsunami warnings, watches, and advisories  
- **NOAA Weather Service API**: Flood warnings, watches, and advisories
- **Smithsonian Global Volcanism Program**: Volcanic eruptions from 2010-present
- **NASA FIRMS API**: Real-time wildfire detection data

Data is fetched manually on server startup and via admin dashboard refresh. The system maintains a 24-hour data retention policy with automatic cleanup removing older events.

## Deployment

### Fly.io Deployment

1. **Install Fly CLI**: https://fly.io/docs/hands-on/install-flyctl/

2. **Authenticate**:
   ```bash
   fly auth login
   ```

3. **Deploy the application**:
   ```bash
   fly deploy
   ```

4. **Configure secrets**:
   ```bash
   fly secrets set SESSION_SECRET=your-secure-session-secret-here
   ```

## Development

### Project Structure

```
pulsemap/
├── server.js              # Main server with API integrations
├── routes/
│   ├── api.js             # Public API endpoints
│   └── admin.js           # Admin authentication & management
├── public/
│   ├── index.html         # Main application page
│   ├── admin.html         # Admin dashboard
│   ├── login.html         # Admin login page
│   ├── styles.css         # Unified styling (dark theme)
│   └── script.js          # Combined frontend JavaScript
├── package.json           # Dependencies and scripts
├── Dockerfile            # Container configuration
├── fly.toml             # Fly.io deployment config
└── README.md
```

### Recent Refactoring (December 2025)

The codebase underwent a comprehensive refactoring to improve maintainability and user experience:

#### Code Organization & Architecture
- **Separated Concerns**: Extracted all inline CSS and JavaScript from HTML files
- **Unified Styling**: Merged all styles into a single `styles.css` file with consistent dark theme
- **Consolidated Scripts**: Combined all JavaScript into `script.js` with intelligent page detection
- **Modular Structure**: Improved code organization for better maintainability

#### UI/UX Improvements
- **Fixed Color Coding**: Updated event markers to match specifications:
  - Earthquakes: White markers
  - Wildfires: Brown markers  
  - Solar Flares: Yellow markers
- **Enhanced Admin Dashboard**: 
  - Fixed dark theme consistency with proper text colors
  - Implemented scrolling for large event lists
  - Corrected date formatting for proper event timestamps
  - Improved event details table with full information display
- **Login Page Polish**: Refined styling for better user experience

#### Data & Performance
- **Database Cleanup**: Removed all mock data, implemented real API-only data
- **Fixed Timestamp Handling**: Resolved invalid date issues in admin dashboard
- **Optimized Data Retention**: 7-day retention for earthquakes, 15-year for historical events
- **Authentication Improvements**: Enhanced login flow and session management

#### Technical Fixes
- **Responsive Design**: Ensured proper overflow handling and mobile compatibility
- **Event Details**: Fixed admin dashboard to show complete event information
- **Date Processing**: Corrected timestamp field mapping from database to frontend
- **Theme Consistency**: Unified dark theme across all pages and components

### Extending the Application

To add support for new disaster types:

1. **Add API integration** in `server.js` with appropriate data fetching
2. **Update event configuration** in `public/script.js` (colors, icons, types)
3. **Add styling** for the new event type in `public/styles.css`
4. **Schedule data fetching** using node-cron intervals

### Database Schema

SQLite database contains:

- **events**: Disaster event data with location, magnitude, timestamps
- **admin_users**: Admin authentication credentials (bcrypt hashed)

## License

GNU General Public License v3.0 - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

---

**Note**: This project demonstrates real-time data integration, interactive web mapping, responsive design, and full-stack development practices with modern web technologies.
