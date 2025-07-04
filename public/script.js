// PulseMap - Live Natural Disaster Monitoring
// Combined script for main page, admin page, and login page

// Global variables
let map;
let markers = [];
let currentEvents = [];
let eventFilter = '';
let timeFilter = ''; // Hours to filter by (empty = no filter)

// Configuration
const EVENT_COLORS = {
    earthquake: '#ffffff',    // white
    tsunami: '#0066cc',      // blue
    volcano: '#cc3300',      // red
    wildfire: '#8B4513',     // brown (base color)
    flood: '#000080'         // navy blue
};

// Wildfire intensity color gradient (light brown to dark brown)
const getWildfireColor = (intensity) => {
    if (!intensity) return '#D2B48C'; // light brown default
    
    // Normalize intensity (0-1 scale) and create gradient from light to dark brown
    const normalizedIntensity = Math.min(Math.max(intensity / 10, 0), 1);
    
    // Light brown to dark brown gradient
    const lightBrown = { r: 210, g: 180, b: 140 }; // #D2B48C
    const darkBrown = { r: 101, g: 67, b: 33 };    // #654321
    
    const r = Math.round(lightBrown.r + (darkBrown.r - lightBrown.r) * normalizedIntensity);
    const g = Math.round(lightBrown.g + (darkBrown.g - lightBrown.g) * normalizedIntensity);
    const b = Math.round(lightBrown.b + (darkBrown.b - lightBrown.b) * normalizedIntensity);
    
    return `rgb(${r}, ${g}, ${b})`;
};

const EVENT_ICONS = {
    earthquake: '⚡',
    tsunami: '🌊',
    volcano: '🌋',
    wildfire: '🔥',
    flood: '💧'
};

// Initialize the application based on current page
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, current URL:', window.location.href);
    const currentPath = window.location.pathname;
    const bodyClass = document.body.className;
    
    console.log('Current path:', currentPath);
    console.log('Body class:', bodyClass);
    
    // Check if we're on login page by looking for login form
    if (document.getElementById('loginForm')) {
        console.log('Login form detected, initializing login page');
        initLoginPage();
    }
    // Check if we're on admin page by looking for admin content
    else if (document.getElementById('eventsTable') || currentPath.includes('admin')) {
        console.log('Admin page detected, initializing admin page');
        initAdminPage();
    }
    // Default to main page
    else {
        console.log('Main page detected, initializing main page');
        initMainPage();
    }
});

// ===== MAIN PAGE FUNCTIONALITY =====

function initMainPage() {
    initMap();
    loadEvents();
    setupEventFilter();
    setupTimeFilter();
    
    // Note: Auto-refresh removed - data is now only updated on server startup 
    // and manual refresh from admin dashboard
}

function initMap() {
    // Initialize the map
    map = L.map('map').setView([20, 0], 2);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function setupEventFilter() {
    const filterSelect = document.getElementById('eventFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function(e) {
            eventFilter = e.target.value;
            updateMapMarkers();
            updateEventsList();
            updateStats(); // Update stats when event filter changes
        });
    }
}

function setupTimeFilter() {
    const timeFilterSelect = document.getElementById('timeFilter');
    if (timeFilterSelect) {
        timeFilterSelect.addEventListener('change', function(e) {
            timeFilter = e.target.value;
            updateMapMarkers();
            updateEventsList();
            updateStats(); // Update stats when time filter changes
        });
    }
}

// Helper function to filter events by time
function filterEventsByTime(events) {
    if (!timeFilter) return events;
    
    const now = Date.now();
    const hoursInMs = parseInt(timeFilter) * 60 * 60 * 1000;
    const cutoffTime = now - hoursInMs;
    
    return events.filter(event => {
        return event.time >= cutoffTime;
    });
}

