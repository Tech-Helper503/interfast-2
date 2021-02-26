// @ts-ignore
try {
    self['workbox:core:6.1.1'] && _();
}
catch (e) { }

/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
const fallback = (code, ...args) => {
    let msg = code;
    if (args.length > 0) {
        msg += ` :: ${JSON.stringify(args)}`;
    }
    return msg;
};
const messageGenerator = fallback ;

/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
/**
 * Workbox errors should be thrown with this class.
 * This allows use to ensure the type easily in tests,
 * helps developers identify errors from workbox
 * easily and allows use to optimise error
 * messages correctly.
 *
 * @private
 */
class WorkboxError extends Error {
    /**
     *
     * @param {string} errorCode The error code that
     * identifies this particular error.
     * @param {Object=} details Any relevant arguments
     * that will help developers identify issues should
     * be added as a key on the context object.
     */
    constructor(errorCode, details) {
        const message = messageGenerator(errorCode, details);
        super(message);
        this.name = errorCode;
        this.details = details;
    }
}

/*
  Copyright 2019 Google LLC
  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
const logger = (null );

/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
const getFriendlyURL = (url) => {
    const urlObj = new URL(String(url), location.href);
    // See https://github.com/GoogleChrome/workbox/issues/2323
    // We want to include everything, except for the origin if it's same-origin.
    return urlObj.href.replace(new RegExp(`^${location.origin}`), '');
};

/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
/**
 * A class that wraps common IndexedDB functionality in a promise-based API.
 * It exposes all the underlying power and functionality of IndexedDB, but
 * wraps the most commonly used features in a way that's much simpler to use.
 *
 * @private
 */
