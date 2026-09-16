// Source snapshot for isolated experiments. See manifest.json and README.md.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsStore = void 0;
const utils_1 = require("@mbse-unity/utils");
const models_1 = require("@src/models");
const config_1 = require("@src/routes/config");
const _1 = require(".");
const messageSlice_1 = require("./message/messageSlice");
class WebSocket {
    wsInstance;
    maxReconnectAttempts = 10;
    reconnectAttempts = 0;
    minReconnectDelay = 1000;
    maxReconnectDelay = 10000;
    reconnectDelay = this.minReconnectDelay;
    isManualClose = false;
    ConnectKey = 'ConnectKey-Success';
    $ob = new utils_1.Observer();
    connected = false;
    constructor() { }
    init = () => {
        if (this.wsInstance)
            return;
        const token = (0, utils_1.getToken)();
        if (!token) {
            (0, config_1.navigateToLogin)();
            return;
        }
        this.wsInstance = new utils_1.Websocket({
            url: `${location.origin}${"" ?? ''}/ws/sys`,
            protocols: ['Bearer', token],
            onClose: () => {
                this.connected = false;
                if (this.isManualClose) {
                    console.log('手动断开连接...');
                    return;
                }
                const isDev = process.env.NODE_ENV === 'development';
                if (isDev) {
                    console.log('开发环境下，WebSocket连接断开，不显示弹窗');
                    return;
                }
                utils_1.modal.confirm({
                    title: '断开连接',
                    content: '当前连接已经断开，无法继续操作',
                    okText: '重新连接',
                    cancelButtonProps: {
                        style: { display: 'none ' },
                    },
                    onOk: () => {
                        window.location.reload();
                    },
                });
                this.attemptReconnect();
            },
            onError: () => { },
            onMessage: (res) => {
                if (res.type === models_1.EWebsocketMessageTypeEnum.System) {
                    const noticeMessages = [];
                    try {
                        res.data.forEach((e) => {
                            if (e.type === 1) {
                                noticeMessages.push(e.object);
                            }
                        });
                        _1.default.dispatch((0, messageSlice_1.wsMessage)(noticeMessages));
                    }
                    catch {
                    }
                }
            },
            onOpen: () => {
                console.log('连接成功...');
                this.$ob.$emit(this.ConnectKey, true);
                this.connected = true;
                this.maxReconnectAttempts = 10;
                this.reconnectAttempts = 0;
                this.minReconnectDelay = 1000;
                this.maxReconnectDelay = 10000;
                this.isManualClose = false;
            },
            parseMessage: (message) => {
                return {
                    messageId: message.data.messageId,
                    data: message.data,
                    code: message.code,
                    msg: message.msg,
                    useParsedAsRes: true,
                };
            },
        });
    };
    close = () => {
        this.wsInstance?.close();
        this.isManualClose = true;
        this.connected = false;
    };
    beforeSend() {
        if (this.connected)
            return Promise.resolve(true);
        this.init();
        return new Promise((resolve) => {
            this.$ob.$on(this.ConnectKey, () => {
                resolve(true);
            });
        });
    }
    async consumeLicense(moduleCode) {
        const state = await this.beforeSend();
        if (!state)
            return Promise.reject(false);
        return this.wsInstance.sendAsPromise({
            type: models_1.EWebsocketMessageTypeEnum.LicenseEnter,
            data: { moduleCode },
            timeout: 3000,
        });
    }
    async restoreLicense(moduleCode) {
        const state = await this.beforeSend();
        if (!state)
            return Promise.reject(false);
        return this.wsInstance.sendAsPromise({
            type: models_1.EWebsocketMessageTypeEnum.LicenseLeave,
            data: { moduleCode },
            timeout: 30000,
        });
    }
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`已达到最大重连次数(${this.maxReconnectAttempts})，停止重连`);
            return;
        }
        if (this.onReconnect) {
            this.onReconnect(this.reconnectAttempts, this.reconnectDelay);
        }
        setTimeout(() => {
            this.reconnectAttempts++;
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
            console.log(`第 ${this.reconnectAttempts} 次重连...`);
            this.init();
        }, this.reconnectDelay);
    }
    onReconnect = (attempts, delay) => {
        console.log(`准备进行第 ${attempts + 1} 次重连，延迟 ${delay}ms`);
    };
}
exports.default = WebSocket;
exports.wsStore = new WebSocket();
