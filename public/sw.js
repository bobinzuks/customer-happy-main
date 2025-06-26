// Service Worker for Customer Interview PWA
const CACHE_NAME = 'customer-interview-v1.0.2';
const STATIC_CACHE_NAME = 'static-v1.0.2';
const DYNAMIC_CACHE_NAME = 'dynamic-v1.0.2';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/critical.css',
  '/js/app.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// API endpoints to cache dynamically
const API_CACHE_PATTERNS = [
  /^\/api\/interview\/start/,
  /^\/api\/interview\/.*\/message/,
  /^\/api\/interview\/.*\/complete/
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName !== STATIC_CACHE_NAME && 
                     cacheName !== DYNAMIC_CACHE_NAME;
            })
            .map(cacheName => {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle API requests - ONLY for same origin
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle static assets
  if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
    return;
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // For POST requests (sending messages), always try network first
  if (request.method === 'POST') {
    try {
      const response = await fetch(request);
      
      // Cache successful responses
      if (response.ok) {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        cache.put(request, response.clone());
      }
      
      return response;
    } catch (error) {
      console.log('Service Worker: Network failed for POST request');
      
      // Return cached response if available
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Return offline response
      return new Response(
        JSON.stringify({
          error: 'Network unavailable. Please check your connection.',
          offline: true
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  // For GET requests, try cache first, then network
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Serve from cache and update in background
      fetch(request)
        .then(response => {
          if (response.ok) {
            const cache = caches.open(DYNAMIC_CACHE_NAME);
            cache.then(c => c.put(request, response.clone()));
          }
        })
        .catch(() => {}); // Silently fail background update
      
      return cachedResponse;
    }
    
    // Not in cache, fetch from network
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Service Worker: Network and cache failed for API request');
    
    return new Response(
      JSON.stringify({
        error: 'Unable to load data. Please check your connection.',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Not in cache, fetch from network
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok && response.status < 400) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Service Worker: Static request failed:', request.url);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const cachedIndex = await caches.match('/index.html');
      if (cachedIndex) {
        return cachedIndex;
      }
    }
    
    // Return generic offline response
    return new Response(
      'You are offline. Please check your internet connection.',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' }
      }
    );
  }
}

// Background sync for sending messages when back online
self.addEventListener('sync', event => {
  if (event.tag === 'interview-sync') {
    event.waitUntil(syncInterviewData());
  }
});

async function syncInterviewData() {
  try {
    // Get pending messages from IndexedDB or localStorage
    const pendingMessages = await getPendingMessages();
    
    for (const message of pendingMessages) {
      try {
        const response = await fetch(message.url, {
          method: 'POST',
          headers: message.headers,
          body: message.body
        });
        
        if (response.ok) {
          await removePendingMessage(message.id);
          console.log('Service Worker: Synced message:', message.id);
        }
      } catch (error) {
        console.log('Service Worker: Failed to sync message:', message.id);
      }
    }
  } catch (error) {
    console.error('Service Worker: Sync failed:', error);
  }
}

// Push notification support for interview reminders
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Thank you for your feedback!',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open Interview',
        icon: '/assets/icon-96.png'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Customer Interview', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Utility functions for offline message queue
async function getPendingMessages() {
  // In a real implementation, this would read from IndexedDB
  return [];
}

async function removePendingMessage(messageId) {
  // In a real implementation, this would remove from IndexedDB
  console.log('Removing pending message:', messageId);
}

// Cache management
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE_NAME)
        .then(cache => cache.addAll(event.data.payload))
    );
  }
});