# PulseMap - Live Natural Disaster Monitoring

PulseMap is a real-time web app I built that gives live updates on natural disasters around the world like earthquakes, tsunamis, volcanoes, wildfires, floods, and solar flares.

## What it does

- **Interactive World Map**: Dark-themed world map with custom markers for different disaster types
- **Real-time Updates**: Grabs fresh data every 10 minutes from public APIs
- **Event Filtering**: Filter events by type using the dropdown
- **Detailed Info**: Click on map markers or sidebar events to see more details
- **Admin Dashboard**: Secure admin panel for managing events and cleaning up data
- **Responsive Design**: Works great on desktop and mobile
- **7-day Data Retention**: Automatically cleans up old data (can do it manually too)

## How I built it

- **Backend**: Node.js + Express.js
- **Database**: SQLite (simple and portable)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Maps**: Leaflet.js
- **Auth**: bcryptjs + express-session
- **APIs**: USGS Earthquake API (planning to add more)
- **Deployment**: Set up for Fly.io

## Getting it running

1. **Clone this repo**:
   ```bash
   git clone <repository-url>
   cd pulsemap
   ```

2. **Install the dependencies**:
   ```bash
   npm install
   ```

3. **Fire it up**:
   ```bash
   npm start
   ```

4. **Check it out**:
   - Main app: http://localhost:3000
   - Admin panel: http://localhost:3000/admin

## Admin stuff

Default login:
- **Username**: admin
- **Password**: admin123

**Note**: Definitely change this password if you deploy this anywhere!

## How it gets data

Right now it's connected to:
- **USGS Earthquake API**: Live earthquake data

I built it so I can easily add more APIs for other disasters later. It fetches new data every 10 minutes and saves everything to a local SQLite database.

## Deploying it

### Fly.io (what I use)

1. **Get Fly CLI**: https://fly.io/docs/hands-on/install-flyctl/

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Deploy it**:
   ```bash
   fly deploy
   ```

4. **Set your secrets**:
   ```bash
   fly secrets set SESSION_SECRET=your-secure-session-secret-here
   ```

## Development stuff

### How it's organized

```
pulsemap/
├── server.js              # Main server file
├── routes/
│   ├── api.js             # API routes for events
│   └── admin.js           # Admin routes
├── public/
│   ├── index.html         # Main app page
│   ├── admin.html         # Admin dashboard
│   ├── login.html         # Admin login
│   ├── styles.css         # All the styling
│   └── script.js          # Frontend JS
├── package.json
├── Dockerfile            # Docker setup
├── fly.toml             # Fly.io config
└── README.md
```

### Adding more disaster APIs

If I want to add support for new disaster types:

1. **Add API fetching function** in `server.js`
2. **Update event config** in `public/script.js`
3. **Add styling for the new type** in `public/styles.css`
4. **Schedule the API calls** with node-cron

### Database setup

SQLite database has these tables:

- **events**: All the disaster events
- **admin_users**: Admin login credentials

## License

GNU General Public License v3.0 - see the LICENSE file for details.

---

**Note**: Built this as my capstone project to show off real-time data integration, web mapping, and full-stack development stuff.
