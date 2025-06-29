// Global variables
let map;
let eventMarkers = [];
let allEvents = [];

// Configuration for different event types
const eventConfig = {
    earthquake: {
        color: '#dc2626',
        icon: '🌋',
        shape: 'circle'
    },
    tsunami: {
        color: '#0891b2',
        icon: '🌊',
        shape: 'triangle'
    },
    volcano: {
        color: '#ea580c',
        icon: '🌋',
        shape: 'diamond'
    },
    wildfire: {
        color: '#dc2626',
        icon: '🔥',
        shape: 'square'
    },
    flood: {
        color: '#2563eb',
        icon: '🌊',
        shape: 'pentagon'
    },
    solar: {
        color: '#facc15',
        icon: '☀️',
        shape: 'star'
    }
};

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadEvents();
    loadStats();
    setupEventListeners();
    
    // Refresh data every 10 minutes
    setInterval(() => {
        loadEvents();
        loadStats();
    }, 10 * 60 * 1000);
});

// Set up the Leaflet map
function initializeMap() {
    map = L.map('map').setView([20, 0], 2);
    
    // Dark theme tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
}

// Set up event listeners
function setupEventListeners() {
    const filterSelect = document.getElementById('eventFilter');
    filterSelect.addEventListener('change', function() {
        filterEvents(this.value);
    });
}

// Load events from the API
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        const events = await response.json();
        
        allEvents = events;
        displayEventsOnMap(events);
        displayRecentEvents(events.slice(0, 20));
        
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Failed to load events');
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        displayStats(stats);
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Put events on the map
function displayEventsOnMap(events) {
    // Clear existing markers
    eventMarkers.forEach(marker => map.removeLayer(marker));
    eventMarkers = [];
    
    events.forEach(event => {
        const marker = createEventMarker(event);
        if (marker) {
            eventMarkers.push(marker);
            marker.addTo(map);
        }
    });
}

// Create custom marker for each event type
function createEventMarker(event) {
    const config = eventConfig[event.type] || eventConfig.earthquake;
    
    // Create custom icon
    const iconHtml = `
        <div style="
            background-color: ${config.color};
            width: 12px;
            height: 12px;
            border-radius: ${getShapeStyle(config.shape)};
            border: 2px solid white;
            box-shadow: 0 0 6px rgba(0,0,0,0.5);
        "></div>
    `;
    
    const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-event-marker',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
    
    const marker = L.marker([event.latitude, event.longitude], {
        icon: customIcon
    });
    
    // For tsunami events, add a transparent circle to show affected area
    if (event.type === 'tsunami') {
        // Calculate radius based on threat level (magnitude field for tsunamis)
        const threatLevel = event.magnitude || 1;
        let radius = 50000; // Default 50km
        
        if (threatLevel >= 3) radius = 200000; // Warning: 200km
        else if (threatLevel >= 2) radius = 150000; // Watch: 150km
        else radius = 100000; // Advisory: 100km
        
        const circle = L.circle([event.latitude, event.longitude], {
            color: config.color,
            fillColor: config.color,
            fillOpacity: 0.1,
            opacity: 0.5,
            radius: radius,
            weight: 2
        });
        
        // Store circle reference to remove it later
        marker._tsunamiCircle = circle;
        circle.addTo(map);
        
        // Add circle to markers array so it gets cleaned up
        eventMarkers.push(circle);
    }
    
    // Create popup content
    const popupContent = createPopupContent(event);
    marker.bindPopup(popupContent);
    
    // Add click event to show modal
    marker.on('click', () => showEventModal(event));
    
    return marker;
}

// Get CSS for different shapes
function getShapeStyle(shape) {
    switch (shape) {
        case 'circle': return '50%';
        case 'square': return '0';
        case 'diamond': return '0';
        case 'triangle': return '0';
        case 'pentagon': return '0';
        case 'star': return '0';
        default: return '50%';
    }
}

// Create popup content
function createPopupContent(event) {
    const timeString = new Date(event.time).toLocaleString();
    
    let details = `
        <div style="color: white;">
            <h4>${event.title}</h4>
            <p><strong>Type:</strong> ${event.type.charAt(0).toUpperCase() + event.type.slice(1)}</p>
            <p><strong>Location:</strong> ${event.location || 'Unknown'}</p>
            <p><strong>Time:</strong> ${timeString}</p>
    `;
    
    if (event.type === 'tsunami' && event.magnitude) {
        // For tsunamis, show threat level instead of magnitude
        let threatLevel = 'Advisory';
        if (event.magnitude >= 3) threatLevel = 'Warning';
        else if (event.magnitude >= 2) threatLevel = 'Watch';
        details += `<p><strong>Threat Level:</strong> ${threatLevel}</p>`;
    } else if (event.magnitude) {
        details += `<p><strong>Magnitude:</strong> ${event.magnitude}</p>`;
    }
    
    if (event.depth) {
        details += `<p><strong>Depth:</strong> ${event.depth} km</p>`;
    }
    
    details += `<p style="margin-top: 10px;"><button onclick="showEventModal(${JSON.stringify(event).replace(/"/g, '&quot;')})">View Details</button></p></div>`;
    
    return details;
}

