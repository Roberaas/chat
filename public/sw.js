self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Roberto Bravo'
  const options = {
    body: data.body || 'Yeni bildirim',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'roberto-bildirim',
    requireInteraction: true,
    data: { url: data.url || '/dashboard/canli-destek' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard/canli-destek'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
