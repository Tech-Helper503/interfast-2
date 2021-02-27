// Register Service Worker
if("serviceWorker" in navigator) {
    navigator.serviceWorker.register('./sw.js', {
        type: "module"
    })
}

