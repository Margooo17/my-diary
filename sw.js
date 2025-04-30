// 缓存名称
const CACHE_NAME = 'diary-app-v1';

// 需要缓存的文件
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './css/themes.css',
  './css/cloud-sync.css',
  './js/storage.js',
  './js/settings.js',
  './js/tags.js',
  './js/comments.js',
  './js/diary.js',
  './js/cloud-sync.js',
  './manifest.json'
];

// 安装Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker 正在安装...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('缓存文件中...');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker 已激活');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果在缓存中找到了响应，返回缓存的版本
        if (response) {
          return response;
        }
        
        // 否则发送网络请求
        return fetch(event.request).then(
          response => {
            // 检查响应是否有效
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 克隆响应（因为响应是流，只能使用一次）
            var responseToCache = response.clone();
            
            // 添加到缓存
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          }
        );
      })
  );
}); 