class DBWrapper {
    /**
     * @param {string} name
     * @param {number} version
     * @param {Object=} [callback]
     * @param {!Function} [callbacks.onupgradeneeded]
     * @param {!Function} [callbacks.onversionchange] Defaults to
     *     DBWrapper.prototype._onversionchange when not specified.
     * @private
     */
    constructor(name, version, { onupgradeneeded, onversionchange, } = {}) {
        this._db = null;
        this._name = name;
        this._version = version;
        this._onupgradeneeded = onupgradeneeded;
        this._onversionchange = onversionchange || (() => this.close());
    }
    /**
     * Returns the IDBDatabase instance (not normally needed).
     * @return {IDBDatabase|undefined}
     *
     * @private
     */
    get db() {
        return this._db;
    }
    /**
     * Opens a connected to an IDBDatabase, invokes any onupgradedneeded
     * callback, and added an onversionchange callback to the database.
     *
     * @return {IDBDatabase}
     * @private
     */
    async open() {
        if (this._db)
            return;
        this._db = await new Promise((resolve, reject) => {
            // This flag is flipped to true if the timeout callback runs prior
            // to the request failing or succeeding. Note: we use a timeout instead
            // of an onblocked handler since there are cases where onblocked will
            // never never run. A timeout better handles all possible scenarios:
            // https://github.com/w3c/IndexedDB/issues/223
            let openRequestTimedOut = false;
            setTimeout(() => {
                openRequestTimedOut = true;
                reject(new Error('The open request was blocked and timed out'));
            }, this.OPEN_TIMEOUT);
            const openRequest = indexedDB.open(this._name, this._version);
            openRequest.onerror = () => reject(openRequest.error);
            openRequest.onupgradeneeded = (evt) => {
                if (openRequestTimedOut) {
                    openRequest.transaction.abort();
                    openRequest.result.close();
                }
                else if (typeof this._onupgradeneeded === 'function') {
                    this._onupgradeneeded(evt);
                }
            };
            openRequest.onsuccess = () => {
                const db = openRequest.result;
                if (openRequestTimedOut) {
                    db.close();
                }
                else {
                    db.onversionchange = this._onversionchange.bind(this);
                    resolve(db);
                }
            };
        });
        return this;
    }
    /**
     * Polyfills the native `getKey()` method. Note, this is overridden at
     * runtime if the browser supports the native method.
     *
     * @param {string} storeName
     * @param {*} query
     * @return {Array}
     * @private
     */
    async getKey(storeName, query) {
        return (await this.getAllKeys(storeName, query, 1))[0];
    }
    /**
     * Polyfills the native `getAll()` method. Note, this is overridden at
     * runtime if the browser supports the native method.
     *
     * @param {string} storeName
     * @param {*} query
     * @param {number} count
     * @return {Array}
     * @private
     */
    async getAll(storeName, query, count) {
        return await this.getAllMatching(storeName, { query, count });
    }
    /**
     * Polyfills the native `getAllKeys()` method. Note, this is overridden at
     * runtime if the browser supports the native method.
     *
     * @param {string} storeName
     * @param {*} query
     * @param {number} count
     * @return {Array}
     * @private
     */
    async getAllKeys(storeName, query, count) {
        const entries = await this.getAllMatching(storeName, { query, count, includeKeys: true });
        return entries.map((entry) => entry.key);
    }
    /**
     * Supports flexible lookup in an object store by specifying an index,
     * query, direction, and count. This method returns an array of objects
     * with the signature .
     *
     * @param {string} storeName
     * @param {Object} [opts]
     * @param {string} [opts.index] The index to use (if specified).
     * @param {*} [opts.query]
     * @param {IDBCursorDirection} [opts.direction]
     * @param {number} [opts.count] The max number of results to return.
     * @param {boolean} [opts.includeKeys] When true, the structure of the
     *     returned objects is changed from an array of values to an array of
     *     objects in the form {key, primaryKey, value}.
     * @return {Array}
     * @private
     */
    async getAllMatching(storeName, { index, query = null, // IE/Edge errors if query === `undefined`.
    direction = 'next', count, includeKeys = false, } = {}) {
        return await this.transaction([storeName], 'readonly', (txn, done) => {
            const store = txn.objectStore(storeName);
            const target = index ? store.index(index) : store;
            const results = [];
            const request = target.openCursor(query, direction);
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    results.push(includeKeys ? cursor : cursor.value);
                    if (count && results.length >= count) {
                        done(results);
                    }
                    else {
                        cursor.continue();
                    }
                }
                else {
                    done(results);
                }
            };
        });
    }
    /**
     * Accepts a list of stores, a transaction type, and a callback and
     * performs a transaction. A promise is returned that resolves to whatever
     * value the callback chooses. The callback holds all the transaction logic
     * and is invoked with two arguments:
     *   1. The IDBTransaction object
     *   2. A `done` function, that's used to resolve the promise when
     *      when the transaction is done, if passed a value, the promise is
     *      resolved to that value.
     *
     * @param {Array<string>} storeNames An array of object store names
     *     involved in the transaction.
     * @param {string} type Can be `readonly` or `readwrite`.
     * @param {!Function} callback
     * @return {*} The result of the transaction ran by the callback.
     * @private
     */
    async transaction(storeNames, type, callback) {
        await this.open();
        return await new Promise((resolve, reject) => {
            const txn = this._db.transaction(storeNames, type);
            txn.onabort = () => reject(txn.error);
            txn.oncomplete = () => resolve();
            callback(txn, (value) => resolve(value));
        });
    }
    /**
     * Delegates async to a native IDBObjectStore method.
     *
     * @param {string} method The method name.
     * @param {string} storeName The object store name.
     * @param {string} type Can be `readonly` or `readwrite`.
     * @param {...*} args The list of args to pass to the native method.
     * @return {*} The result of the transaction.
     * @private
     */
    async _call(method, storeName, type, ...args) {
        const callback = (txn, done) => {
            const objStore = txn.objectStore(storeName);
            // TODO(philipwalton): Fix this underlying TS2684 error.
            // @ts-ignore
            const request = objStore[method].apply(objStore, args);
            request.onsuccess = () => done(request.result);
        };
        return await this.transaction([storeName], type, callback);
    }
    /**
     * Closes the connection opened by `DBWrapper.open()`. Generally this method
     * doesn't need to be called since:
     *   1. It's usually better to keep a connection open since opening
     *      a new connection is somewhat slow.
     *   2. Connections are automatically closed when the reference is
     *      garbage collected.
     * The primary use case for needing to close a connection is when another
     * reference (typically in another tab) needs to upgrade it and would be
     * blocked by the current, open connection.
     *
     * @private
     */
    close() {
        if (this._db) {
            this._db.close();
            this._db = null;
        }
    }
}
// Exposed on the prototype to let users modify the default timeout on a
// per-instance or global basis.
DBWrapper.prototype.OPEN_TIMEOUT = 2000;
// Wrap native IDBObjectStore methods according to their mode.
const methodsToWrap = {
    readonly: ['get', 'count', 'getKey', 'getAll', 'getAllKeys'],
    readwrite: ['add', 'put', 'clear', 'delete'],
};
for (const [mode, methods] of Object.entries(methodsToWrap)) {
    for (const method of methods) {
        if (method in IDBObjectStore.prototype) {
            // Don't use arrow functions here since we're outside of the class.
            DBWrapper.prototype[method] =
                async function (storeName, ...args) {
                    return await this._call(method, storeName, mode, ...args);
                };
        }
    }
}

