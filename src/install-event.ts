export class InstallEvent extends Event {
    event: Event;
    networkResponse: Response;
    preloadResponse: Response;
    request: Request;
    

    constructor(event:Event) {
        super(event.toString())
        this.event = event
     
        
        
    }

    waitUntil(func:Function) {
        if(func.constructor.name === 'AsyncFunction') {
            if(func === this.waitUntil) {
                return Error('Function cannot be this.waitUntil() because it will cause an infinite loop')
            } else {
                const funcResult: Promise<Response> = func()
            }
        } else {
            return Error('Function must be async for it to be waited upon on.')
        }
    }
}

