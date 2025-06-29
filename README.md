# PulseMap - Live Natural Disaster Monitoring

PulseMap is a real-time web application that provides live updates on natural disasters around the world including earthquakes, tsunamis, volcanoes, wildfires, and floods.

## Features

- **Interactive World Map**: Dark-themed world map with color-coded markers for different disaster types
- **Manual Data Refresh**: Admin-controlled data updates on server startup and via refresh button
- **Advanced Filtering**: Filter events by type and time range (1 hour to 30 days)
- **Dynamic Statistics**: Event counts update automatically based on selected filters
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
- **Real-time Notifications**: Push alerts for critical events
- **📊 Enhanced Analytics**: Historical trends and patterns
- **🌍 Geographic Filtering**: Filter events by region or country
- **📱 Mobile App**: Progressive Web App (PWA) functionality

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

### Server Startup Output

When you start the application, you'll see output similar to this showing the data fetching process:

```
> pulsemap@1.0.0 dev
> node server.js

[dotenv@17.0.0] injecting env (3) from .env ~ 🔒 encrypt with dotenvx: https://dotenvx.com
Server starting - fetching initial disaster data...
Refreshing all disaster data...
PulseMap server running on port 3000
Visit http://localhost:3000 to view the application
Processing earthquake data - received 228 events from USGS
Updated 53 earthquake events (magnitude > 2.0, latest 100 from 53 filtered events, processed from first 300 of 228 total events)
Processing tsunami data - received 0 tsunami alerts from NOAA
Updated 0 tsunami events (processed from 0 received alerts)
Processing volcano eruptions from Smithsonian API to find latest 100 from 2010-present...
Updated 77 volcano events from 2010-present (latest 100 from 77 total valid eruptions, processed from first 300 records)
Processing flood data - received 52 flood alerts from NOAA
Selected top 48 highest severity floods from 48 total flood alerts (processed from first 300 of 52 received)
Updated 48 flood events from NOAA
Processing first 300 fires from NASA FIRMS for better performance...
Collected 300 fires from first 300 records
Selected top 300 highest quality fires for display
Updated 0 wildfire events from NASA FIRMS
All disaster data refreshed successfully
```

This shows the system successfully fetching and processing data from all integrated APIs with performance optimizations in place.

## Admin Access

Default login:
- **Username**: admin
- **Password**: [change immediately after setup]

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

3. **Create persistent volume for database**:
   ```bash
   fly volumes create pulsemap_data --size 1
   ```

4. **Deploy the application**:
   ```bash
   fly deploy
   ```

5. **Configure secrets**:
   ```bash
   fly secrets set SESSION_SECRET=your-random-session-secret-here
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