// @ts-ignore
try {
    self['workbox:background-sync:6.1.1'] && _();
}
catch (e) { }

/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
const DB_VERSION = 3;
const DB_NAME = 'workbox-background-sync';
const OBJECT_STORE_NAME = 'requests';
const INDEXED_PROP = 'queueName';
/**
 * A class to manage storing requests from a Queue in IndexedDB,
 * indexed by their queue name for easier access.
 *
 * @private
 */
class QueueStore {
    /**
     * Associates this instance with a Queue instance, so entries added can be
     * identified by their queue name.
     *
     * @param {string} queueName
     * @private
     */
    constructor(queueName) {
        this._queueName = queueName;
        this._db = new DBWrapper(DB_NAME, DB_VERSION, {
            onupgradeneeded: this._upgradeDb,
        });
    }
    /**
     * Append an entry last in the queue.
     *
     * @param {Object} entry
     * @param {Object} entry.requestData
     * @param {number} [entry.timestamp]
     * @param {Object} [entry.metadata]
     * @private
     */
    async pushEntry(entry) {
        // Don't specify an ID since one is automatically generated.
        delete entry.id;
        entry.queueName = this._queueName;
        await this._db.add(OBJECT_STORE_NAME, entry);
    }
    /**
     * Prepend an entry first in the queue.
     *
     * @param {Object} entry
     * @param {Object} entry.requestData
     * @param {number} [entry.timestamp]
     * @param {Object} [entry.metadata]
     * @private
     */
    async unshiftEntry(entry) {
        const [firstEntry] = await this._db.getAllMatching(OBJECT_STORE_NAME, {
            count: 1,
        });
        if (firstEntry) {
            // Pick an ID one less than the lowest ID in the object store.
            entry.id = firstEntry.id - 1;
        }
        else {
            // Otherwise let the auto-incrementor assign the ID.
            delete entry.id;
        }
        entry.queueName = this._queueName;
        await this._db.add(OBJECT_STORE_NAME, entry);
    }
    /**
     * Removes and returns the last entry in the queue matching the `queueName`.
     *
     * @return {Promise<Object>}
     * @private
     */
    async popEntry() {
        return this._removeEntry({ direction: 'prev' });
    }
    /**
     * Removes and returns the first entry in the queue matching the `queueName`.
     *
     * @return {Promise<Object>}
     * @private
     */
    async shiftEntry() {
        return this._removeEntry({ direction: 'next' });
    }
    /**
     * Returns all entries in the store matching the `queueName`.
     *
     * @param {Object} options See {@link module:workbox-background-sync.Queue~getAll}
     * @return {Promise<Array<Object>>}
     * @private
     */
    async getAll() {
        return await this._db.getAllMatching(OBJECT_STORE_NAME, {
            index: INDEXED_PROP,
            query: IDBKeyRange.only(this._queueName),
        });
    }
    /**
     * Deletes the entry for the given ID.
     *
     * WARNING: this method does not ensure the deleted enry belongs to this
     * queue (i.e. matches the `queueName`). But this limitation is acceptable
     * as this class is not publicly exposed. An additional check would make
     * this method slower than it needs to be.
     *
     * @private
     * @param {number} id
     */
    async deleteEntry(id) {
        await this._db.delete(OBJECT_STORE_NAME, id);
    }
    /**
     * Removes and returns the first or last entry in the queue (based on the
     * `direction` argument) matching the `queueName`.
     *
     * @return {Promise<Object>}
     * @private
     */
    async _removeEntry({ direction }) {
        const [entry] = await this._db.getAllMatching(OBJECT_STORE_NAME, {
            direction,
            index: INDEXED_PROP,
            query: IDBKeyRange.only(this._queueName),
            count: 1,
        });
        if (entry) {
            await this.deleteEntry(entry.id);
            return entry;
        }
    }
    /**
     * Upgrades the database given an `upgradeneeded` event.
     *
     * @param {Event} event
     * @private
     */
    _upgradeDb(event) {
        const db = event.target.result;
        if (event.oldVersion > 0 && event.oldVersion < DB_VERSION) {
            if (db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                db.deleteObjectStore(OBJECT_STORE_NAME);
            }
        }
        const objStore = db.createObjectStore(OBJECT_STORE_NAME, {
            autoIncrement: true,
            keyPath: 'id',
        });
        objStore.createIndex(INDEXED_PROP, INDEXED_PROP, { unique: false });
    }
}

