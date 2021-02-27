// Register Service Worker
const worker = new Worker('./sw.js',{
    type: 'module'
})
