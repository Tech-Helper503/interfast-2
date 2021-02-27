// Register Service Worker
const worker = new Worker("./sw-c.js",{
    type: "module"
});
