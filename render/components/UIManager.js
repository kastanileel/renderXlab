export class UIManager{

    #state;
    #size;

    constructor() {
        this.#state = new Map();
        this.#size = new Map();
    }

    register(element, byteSize, callback){

        if(!element.id){
            throw new Error("UI element must have an id!");
        }

        const key = element.id;

        if(!(this.#state.has(key))){
            this.#state.set(key, 0);
        }

        this.#size.set(key, byteSize);

        // Determine the event type BEFORE adding the listener
        let eventType;
        if (element.tagName === "BUTTON") eventType = "click";
        else if (element.tagName === "INPUT") {
            if (element.type === "range" || element.type === "number") eventType = "input";
            else eventType = "change";
        } else {
            eventType = "change";
        }

        element.addEventListener(eventType, (e) => {
            const oldValue = this.#state.get(key);
            this.#state.set(key, callback(oldValue, e));
        });
    }

    getState() {
        return [this.#state, this.#size];
    }

    getTotalSizeInBytes(){
        var byteSize = 0;
        for (const [key, value] of this.#size) {
            byteSize += value;
        }

        return byteSize * 4;
    }
}