// Helper function to apply all filters
function applyAllFilters(events) {
    let filteredEvents = [...events];
    
    // Apply event type filter
    if (eventFilter) {
        filteredEvents = filteredEvents.filter(event => event.type === eventFilter);
    }
    
    // Apply time filter
    filteredEvents = filterEventsByTime(filteredEvents);
    
    return filteredEvents;
}

async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        const data = await response.json();
        currentEvents = Array.isArray(data) ? data : (data.events || []);
        
        updateMapMarkers();
        updateEventsList();
        updateStats();
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Failed to load events');
    }
}

function updateMapMarkers() {
    // Clear existing markers and their associated circles
    markers.forEach(marker => {
        map.removeLayer(marker);
        // Remove earthquake circle if it exists
        if (marker._earthquakeCircle) {
            map.removeLayer(marker._earthquakeCircle);
        }
        // Remove tsunami circle if it exists
        if (marker._tsunamiCircle) {
            map.removeLayer(marker._tsunamiCircle);
        }
        // Remove wildfire circle if it exists
        if (marker._wildfireCircle) {
            map.removeLayer(marker._wildfireCircle);
        }
        // Remove flood circle if it exists
        if (marker._floodCircle) {
            map.removeLayer(marker._floodCircle);
        }
    });
    markers = [];
    
    // Filter events with all active filters
    let eventsToShow = applyAllFilters(currentEvents);
    
    // Add new markers
    eventsToShow.forEach(event => {
        if (event.latitude && event.longitude) {
            const marker = createEventMarker(event);
            markers.push(marker);
            marker.addTo(map);
            
            // Add earthquake circle to map if it exists
            if (marker._earthquakeCircle) {
                marker._earthquakeCircle.addTo(map);
            }
            
            // Add tsunami circle to map if it exists
            if (marker._tsunamiCircle) {
                marker._tsunamiCircle.addTo(map);
            }
            
            // Add wildfire circle to map if it exists
            if (marker._wildfireCircle) {
                marker._wildfireCircle.addTo(map);
            }
            
            // Add flood circle to map if it exists
            if (marker._floodCircle) {
                marker._floodCircle.addTo(map);
            }
        }
    });
}

