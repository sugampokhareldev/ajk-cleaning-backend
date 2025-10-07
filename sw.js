// Enhanced Service Worker for AJK Cleaning PWA
const CACHE_NAME = 'ajk-cleaning-v2';
const STATIC_CACHE = 'ajk-static-v2';
const DYNAMIC_CACHE = 'ajk-dynamic-v2';
const OFFLINE_CACHE = 'ajk-offline-v2';

// Static assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/booking.html',
    '/admin.html',
    '/styles.css',
    '/script.js',
    '/dist/output.css',
    '/images/logo.webp',
    '/images/logo.png',
    '/favicon.ico',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/apple-touch-icon.png',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/site.webmanifest'
];

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
    'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2'
];

// Offline fallback pages
const OFFLINE_PAGES = {
    '/': '/offline.html',
    '/booking': '/offline-booking.html'
};

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            caches.open(STATIC_CACHE).then(cache => {
                console.log('Service Worker: Caching external assets');
                return cache.addAll(EXTERNAL_ASSETS);
            })
        ]).then(() => {
            console.log('Service Worker: Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== OFFLINE_CACHE) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    event.respondWith(
        handleRequest(request)
    );
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    try {
        // Strategy 1: Cache First for static assets
        if (isStaticAsset(url)) {
            return await cacheFirst(request, STATIC_CACHE);
        }
        
        // Strategy 2: Network First for API calls
        if (isApiRequest(url)) {
            return await networkFirst(request, DYNAMIC_CACHE);
        }
        
        // Strategy 3: Stale While Revalidate for HTML pages
        if (isHtmlRequest(request)) {
            return await staleWhileRevalidate(request, DYNAMIC_CACHE);
        }
        
        // Strategy 4: Cache First for images and fonts
        if (isImageOrFont(url)) {
            return await cacheFirst(request, DYNAMIC_CACHE);
        }
        
        // Default: Network First
        return await networkFirst(request, DYNAMIC_CACHE);
        
    } catch (error) {
        console.log('Service Worker: Fetch failed, trying offline fallback:', error);
        return await handleOfflineFallback(request);
    }
}

// Cache First Strategy
async function cacheFirst(request, cacheName) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
}

// Network First Strategy
async function networkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    });
    
    return cachedResponse || fetchPromise;
}

// Offline fallback handling
async function handleOfflineFallback(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Check for offline page
    if (OFFLINE_PAGES[pathname]) {
        const offlineResponse = await caches.match(OFFLINE_PAGES[pathname]);
        if (offlineResponse) {
            return offlineResponse;
        }
    }
    
    // Default offline page
    const defaultOffline = await caches.match('/offline.html');
    if (defaultOffline) {
        return defaultOffline;
    }
    
    // Last resort: return a basic offline response
    return new Response(
        '<html><body><h1>You are offline</h1><p>Please check your internet connection and try again.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
    );
}

// Helper functions
function isStaticAsset(url) {
    return url.pathname.includes('/images/') || 
           url.pathname.includes('/favicon') ||
           url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.webmanifest');
}

function isApiRequest(url) {
    return url.pathname.startsWith('/api/');
}

function isHtmlRequest(request) {
    return request.headers.get('accept').includes('text/html');
}

function isImageOrFont(url) {
    return url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/);
}

// Background Sync for form submissions
self.addEventListener('sync', event => {
    if (event.tag === 'form-submission') {
        event.waitUntil(syncFormSubmissions());
    }
});

async function syncFormSubmissions() {
    try {
        const cache = await caches.open('form-submissions');
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                }
            } catch (error) {
                console.log('Background sync failed for:', request.url);
            }
        }
    } catch (error) {
        console.log('Background sync error:', error);
    }
}

// Push notifications
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/android-chrome-192x192.png',
            badge: '/favicon-32x32.png',
            vibrate: [100, 50, 100],
            data: data.data,
            actions: [
                {
                    action: 'open',
                    title: 'Open App',
                    icon: '/android-chrome-192x192.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/favicon-32x32.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click handling
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling for cache updates
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});