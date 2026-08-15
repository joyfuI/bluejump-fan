self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url;
  if (typeof url !== 'string') {
    return;
  }

  event.waitUntil(self.clients.openWindow(url));
});
