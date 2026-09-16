// Source snapshot for isolated experiments. See manifest.json and README.md.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalObserver = exports.Observer = void 0;
class Observer {
    message = {};
    constructor() {
        this.message = {};
    }
    $on(type, callback) {
        if (!this.message[type]) {
            this.message[type] = [];
        }
        this.message[type].push(callback);
    }
    $off(type, callback) {
        if (!this.message[type])
            return;
        if (!callback) {
            ;
            this.message[type] = undefined;
            return;
        }
        this.message[type] = this.message[type].filter((item) => item !== callback);
    }
    $emit(type, ...args) {
        if (!this.message[type])
            return;
        this.message[type].forEach((fn) => {
            fn.apply(this, args);
        });
    }
}
exports.Observer = Observer;
exports.globalObserver = new Observer();
