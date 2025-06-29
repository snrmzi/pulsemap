# PulseMap Development Guidelines

This is a Node.js Express web application for monitoring natural disasters in real-time.

## Project Structure:
- **Backend**: Node.js + Express + SQLite
- **Frontend**: Vanilla HTML/CSS/JavaScript with Leaflet.js for maps
- **Database**: SQLite for simplicity and portability
- **Deployment**: Configured for Fly.io

## Key Features:
- Real-time natural disaster monitoring (earthquakes, tsunamis, volcanoes, etc.)
- Interactive world map with event markers
- Admin dashboard for event management
- Automatic data fetching from public APIs
- 7-day data retention with manual cleanup

## Code Conventions:
- Use async/await for asynchronous operations
- Follow RESTful API design patterns
- Use proper error handling and logging
- Maintain responsive design principles
- Keep functions modular and reusable

## API Integration:
- Currently integrated with USGS Earthquake API
- Designed to support multiple disaster APIs
- Data is fetched every 10 minutes and stored in SQLite

## Security:
- Session-based authentication for admin
- Password hashing with bcryptjs
- Environment variables for sensitive data