/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
const serializableProperties = [
    'method',
    'referrer',
    'referrerPolicy',
    'mode',
    'credentials',
    'cache',
    'redirect',
    'integrity',
    'keepalive',
];
/**
 * A class to make it easier to serialize and de-serialize requests so they
 * can be stored in IndexedDB.
 *
 * @private
 */
class StorableRequest {
    /**
     * Accepts an object of request data that can be used to construct a
     * `Request` but can also be stored in IndexedDB.
     *
     * @param {Object} requestData An object of request data that includes the
     *     `url` plus any relevant properties of
     *     [requestInit]{@link https://fetch.spec.whatwg.org/#requestinit}.
     * @private
     */
    constructor(requestData) {
        // If the request's mode is `navigate`, convert it to `same-origin` since
        // navigation requests can't be constructed via script.
        if (requestData['mode'] === 'navigate') {
            requestData['mode'] = 'same-origin';
        }
        this._requestData = requestData;
    }
    /**
     * Converts a Request object to a plain object that can be structured
     * cloned or JSON-stringified.
     *
     * @param {Request} request
     * @return {Promise<StorableRequest>}
     *
     * @private
     */
    static async fromRequest(request) {
        const requestData = {
            url: request.url,
            headers: {},
        };
        // Set the body if present.
        if (request.method !== 'GET') {
            // Use ArrayBuffer to support non-text request bodies.
            // NOTE: we can't use Blobs becuse Safari doesn't support storing
            // Blobs in IndexedDB in some cases:
            // https://github.com/dfahlander/Dexie.js/issues/618#issuecomment-398348457
            requestData.body = await request.clone().arrayBuffer();
        }
        // Convert the headers from an iterable to an object.
        for (const [key, value] of request.headers.entries()) {
            requestData.headers[key] = value;
        }
        // Add all other serializable request properties
        for (const prop of serializableProperties) {
            if (request[prop] !== undefined) {
                requestData[prop] = request[prop];
            }
        }
        return new StorableRequest(requestData);
    }
    /**
     * Returns a deep clone of the instances `_requestData` object.
     *
     * @return {Object}
     *
     * @private
     */
    toObject() {
        const requestData = Object.assign({}, this._requestData);
        requestData.headers = Object.assign({}, this._requestData.headers);
        if (requestData.body) {
            requestData.body = requestData.body.slice(0);
        }
        return requestData;
    }
    /**
     * Converts this instance to a Request.
     *
     * @return {Request}
     *
     * @private
     */
    toRequest() {
        return new Request(this._requestData.url, this._requestData);
    }
    /**
     * Creates and returns a deep clone of the instance.
     *
     * @return {StorableRequest}
     *
     * @private
     */
    clone() {
        return new StorableRequest(this.toObject());
    }
}

/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
const TAG_PREFIX = 'workbox-background-sync';
const MAX_RETENTION_TIME = 60 * 24 * 7; // 7 days in minutes
const queueNames = new Set();
/**
 * Converts a QueueStore entry into the format exposed by Queue. This entails
 * converting the request data into a real request and omitting the `id` and
 * `queueName` properties.
 *
 * @param {Object} queueStoreEntry
 * @return {Object}
 * @private
 */
const convertEntry = (queueStoreEntry) => {
    const queueEntry = {
        request: new StorableRequest(queueStoreEntry.requestData).toRequest(),
        timestamp: queueStoreEntry.timestamp,
    };
    if (queueStoreEntry.metadata) {
        queueEntry.metadata = queueStoreEntry.metadata;
    }
    return queueEntry;
};
/**
 * A class to manage storing failed requests in IndexedDB and retrying them
 * later. All parts of the storing and replaying process are observable via
 * callbacks.
 *
 * @memberof module:workbox-background-sync
 */
