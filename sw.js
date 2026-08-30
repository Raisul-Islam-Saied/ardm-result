// প্রতিটি নতুন ডিপ্লয়ে এই ভার্সন নাম্বার বাড়িয়ে দিলে পুরনো ক্যাশ ক্লিয়ার হয়ে যাবে
const CACHE_VERSION = 'v3'; // v2 -> v3: offline.html precache-এ যোগ হলো
const CACHE_NAME = 'ardm-result-' + CACHE_VERSION;

// প্রথমবার ইনস্টলের সময় যেগুলো প্রি-ক্যাশ করা হবে (অফলাইন সাপোর্টের জন্য)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/config.js',
  '/manifest.json',
  '/logo-192.png',
  '/logo-512.png',
  '/offline.html'
];

// ইনস্টল হওয়ার সাথে সাথেই নতুন সার্ভিস ওয়ার্কার একটিভ হবে (পুরনোটির জন্য অপেক্ষা করবে না)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

// একটিভ হওয়ার সময় পুরনো ভার্সনের ক্যাশ মুছে ফেলা হবে
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// নেটওয়ার্ক-ফার্স্ট কৌশল: অনলাইনে থাকলে সবসময় সর্বশেষ (GitHub/Netlify থেকে ডিপ্লয় করা) ভার্সন আনবে
// অফলাইন হলে ক্যাশ থেকে দেখাবে
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // থার্ড-পার্টি CDN (Tailwind, Google Fonts, html-to-image ইত্যাদি) স্কিপ করা হচ্ছে —
  // ব্রাউজারের নিজস্ব HTTP ক্যাশেই এগুলো ভালোভাবে হ্যান্ডেল হয়, SW ক্যাশে ডুপ্লিকেট রাখলে
  // অকারণে অনেক জায়গা (আপনার ক্ষেত্রে ৪৯ MB) দখল করে নেয়
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // পেজ ভিজিট (নেভিগেশন) হলে এবং কোনো ক্যাশও না পেলে অফলাইন পেজ দেখাও
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});
