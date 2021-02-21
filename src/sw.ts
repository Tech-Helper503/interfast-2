import { registerRoute, setCatchHandler } from 'workbox-routing'
import { InstallEvent } from './install-event';

const OFFLINE_VERSION:number = 1;
const CACHE_NAME:string = 'offline'
const OFFLINE_URL:string = 'offline.html'

self.addEventListener('install',(event) => {
    const ev = new InstallEvent(event)
    ev.waitUntil(async () => {

    })
    const cache:Cache = await caches.open(CACHE_NAME)
    await cache.add(new Request(OFFLINE_URL,{ cache: "reload" }))
})