// Show recent events in the sidebar
function displayRecentEvents(events) {
    const eventsList = document.getElementById('eventsList');
    
    if (events.length === 0) {
        eventsList.innerHTML = '<div class="loading">No events found</div>';
        return;
    }
    
    const eventsHtml = events.map(event => {
        const timeString = new Date(event.time).toLocaleDateString();
        const config = eventConfig[event.type] || eventConfig.earthquake;
        
        return `
            <div class="event-item ${event.type}" onclick="showEventModal(${JSON.stringify(event).replace(/"/g, '&quot;')})">
                <div class="event-header">
                    <div class="event-icon ${event.type}">${config.icon}</div>
                    <span class="event-type">${event.type}</span>
                </div>
                <div class="event-location">${event.location || event.title}</div>
                <div class="event-details">
                    ${event.magnitude ? `Magnitude: ${event.magnitude}` : ''}
                    ${event.depth ? ` | Depth: ${event.depth}km` : ''}
                </div>
                <div class="event-time">${timeString}</div>
            </div>
        `;
    }).join('');
    
    eventsList.innerHTML = eventsHtml;
}

// Show stats in the sidebar
function displayStats(stats) {
    const statsContainer = document.getElementById('statsContainer');
    
    let statsHtml = `
        <div class="stat-item">
            <span class="stat-number">${stats.total || 0}</span>
            <span class="stat-label">Total Events</span>
        </div>
    `;
    
    // Add individual event type counts
    Object.keys(eventConfig).forEach(type => {
        if (stats[type]) {
            statsHtml += `
                <div class="stat-item">
                    <span class="stat-number">${stats[type]}</span>
                    <span class="stat-label">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                </div>
            `;
        }
    });
    
    statsContainer.innerHTML = statsHtml;
}

// Filter events by type
function filterEvents(type) {
    let filteredEvents = allEvents;
    
    if (type) {
        filteredEvents = allEvents.filter(event => event.type === type);
    }
    
    displayEventsOnMap(filteredEvents);
    displayRecentEvents(filteredEvents.slice(0, 20));
}

// Show event modal
function showEventModal(event) {
    const modal = document.getElementById('eventModal');
    const modalContent = document.getElementById('modalContent');
    
    const timeString = new Date(event.time).toLocaleString();
    const config = eventConfig[event.type] || eventConfig.earthquake;
    
    let detailsHtml = `
        <h3>${config.icon} ${event.title}</h3>
        <div class="modal-detail"><strong>Type:</strong> ${event.type.charAt(0).toUpperCase() + event.type.slice(1)}</div>
        <div class="modal-detail"><strong>Location:</strong> ${event.location || 'Unknown'}</div>
        <div class="modal-detail"><strong>Coordinates:</strong> ${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}</div>
        <div class="modal-detail"><strong>Time:</strong> ${timeString}</div>
    `;
    
    if (event.type === 'tsunami' && event.magnitude) {
        // For tsunamis, show threat level instead of magnitude
        let threatLevel = 'Advisory';
        let threatColor = '#facc15';
        if (event.magnitude >= 3) {
            threatLevel = 'Warning';
            threatColor = '#dc2626';
        } else if (event.magnitude >= 2) {
            threatLevel = 'Watch';
            threatColor = '#ea580c';
        }
        detailsHtml += `<div class="modal-detail"><strong>Threat Level:</strong> <span style="color: ${threatColor}; font-weight: bold;">${threatLevel}</span></div>`;
    } else if (event.magnitude) {
        detailsHtml += `<div class="modal-detail"><strong>Magnitude:</strong> ${event.magnitude}</div>`;
    }
    
    if (event.depth) {
        detailsHtml += `<div class="modal-detail"><strong>Depth:</strong> ${event.depth} km</div>`;
    }
    
    if (event.description) {
        detailsHtml += `<div class="modal-detail"><strong>Description:</strong> ${event.description}</div>`;
    }
    
    if (event.url) {
        detailsHtml += `<div class="modal-detail"><strong>More Info:</strong> <a href="${event.url}" target="_blank" style="color: #ff6b35;">View Details</a></div>`;
    }
    
    modalContent.innerHTML = detailsHtml;
    modal.style.display = 'block';
    
    // Center map on event
    map.setView([event.latitude, event.longitude], 8);
}

// Close modal
function closeModal() {
    const modal = document.getElementById('eventModal');
    modal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('eventModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Handle error messages
function showError(message) {
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = `<div class="loading" style="color: #dc2626;">${message}</div>`;
}

// Close modal with escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});
