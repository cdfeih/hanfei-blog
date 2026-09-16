// Source snapshot for isolated experiments. See manifest.json and README.md.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Websocket = void 0;
const guidUtil_1 = require("../classUtils/guidUtil");
const obser_1 = require("../observers/obser");
const config_1 = require("./config");
class Websocket {
    ws;
    timer = null;
    $ob = new obser_1.Observer();
    tryInterval = 5000;
    get instance() {
        return this.ws;
    }
    connectState = false;
    get state() {
        return this.connectState;
    }
    get ob() {
        return this.$ob;
    }
    onClose;
    onError;
    onMessage;
    beforeMessage;
    onOpen;
    onTimeOut;
    url = '';
    payload;
    protocols;
    parseMessage;
    timeout = -1;
    onSokcetMessage = (event) => {
        const message = JSON.parse(event.data);
        try {
            this.onMessage(message);
        }
        catch (err) {
            console.error(err);
        }
        if (this.parseMessage) {
            const parsedData = this.parseMessage(message);
            const { messageId, data, useParsedAsRes } = parsedData;
            if (messageId) {
                if (useParsedAsRes) {
                    this.$ob.$emit(messageId, parsedData);
                }
                else {
                    this.$ob.$emit(messageId, data);
                }
            }
        }
    };
    constructor({ onClose, onError, onMessage, onOpen, url, tryInterval = 5000, payload, protocols, parseMessage, beforeMessage, onTimeOut, }) {
        this.onClose = onClose;
        this.onError = onError;
        this.onMessage = onMessage;
        this.beforeMessage = beforeMessage ?? (() => { });
        this.onOpen = onOpen;
        this.onTimeOut = onTimeOut;
        this.url = url;
        this.tryInterval = tryInterval;
        this.payload = payload;
        this.protocols = protocols;
        this.parseMessage = parseMessage;
        this.connect();
    }
    send(message) {
        this.ws?.send(message);
    }
    sendAsPromise(message, msgId, timeout) {
        const messageId = msgId ?? guidUtil_1.GuidUtil.guid();
        message.messageId = messageId;
        const text = JSON.stringify(message);
        this.ws?.send(text);
        const IS_DEV = process.env.NODE_ENV === 'development';
        if (IS_DEV) {
            return new Promise((resolve) => {
                const listener = (data) => {
                    resolve(data);
                    this.$ob.$off(messageId, listener);
                };
                this.$ob.$on(messageId, listener);
            });
        }
        const requestPromise = new Promise((resolve, reject) => {
            let calcTimeout = timeout ?? this.timeout ?? -1;
            let timer = null;
            if (calcTimeout > 0) {
                timer = setTimeout(() => {
                    this.$ob.$off(messageId, listener);
                    this.onTimeOut?.(requestPromise, text);
                    const err = new Error(config_1.REQUEST_TIMEOUT);
                    err.name = config_1.REQUEST_TIMEOUT;
                    reject(err);
                }, timeout ?? this.timeout);
            }
            const listener = (data) => {
                resolve(data);
                this.$ob.$off(messageId, listener);
                if (timer) {
                    clearTimeout(timer);
                }
            };
            this.$ob.$on(messageId, listener);
        });
        return requestPromise;
    }
    close() {
        this.ws?.close();
    }
    setTryInterval(time) {
        this.tryInterval = time;
    }
    get validUrl() {
        return this.object2Url(this.getWsUrl(this.url), this.payload);
    }
    connect() {
        if (this.ws && this.connectState)
            return;
        this.ws = new WebSocket(this.validUrl, this.protocols);
        this.ws.onclose = () => {
            this.connectState = false;
            this.onClose();
            if (this.tryInterval <= 0) {
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = null;
                    return;
                }
                this.timer = setTimeout(() => {
                    this.connect();
                }, this.tryInterval);
            }
        };
        this.ws.onopen = () => {
            this.connectState = true;
            this.onOpen();
        };
        this.ws.onmessage = this.onSokcetMessage;
        this.onError = this.onError;
    }
    getWsUrl(url = '') {
        if (url.startsWith('http://')) {
            return url.replace('http', 'ws');
        }
        if (url.startsWith('https://')) {
            return url.replace('https', 'wss');
        }
        if (url.startsWith('//')) {
            return `ws:${url}`;
        }
        if (url.startsWith('ws://') || url.startsWith('wss://')) {
            return url;
        }
        throw new Error(`websocket url: ${url} is invalid`);
    }
    object2Url(url, payload) {
        if (!payload || typeof payload !== 'object')
            return url;
        const keyValueArr = [];
        for (const key in payload) {
            const value = payload[key];
            let express = '';
            if (typeof value === 'function' || typeof value === 'undefined') {
                continue;
            }
            else if (value === null) {
                express = `${key}=null`;
            }
            else if (typeof value === 'object') {
                express = `${key}=${JSON.stringify(value)}`;
            }
            else {
                express = `${key}=${value}`;
            }
            keyValueArr.push(express);
        }
        if (!keyValueArr.length) {
            return url;
        }
        return `${url}?${keyValueArr.join('&')}`;
    }
}
exports.Websocket = Websocket;