function createEventMarker(event) {
    // Get color based on event type, with special handling for wildfire intensity
    let color;
    if (event.type === 'wildfire') {
        color = getWildfireColor(event.magnitude); // magnitude stores intensity for wildfires
    } else {
        color = EVENT_COLORS[event.type] || '#666666';
    }
    
    const icon = EVENT_ICONS[event.type] || '📍';
    
    // Create custom icon
    const customIcon = L.divIcon({
        html: `<div style="background-color: ${color}; border: 2px solid #333; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px;">${icon}</div>`,
        className: 'custom-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    const marker = L.marker([event.latitude, event.longitude], { icon: customIcon });
    
    // Add affected area circle for earthquakes (magnitude 2.5+)
    if (event.type === 'earthquake' && event.magnitude >= 2.5 && event.affected_radius) {
        // Use the calculated affected radius from database (converted to meters)
        const radius = event.affected_radius * 1000; // Convert km to meters
        
        const circle = L.circle([event.latitude, event.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.1,
            radius: radius,
            weight: 2,
            opacity: 0.3
        });
        
        // Store the circle reference with the marker for cleanup
        marker._earthquakeCircle = circle;
    }

    // Add affected area circle for tsunamis
    if (event.type === 'tsunami') {
        // Use calculated affected radius from database or default 50km
        const radius = (event.affected_radius || 50) * 1000; // Convert km to meters
        const circle = L.circle([event.latitude, event.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.1,
            radius: radius,
            weight: 2,
            opacity: 0.6
        });
        
        // Store the circle reference with the marker for cleanup
        marker._tsunamiCircle = circle;
    }

    // Add affected area circle for wildfires
    if (event.type === 'wildfire') {
        // Use calculated affected radius from database or calculate from intensity
        let radius;
        if (event.affected_radius) {
            radius = event.affected_radius * 1000; // Convert km to meters
        } else {
            // Fallback calculation if no radius in database
            const intensity = event.magnitude || 1;
            radius = Math.max(1000, Math.min(5000, intensity * 500)); // 1-5km based on intensity
        }
        
        const circle = L.circle([event.latitude, event.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.1,
            radius: radius,
            weight: 2,
            opacity: 0.6
        });
        
        // Store the circle reference with the marker for cleanup
        marker._wildfireCircle = circle;
    }

    // Add affected area circle for floods
    if (event.type === 'flood') {
        // Use calculated affected radius from database or calculate from severity
        let radius;
        if (event.affected_radius) {
            radius = event.affected_radius * 1000; // Convert km to meters
        } else {
            // Fallback calculation if no radius in database
            const severity = event.magnitude || 1;
            radius = Math.max(15000, Math.min(100000, severity * 25000)); // 15-100km based on severity
        }
        
        const circle = L.circle([event.latitude, event.longitude], {
            color: color,
            fillColor: color,
            fillOpacity: 0.1,
            radius: radius,
            weight: 2,
            opacity: 0.6
        });
        
        // Store the circle reference with the marker for cleanup
        marker._floodCircle = circle;
    }
    
    // Add popup
    const popupContent = createPopupContent(event);
    marker.bindPopup(popupContent);
    
    return marker;
}

function createPopupContent(event) {
    const timestamp = event.time || event.timestamp;
    const date = new Date(timestamp).toLocaleDateString();
    let content = `
        <div class="popup-content">
            <h3>${event.title || `${event.type.charAt(0).toUpperCase() + event.type.slice(1)}`}</h3>
            <p><strong>Type:</strong> ${event.type}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Location:</strong> ${event.location || 'Unknown'}</p>
    `;
    
    if (event.type === 'tsunami' && event.magnitude) {
        // For tsunamis, magnitude represents threat level
        const threatLevels = { 1: 'Advisory', 2: 'Watch', 3: 'Warning' };
        const threatLevel = threatLevels[event.magnitude] || 'Unknown';
        content += `<p><strong>Threat Level:</strong> ${threatLevel}</p>`;
        content += `<p><strong>Affected Radius:</strong> 50 km</p>`;
    } else if (event.type === 'wildfire' && event.magnitude) {
        // For wildfires, magnitude represents intensity
        content += `<p><strong>Intensity:</strong> ${event.magnitude}/10</p>`;
        const radius = Math.max(1, Math.min(5, event.magnitude * 0.5));
        content += `<p><strong>Affected Radius:</strong> ${radius.toFixed(1)} km</p>`;
    } else if (event.type === 'volcano' && event.magnitude) {
        // For volcanoes, magnitude represents alert level
        const alertLevels = { 1: 'Advisory', 2: 'Watch', 3: 'Warning' };
        const alertLevel = alertLevels[event.magnitude] || 'Unknown';
        content += `<p><strong>Alert Level:</strong> ${alertLevel}</p>`;
    } else if (event.type === 'flood' && event.magnitude) {
        // For floods, magnitude represents severity level
        const severityLevels = { 1: 'Advisory', 2: 'Watch', 3: 'Warning' };
        const severityLevel = severityLevels[Math.floor(event.magnitude)] || 'Unknown';
        content += `<p><strong>Severity Level:</strong> ${severityLevel}</p>`;
        const radius = Math.max(15, Math.min(100, event.magnitude * 25));
        content += `<p><strong>Affected Radius:</strong> ${radius.toFixed(0)} km</p>`;
    } else if (event.magnitude) {
        // For earthquakes and others, show magnitude
        content += `<p><strong>Magnitude:</strong> ${event.magnitude}</p>`;
    }
    
    if (event.depth) {
        content += `<p><strong>Depth:</strong> ${event.depth} km</p>`;
    }
    
    content += '</div>';
    return content;
}

function updateEventsList() {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;
    
    // Filter events with all active filters
    let eventsToShow = applyAllFilters(currentEvents);
    
    if (eventsToShow.length === 0) {
        eventsList.innerHTML = '<div class="no-events">No events found</div>';
        return;
    }
    
    // Sort by timestamp (newest first)
    eventsToShow.sort((a, b) => {
        const timeA = a.time || a.timestamp || 0;
        const timeB = b.time || b.timestamp || 0;
        return new Date(timeB) - new Date(timeA);
    });
    
    const html = eventsToShow.slice(0, 20).map((event, index) => {
        const timestamp = event.time || event.timestamp;
        const date = new Date(timestamp).toLocaleDateString();
        const time = new Date(timestamp).toLocaleTimeString();
        const icon = EVENT_ICONS[event.type] || '📍';
        
        // Get appropriate magnitude label based on event type
        let magnitudeDisplay = '';
        if (event.magnitude) {
            if (event.type === 'tsunami') {
                const threatLevels = { 1: 'Advisory', 2: 'Watch', 3: 'Warning' };
                const threatLevel = threatLevels[event.magnitude] || 'Unknown';
                magnitudeDisplay = `<div class="event-magnitude">Threat Level: ${threatLevel}</div>`;
            } else if (event.type === 'wildfire') {
                magnitudeDisplay = `<div class="event-magnitude">Intensity: ${event.magnitude}/10</div>`;
            } else if (event.type === 'volcano') {
                const alertLevels = { 1: 'Advisory', 2: 'Watch', 3: 'Warning' };
                const alertLevel = alertLevels[event.magnitude] || 'Unknown';
                magnitudeDisplay = `<div class="event-magnitude">Alert Level: ${alertLevel}</div>`;
            } else if (event.type === 'flood') {
                const severityLevels = { 1: 'Advisory', 2: 'Watch', 3: 'Warning' };
                const severityLevel = severityLevels[Math.floor(event.magnitude)] || 'Unknown';
                magnitudeDisplay = `<div class="event-magnitude">Severity: ${severityLevel}</div>`;
            } else {
                magnitudeDisplay = `<div class="event-magnitude">Magnitude: ${event.magnitude}</div>`;
            }
        }
        
        return `
            <div class="event-item" onclick="centerMapOnEvent(${event.latitude}, ${event.longitude})" style="cursor: pointer;">
                <div class="event-icon">${icon}</div>
                <div class="event-details">
                    <div class="event-title">${event.title || `${event.type.charAt(0).toUpperCase() + event.type.slice(1)}`}</div>
                    <div class="event-location">${event.location || 'Unknown location'}</div>
                    <div class="event-time">${date} ${time}</div>
                    ${magnitudeDisplay}
                </div>
            </div>
        `;
    }).join('');
    
    eventsList.innerHTML = html;
}

function updateStats() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;
    
    // Use filtered events instead of all events for statistics
    const eventsToCount = applyAllFilters(currentEvents);
    
    // Count events by type
    const eventCounts = {
        earthquake: 0,
        tsunami: 0,
        volcano: 0,
        wildfire: 0,
        flood: 0,
        total: 0
    };
    
    eventsToCount.forEach(event => {
        if (eventCounts.hasOwnProperty(event.type)) {
            eventCounts[event.type]++;
        }
        eventCounts.total++;
    });
    
    // Create stats HTML
    let statsHTML = `
        <div class="stat-item">
            <span class="stat-number">${eventCounts.total}</span>
            <span class="stat-label">Total Events</span>
        </div>
    `;
    
    // Add individual type counts if they exist
    if (eventCounts.earthquake > 0) {
        statsHTML += `
            <div class="stat-item">
                <span class="stat-number">${eventCounts.earthquake}</span>
                <span class="stat-label">Earthquakes</span>
            </div>
        `;
    }
    
    if (eventCounts.tsunami > 0) {
        statsHTML += `
            <div class="stat-item">
                <span class="stat-number">${eventCounts.tsunami}</span>
                <span class="stat-label">Tsunamis</span>
            </div>
        `;
    }
    
    if (eventCounts.volcano > 0) {
        statsHTML += `
            <div class="stat-item">
                <span class="stat-number">${eventCounts.volcano}</span>
                <span class="stat-label">Volcanoes</span>
            </div>
        `;
    }
    
    if (eventCounts.wildfire > 0) {
        statsHTML += `
            <div class="stat-item">
                <span class="stat-number">${eventCounts.wildfire}</span>
                <span class="stat-label">Wildfires</span>
            </div>
        `;
    }
    
    if (eventCounts.flood > 0) {
        statsHTML += `
            <div class="stat-item">
                <span class="stat-number">${eventCounts.flood}</span>
                <span class="stat-label">Floods</span>
            </div>
        `;
    }
    
    statsContainer.innerHTML = statsHTML;
}

function showError(message) {
    const eventsList = document.getElementById('eventsList');
    if (eventsList) {
        eventsList.innerHTML = `<div class="error">${message}</div>`;
    }
}

// ===== LOGIN PAGE FUNCTIONALITY =====

function initLoginPage() {
    console.log('=== Initializing login page ===');
    const loginForm = document.getElementById('loginForm');
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    
    console.log('Login form:', loginForm);
    console.log('Username field:', usernameField);
    console.log('Password field:', passwordField);
    
    if (loginForm) {
        console.log('Adding submit event listener to login form');
        
        // Remove any existing event listeners
        loginForm.removeEventListener('submit', handleLogin);
        
        // Add the event listener
        loginForm.addEventListener('submit', function(e) {
            console.log('=== Form submit event triggered ===');
            handleLogin(e);
        });
        
        // Also add a backup event listener to the button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', function(e) {
                console.log('=== Login button clicked ===');
                if (e.target.form) {
                    e.preventDefault();
                    handleLogin(e);
                }
            });
        }
        
        console.log('Event listeners added successfully');
    } else {
        console.error('Login form not found!');
    }
}

