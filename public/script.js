// PulseMap - Live Natural Disaster Monitoring
// Combined script for main page, admin page, and login page

// Global variables
let map;
let markers = [];
let currentEvents = [];
let eventFilter = '';

// Configuration
const EVENT_COLORS = {
    earthquake: '#ffffff',    // white
    tsunami: '#0066cc',      // blue
    volcano: '#cc3300',      // red
    wildfire: '#8B4513',     // brown
    flood: '#6666ff',        // purple
    solar: '#ffff00'         // yellow
};

const EVENT_ICONS = {
    earthquake: '⚡',
    tsunami: '🌊',
    volcano: '🌋',
    wildfire: '🔥',
    flood: '💧',
    solar: '☀️'
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
    
    // Auto-refresh events every 5 minutes
    setInterval(loadEvents, 300000);
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
        });
    }
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
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Filter events if needed
    let eventsToShow = currentEvents;
    if (eventFilter) {
        eventsToShow = currentEvents.filter(event => event.type === eventFilter);
    }
    
    // Add new markers
    eventsToShow.forEach(event => {
        if (event.latitude && event.longitude) {
            const marker = createEventMarker(event);
            markers.push(marker);
            marker.addTo(map);
        }
    });
}

function createEventMarker(event) {
    const color = EVENT_COLORS[event.type] || '#666666';
    const icon = EVENT_ICONS[event.type] || '📍';
    
    // Create custom icon
    const customIcon = L.divIcon({
        html: `<div style="background-color: ${color}; border: 2px solid #333; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px;">${icon}</div>`,
        className: 'custom-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    const marker = L.marker([event.latitude, event.longitude], { icon: customIcon });
    
    // Add popup
    const popupContent = createPopupContent(event);
    marker.bindPopup(popupContent);
    
    // Add click handler for modal
    marker.on('click', function() {
        showEventModal(event);
    });
    
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
    
    if (event.magnitude) {
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
    
    // Filter events if needed
    let eventsToShow = currentEvents;
    if (eventFilter) {
        eventsToShow = currentEvents.filter(event => event.type === eventFilter);
    }
    
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
    
    const html = eventsToShow.slice(0, 20).map(event => {
        const timestamp = event.time || event.timestamp;
        const date = new Date(timestamp).toLocaleDateString();
        const time = new Date(timestamp).toLocaleTimeString();
        const icon = EVENT_ICONS[event.type] || '📍';
        
        return `
            <div class="event-item" onclick="showEventModal(${JSON.stringify(event).replace(/"/g, '&quot;')})">
                <div class="event-icon">${icon}</div>
                <div class="event-details">
                    <div class="event-title">${event.title || `${event.type.charAt(0).toUpperCase() + event.type.slice(1)}`}</div>
                    <div class="event-location">${event.location || 'Unknown location'}</div>
                    <div class="event-time">${date} ${time}</div>
                    ${event.magnitude ? `<div class="event-magnitude">Magnitude: ${event.magnitude}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    eventsList.innerHTML = html;
}

function updateStats() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;
    
    // Count events by type
    const eventCounts = {
        earthquake: 0,
        tsunami: 0,
        volcano: 0,
        wildfire: 0,
        flood: 0,
        solar: 0,
        total: 0
    };
    
    currentEvents.forEach(event => {
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
    
    if (eventCounts.solar > 0) {
        statsHTML += `
            <div class="stat-item">
                <span class="stat-number">${eventCounts.solar}</span>
                <span class="stat-label">Solar Flares</span>
            </div>
        `;
    }
    
    statsContainer.innerHTML = statsHTML;
}

function showEventModal(event) {
    const modal = document.getElementById('eventModal');
    const modalContent = document.getElementById('modalContent');
    
    if (!modal || !modalContent) return;
    
    const timestamp = event.time || event.timestamp;
    const date = new Date(timestamp).toLocaleString();
    const icon = EVENT_ICONS[event.type] || '📍';
    
    let content = `
        <div class="event-modal-content">
            <div class="event-modal-header">
                <span class="event-modal-icon">${icon}</span>
                <h2>${event.title || `${event.type.charAt(0).toUpperCase() + event.type.slice(1)}`}</h2>
            </div>
            <div class="event-modal-details">
                <p><strong>Type:</strong> ${event.type}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Location:</strong> ${event.location || 'Unknown'}</p>
                <p><strong>Coordinates:</strong> ${event.latitude}, ${event.longitude}</p>
    `;
    
    if (event.magnitude) {
        content += `<p><strong>Magnitude:</strong> ${event.magnitude}</p>`;
    }
    if (event.depth) {
        content += `<p><strong>Depth:</strong> ${event.depth} km</p>`;
    }
    if (event.description) {
        content += `<p><strong>Description:</strong> ${event.description}</p>`;
    }
    
    content += '</div></div>';
    
    modalContent.innerHTML = content;
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('eventModal');
    if (modal) {
        modal.style.display = 'none';
    }
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
        const eventTypes = ['earthquake', 'tsunami', 'volcano', 'wildfire', 'flood', 'solar_flare'];
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
            <div class="stat-card">
                <span class="stat-number">${stats.solar_flare}</span>
                <div class="stat-label">Solar Flares</div>
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
    if (!confirm('Are you sure you want to clean up old data? This will remove events according to retention policies.')) {
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