class Queue {
    /**
     * Creates an instance of Queue with the given options
     *
     * @param {string} name The unique name for this queue. This name must be
     *     unique as it's used to register sync events and store requests
     *     in IndexedDB specific to this instance. An error will be thrown if
     *     a duplicate name is detected.
     * @param {Object} [options]
     * @param {Function} [options.onSync] A function that gets invoked whenever
     *     the 'sync' event fires. The function is invoked with an object
     *     containing the `queue` property (referencing this instance), and you
     *     can use the callback to customize the replay behavior of the queue.
     *     When not set the `replayRequests()` method is called.
     *     Note: if the replay fails after a sync event, make sure you throw an
     *     error, so the browser knows to retry the sync event later.
     * @param {number} [options.maxRetentionTime=7 days] The amount of time (in
     *     minutes) a request may be retried. After this amount of time has
     *     passed, the request will be deleted from the queue.
     */
    constructor(name, { onSync, maxRetentionTime } = {}) {
        this._syncInProgress = false;
        this._requestsAddedDuringSync = false;
        // Ensure the store name is not already being used
        if (queueNames.has(name)) {
            throw new WorkboxError('duplicate-queue-name', { name });
        }
        else {
            queueNames.add(name);
        }
        this._name = name;
        this._onSync = onSync || this.replayRequests;
        this._maxRetentionTime = maxRetentionTime || MAX_RETENTION_TIME;
        this._queueStore = new QueueStore(this._name);
        this._addSyncListener();
    }
    /**
     * @return {string}
     */
    get name() {
        return this._name;
    }
    /**
     * Stores the passed request in IndexedDB (with its timestamp and any
     * metadata) at the end of the queue.
     *
     * @param {Object} entry
     * @param {Request} entry.request The request to store in the queue.
     * @param {Object} [entry.metadata] Any metadata you want associated with the
     *     stored request. When requests are replayed you'll have access to this
     *     metadata object in case you need to modify the request beforehand.
     * @param {number} [entry.timestamp] The timestamp (Epoch time in
     *     milliseconds) when the request was first added to the queue. This is
     *     used along with `maxRetentionTime` to remove outdated requests. In
     *     general you don't need to set this value, as it's automatically set
     *     for you (defaulting to `Date.now()`), but you can update it if you
     *     don't want particular requests to expire.
     */
    async pushRequest(entry) {
        await this._addRequest(entry, 'push');
    }
    /**
     * Stores the passed request in IndexedDB (with its timestamp and any
     * metadata) at the beginning of the queue.
     *
     * @param {Object} entry
     * @param {Request} entry.request The request to store in the queue.
     * @param {Object} [entry.metadata] Any metadata you want associated with the
     *     stored request. When requests are replayed you'll have access to this
     *     metadata object in case you need to modify the request beforehand.
     * @param {number} [entry.timestamp] The timestamp (Epoch time in
     *     milliseconds) when the request was first added to the queue. This is
     *     used along with `maxRetentionTime` to remove outdated requests. In
     *     general you don't need to set this value, as it's automatically set
     *     for you (defaulting to `Date.now()`), but you can update it if you
     *     don't want particular requests to expire.
     */
    async unshiftRequest(entry) {
        await this._addRequest(entry, 'unshift');
    }
    /**
     * Removes and returns the last request in the queue (along with its
     * timestamp and any metadata). The returned object takes the form:
     * `{request, timestamp, metadata}`.
     *
     * @return {Promise<Object>}
     */
    async popRequest() {
        return this._removeRequest('pop');
    }
    /**
     * Removes and returns the first request in the queue (along with its
     * timestamp and any metadata). The returned object takes the form:
     * `{request, timestamp, metadata}`.
     *
     * @return {Promise<Object>}
     */
    async shiftRequest() {
        return this._removeRequest('shift');
    }
    /**
     * Returns all the entries that have not expired (per `maxRetentionTime`).
     * Any expired entries are removed from the queue.
     *
     * @return {Promise<Array<Object>>}
     */
    async getAll() {
        const allEntries = await this._queueStore.getAll();
        const now = Date.now();
        const unexpiredEntries = [];
        for (const entry of allEntries) {
            // Ignore requests older than maxRetentionTime. Call this function
            // recursively until an unexpired request is found.
            const maxRetentionTimeInMs = this._maxRetentionTime * 60 * 1000;
            if (now - entry.timestamp > maxRetentionTimeInMs) {
                await this._queueStore.deleteEntry(entry.id);
            }
            else {
                unexpiredEntries.push(convertEntry(entry));
            }
        }
        return unexpiredEntries;
    }
    /**
     * Adds the entry to the QueueStore and registers for a sync event.
     *
     * @param {Object} entry
     * @param {Request} entry.request
     * @param {Object} [entry.metadata]
     * @param {number} [entry.timestamp=Date.now()]
     * @param {string} operation ('push' or 'unshift')
     * @private
     */
    async _addRequest({ request, metadata, timestamp = Date.now(), }, operation) {
        const storableRequest = await StorableRequest.fromRequest(request.clone());
        const entry = {
            requestData: storableRequest.toObject(),
            timestamp,
        };
        // Only include metadata if it's present.
        if (metadata) {
            entry.metadata = metadata;
        }
        await this._queueStore[`${operation}Entry`](entry);
        // Don't register for a sync if we're in the middle of a sync. Instead,
        // we wait until the sync is complete and call register if
        // `this._requestsAddedDuringSync` is true.
        if (this._syncInProgress) {
            this._requestsAddedDuringSync = true;
        }
        else {
            await this.registerSync();
        }
    }
    /**
     * Removes and returns the first or last (depending on `operation`) entry
     * from the QueueStore that's not older than the `maxRetentionTime`.
     *
     * @param {string} operation ('pop' or 'shift')
     * @return {Object|undefined}
     * @private
     */
    async _removeRequest(operation) {
        const now = Date.now();
        const entry = await this._queueStore[`${operation}Entry`]();
        if (entry) {
            // Ignore requests older than maxRetentionTime. Call this function
            // recursively until an unexpired request is found.
            const maxRetentionTimeInMs = this._maxRetentionTime * 60 * 1000;
            if (now - entry.timestamp > maxRetentionTimeInMs) {
                return this._removeRequest(operation);
            }
            return convertEntry(entry);
        }
        else {
            return undefined;
        }
    }
    /**
     * Loops through each request in the queue and attempts to re-fetch it.
     * If any request fails to re-fetch, it's put back in the same position in
     * the queue (which registers a retry for the next sync event).
     */
    async replayRequests() {
        let entry;
        while ((entry = await this.shiftRequest())) {
            try {
                await fetch(entry.request.clone());
                if ("production" !== 'production') ;
            }
            catch (error) {
                await this.unshiftRequest(entry);
                throw new WorkboxError('queue-replay-failed', { name: this._name });
            }
        }
    }
    /**
     * Registers a sync event with a tag unique to this instance.
     */
    async registerSync() {
        if ('sync' in self.registration) {
            try {
                await self.registration.sync.register(`${TAG_PREFIX}:${this._name}`);
            }
            catch (err) {
            }
        }
    }
    /**
     * In sync-supporting browsers, this adds a listener for the sync event.
     * In non-sync-supporting browsers, this will retry the queue on service
     * worker startup.
     *
     * @private
     */
    _addSyncListener() {
        if ('sync' in self.registration) {
            self.addEventListener('sync', (event) => {
                if (event.tag === `${TAG_PREFIX}:${this._name}`) {
                    const syncComplete = async () => {
                        this._syncInProgress = true;
                        let syncError;
                        try {
                            await this._onSync({ queue: this });
                        }
                        catch (error) {
                            syncError = error;
                            // Rethrow the error. Note: the logic in the finally clause
                            // will run before this gets rethrown.
                            throw syncError;
                        }
                        finally {
                            // New items may have been added to the queue during the sync,
                            // so we need to register for a new sync if that's happened...
                            // Unless there was an error during the sync, in which
                            // case the browser will automatically retry later, as long
                            // as `event.lastChance` is not true.
                            if (this._requestsAddedDuringSync &&
                                !(syncError && !event.lastChance)) {
                                await this.registerSync();
                            }
                            this._syncInProgress = false;
                            this._requestsAddedDuringSync = false;
                        }
                    };
                    event.waitUntil(syncComplete());
                }
            });
        }
        else {
            // If the browser doesn't support background sync, retry
            // every time the service worker starts up as a fallback.
            this._onSync({ queue: this });
        }
    }
    /**
     * Returns the set of queue names. This is primarily used to reset the list
     * of queue names in tests.
     *
     * @return {Set}
     *
     * @private
     */
    static get _queueNames() {
        return queueNames;
    }
}

/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/
/**
 * A class implementing the `fetchDidFail` lifecycle callback. This makes it
 * easier to add failed requests to a background sync Queue.
 *
 * @memberof module:workbox-background-sync
 */
class BackgroundSyncPlugin {
    /**
     * @param {string} name See the [Queue]{@link module:workbox-background-sync.Queue}
     *     documentation for parameter details.
     * @param {Object} [options] See the
     *     [Queue]{@link module:workbox-background-sync.Queue} documentation for
     *     parameter details.
     */
    constructor(name, options) {
        /**
         * @param {Object} options
         * @param {Request} options.request
         * @private
         */
        this.fetchDidFail = async ({ request }) => {
            await this._queue.pushRequest({ request });
        };
        this._queue = new Queue(name, options);
    }
}

export { BackgroundSyncPlugin as B };