async function handleLogin(e) {
    console.log('Login form submitted');
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');
    const loginBtn = document.getElementById('loginBtn');
    
    console.log('Attempting login with username:', username);
    
    // Show loading state
    loginBtn.textContent = 'Signing In...';
    loginBtn.disabled = true;
    
    try {
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            messageDiv.innerHTML = '<div style="color: green;">Login successful! Redirecting...</div>';
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1000);
        } else {
            messageDiv.innerHTML = `<div style="color: red;">${data.error || 'Login failed'}</div>`;
            loginBtn.textContent = 'Sign In';
            loginBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        messageDiv.innerHTML = '<div style="color: red;">Network error. Please try again.</div>';
        loginBtn.textContent = 'Sign In';
        loginBtn.disabled = false;
    }
}

// ===== ADMIN PAGE FUNCTIONALITY =====

function initAdminPage() {
    // Load admin events and let the server handle authentication
    // If not authenticated, the server will return 401 and we'll redirect
    loadAdminEvents();
    setupAdminEventFilter();
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Setup add event button
    const addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) {
        addEventBtn.addEventListener('click', showAddEventModal);
    }
    
    // Setup form submission
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
    
    // Edit form submit handler
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const eventId = document.getElementById('editEventId').value;
            const eventData = {
                title: document.getElementById('editTitle').value,
                magnitude: document.getElementById('editMagnitude').value || null,
                depth: document.getElementById('editDepth').value || null,
                latitude: parseFloat(document.getElementById('editLatitude').value),
                longitude: parseFloat(document.getElementById('editLongitude').value),
                location: document.getElementById('editLocation').value
            };
            
            try {
                const response = await fetch(`/admin/events/${eventId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(eventData)
                });
                
                if (response.ok) {
                    closeEditModal();
                    loadAdminEvents(); // Refresh the events list
                    showAdminMessage('Event updated successfully', 'success');
                } else {
                    const error = await response.text();
                    showAdminError('Failed to update event: ' + error);
                }
            } catch (error) {
                console.error('Error updating event:', error);
                showAdminError('Failed to update event');
            }
        });
    }
}

function setupAdminEventFilter() {
    const filterSelect = document.getElementById('adminEventFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function(e) {
            eventFilter = e.target.value;
            displayAdminEvents();
        });
    }
}

async function loadAdminEvents() {
    try {
        const response = await fetch('/admin/events', {
            method: 'GET',
            credentials: 'include' // Include session cookies
        });
        
        if (response.status === 401) {
            // Not authenticated, redirect to login
            window.location.href = '/admin';
            return;
        }
        
        const data = await response.json();
        currentEvents = data || [];
        displayAdminEvents();
        updateAdminStats();
    } catch (error) {
        console.error('Error loading admin events:', error);
        showAdminError('Failed to load events');
    }
}

function displayAdminEvents() {
    const eventsContainer = document.getElementById('eventsContainer');
    if (!eventsContainer) return;
    
    // Filter events if needed
    let eventsToShow = currentEvents;
    if (eventFilter) {
        eventsToShow = currentEvents.filter(event => event.type === eventFilter);
    }
    
    if (eventsToShow.length === 0) {
        eventsContainer.innerHTML = '<div class="no-events">No events found</div>';
        return;
    }
    
    // Sort by timestamp (newest first)
    eventsToShow.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    const html = `
        <table class="events-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Location</th>
                    <th>Magnitude</th>
                    <th>Date/Time</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${eventsToShow.map(event => {
                    const date = new Date(event.time).toLocaleString();
                    return `
                        <tr>
                            <td>${event.id}</td>
                            <td><span class="event-type-badge ${event.type}">${event.type}</span></td>
                            <td>${event.title || '-'}</td>
                            <td>${event.location || '-'}</td>
                            <td>${event.magnitude || '-'}</td>
                            <td>${date}</td>
                            <td>
                                <button onclick="editEvent(${event.id})" class="btn btn-sm">Edit</button>
                                <button onclick="deleteEvent(${event.id})" class="btn btn-sm btn-danger">Delete</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    eventsContainer.innerHTML = html;
}

function updateAdminStats() {
    const totalEventsEl = document.getElementById('totalEvents');
    if (totalEventsEl) {
        let eventsToCount = currentEvents;
        if (eventFilter) {
            eventsToCount = currentEvents.filter(event => event.type === eventFilter);
        }
        totalEventsEl.textContent = eventsToCount.length;
    }
    
    // Update stats grid with breakdown
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid && currentEvents.length > 0) {
        const eventTypes = ['earthquake', 'tsunami', 'volcano', 'wildfire', 'flood'];
        const stats = {};
        
        // Count events by type
        eventTypes.forEach(type => {
            stats[type] = currentEvents.filter(event => event.type === type).length;
        });
        
        // Build stats HTML
        const statsHtml = `
            <div class="stat-card">
                <span class="stat-number">${currentEvents.length}</span>
                <div class="stat-label">Total Events</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.earthquake}</span>
                <div class="stat-label">Earthquakes</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.tsunami}</span>
                <div class="stat-label">Tsunamis</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.volcano}</span>
                <div class="stat-label">Volcanoes</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.wildfire}</span>
                <div class="stat-label">Wildfires</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.flood}</span>
                <div class="stat-label">Floods</div>
            </div>
        `;
        
        statsGrid.innerHTML = statsHtml;
    }
}

function showAddEventModal() {
    const modal = document.getElementById('eventModal');
    const modalTitle = document.getElementById('modalTitle');
    const eventForm = document.getElementById('eventForm');
    
    if (modal && modalTitle && eventForm) {
        modalTitle.textContent = 'Add New Event';
        eventForm.reset();
        eventForm.removeAttribute('data-event-id');
        modal.style.display = 'block';
    }
}

function editEvent(eventId) {
    const event = currentEvents.find(e => e.id === eventId);
    if (!event) return;
    
    const modal = document.getElementById('editModal');
    if (!modal) return;
    
    // Populate form with event data
    document.getElementById('editEventId').value = eventId;
    document.getElementById('editTitle').value = event.title || '';
    document.getElementById('editMagnitude').value = event.magnitude || '';
    document.getElementById('editDepth').value = event.depth || '';
    document.getElementById('editLatitude').value = event.latitude;
    document.getElementById('editLongitude').value = event.longitude;
    document.getElementById('editLocation').value = event.location || '';
    
    modal.style.display = 'block';
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleEventSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const eventId = form.getAttribute('data-event-id');
    
    const eventData = {
        type: document.getElementById('eventType').value,
        title: document.getElementById('eventTitle').value,
        location: document.getElementById('eventLocation').value,
        latitude: parseFloat(document.getElementById('eventLatitude').value),
        longitude: parseFloat(document.getElementById('eventLongitude').value),
        magnitude: document.getElementById('eventMagnitude').value || null,
        depth: document.getElementById('eventDepth').value || null,
        description: document.getElementById('eventDescription').value,
        timestamp: document.getElementById('eventTimestamp').value || new Date().toISOString()
    };
    
    try {
        const url = eventId ? `/admin/events/${eventId}` : '/admin/events';
        const method = eventId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Include session cookies
            body: JSON.stringify(eventData)
        });
        
        if (response.status === 401) {
            // Not authenticated, redirect to login
            window.location.href = '/admin';
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            closeModal();
            loadAdminEvents();
        } else {
            showAdminError(data.message || 'Failed to save event');
        }
    } catch (error) {
        console.error('Error saving event:', error);
        showAdminError('Network error. Please try again.');
    }
}

async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/events/${eventId}`, {
            method: 'DELETE',
            credentials: 'include' // Include session cookies
        });
        
        if (response.status === 401) {
            // Not authenticated, redirect to login
            window.location.href = '/admin';
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            loadAdminEvents();
        } else {
            showAdminError(data.message || 'Failed to delete event');
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        showAdminError('Network error. Please try again.');
    }
}

