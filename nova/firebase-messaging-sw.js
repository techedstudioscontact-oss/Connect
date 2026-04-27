// This service worker file must be located in the root of your public directory.
// It cannot be bundled into your main application code.

// Scripts for firebase and firebase messaging
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyAjyfSNtwEXKgDm1tKQbAlFTfNG1a2DuwM",
  authDomain: "microinfluencerhub.firebaseapp.com",
  databaseURL: "https://microinfluencerhub-default-rtdb.firebaseio.com",
  projectId: "microinfluencerhub",
  storageBucket: "microinfluencerhub.appspot.com",
  messagingSenderId: "696533957067",
  appId: "1:696533957067:web:42dc313ae873db33165e4e",
  measurementId: "G-4EDHTQ6ZXD"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/assets/logo.svg", // Make sure you have a logo.png in your public root
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);
  event.notification.close();

  // This looks for an open window with the app's URL and focuses it.
  // If no window is open, it opens a new one.
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        // You can customize this logic to check for a specific path
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});