async function logout() {
    try {
        const response = await fetch('/admin/logout', {
            method: 'POST',
            credentials: 'include' // Include session cookies
        });
        
        const data = await response.json();
        if (data.success) {
            window.location.href = '/admin';
        }
    } catch (error) {
        console.error('Logout error:', error);
        // Redirect anyway
        window.location.href = '/admin';
    }
}

async function cleanupOldData() {
    if (!confirm('Are you sure you want to clean up old data? This will remove ALL events older than 24 hours.')) {
        return;
    }
    
    try {
        const response = await fetch('/admin/cleanup', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            showAdminMessage(`Cleanup completed. Removed ${result.deletedCount} old events.`, 'success');
            loadAdminEvents(); // Refresh the events list
        } else {
            showAdminError('Failed to cleanup old data');
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
        showAdminError('Failed to cleanup old data');
    }
}

async function refreshAllData() {
    if (!confirm('Are you sure you want to refresh all disaster data? This will fetch the latest data from all APIs.')) {
        return;
    }
    
    const refreshBtn = document.querySelector('button[onclick="refreshAllData()"]');
    const originalText = refreshBtn ? refreshBtn.textContent : '';
    
    try {
        // Show loading state
        if (refreshBtn) {
            refreshBtn.textContent = 'Refreshing...';
            refreshBtn.disabled = true;
        }
        
        showAdminMessage('Refreshing all disaster data...', 'info');
        
        const response = await fetch('/admin/refresh', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            showAdminMessage('All disaster data refreshed successfully!', 'success');
            // Reload the events list to show updated data
            setTimeout(() => {
                loadAdminEvents();
            }, 1000);
        } else {
            const error = await response.json();
            showAdminError(`Failed to refresh data: ${error.details || error.error}`);
        }
    } catch (error) {
        console.error('Error during data refresh:', error);
        showAdminError('Failed to refresh data: Network error');
    } finally {
        // Restore button state
        if (refreshBtn) {
            refreshBtn.textContent = originalText;
            refreshBtn.disabled = false;
        }
    }
}

function showAdminMessage(message, type = 'info') {
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
}

function showAdminError(message) {
    showAdminMessage(message, 'error');
}

// ===== ACCOUNT SETTINGS FUNCTIONS =====

// Get current user info from session
let currentUser = null;

async function loadCurrentUser() {
    try {
        const response = await fetch('/admin/user-info', {
            credentials: 'include'
        });
        
        if (response.ok) {
            currentUser = await response.json();
            const usernameField = document.getElementById('currentUsername');
            if (usernameField && currentUser) {
                usernameField.value = currentUser.username;
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

function openAccountSettings() {
    const modal = document.getElementById('accountModal');
    if (modal) {
        // Load current user info
        loadCurrentUser();
        
        // Clear forms
        document.getElementById('usernameForm').reset();
        document.getElementById('passwordForm').reset();
        
        // Clear any previous messages
        const messageEl = document.getElementById('accountMessage');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
        
        modal.style.display = 'block';
    }
}

function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showAccountMessage(message, type = 'success') {
    const messageEl = document.getElementById('accountMessage');
    if (messageEl) {
        messageEl.className = `modal-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
}

// Handle username change form
document.addEventListener('DOMContentLoaded', function() {
    const usernameForm = document.getElementById('usernameForm');
    if (usernameForm) {
        usernameForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const newUsername = document.getElementById('newUsername').value.trim();
            const password = document.getElementById('usernamePassword').value;
            
            // Client-side validation
            if (newUsername.length < 2 || newUsername.length > 20) {
                showAccountMessage('Username must be between 2 and 20 characters', 'error');
                return;
            }
            
            if (!currentUser || newUsername === currentUser.username) {
                showAccountMessage('Please enter a different username', 'error');
                return;
            }
            
            try {
                const response = await fetch('/admin/change-username', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ newUsername, currentPassword: password })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showAccountMessage('Username updated successfully!', 'success');
                    currentUser.username = newUsername;
                    document.getElementById('currentUsername').value = newUsername;
                    usernameForm.reset();
                } else {
                    showAccountMessage(result.error || 'Failed to update username', 'error');
                }
            } catch (error) {
                console.error('Error updating username:', error);
                showAccountMessage('Network error occurred', 'error');
            }
        });
    }
    
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Client-side validation
            if (newPassword !== confirmPassword) {
                showAccountMessage('New passwords do not match', 'error');
                return;
            }
            
            if (newPassword === currentPassword) {
                showAccountMessage('New password must be different from current password', 'error');
                return;
            }
            
            try {
                const response = await fetch('/admin/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showAccountMessage('Password updated successfully!', 'success');
                    passwordForm.reset();
                } else {
                    showAccountMessage(result.error || 'Failed to update password', 'error');
                }
            } catch (error) {
                console.error('Error updating password:', error);
                showAccountMessage('Network error occurred', 'error');
            }
        });
    }
});

// Close account modal when clicking outside
window.addEventListener('click', function(event) {
    const accountModal = document.getElementById('accountModal');
    if (event.target === accountModal) {
        closeAccountModal();
    }
});

// ===== SHARED UTILITY FUNCTIONS =====

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('eventModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Close modal on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

function centerMapOnEvent(latitude, longitude) {
    if (map && latitude && longitude) {
        // Center and zoom the map on the selected event
        map.setView([latitude, longitude], 8);
        
        // Find and open the popup for this event
        markers.forEach(marker => {
            const markerLatLng = marker.getLatLng();
            if (Math.abs(markerLatLng.lat - latitude) < 0.001 && 
                Math.abs(markerLatLng.lng - longitude) < 0.001) {
                marker.openPopup();
            }
        });
    }
}
