// src/Network.js

export const NETWORK_EVENTS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    DATA: 'data',
    ERROR: 'error'
};

// Простой эмиттер событий
class SimpleEmitter {
    constructor() {
        this.listeners = {};
    }
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    emit(event, payload) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(payload));
        }
    }
}

export class Network extends SimpleEmitter {
    constructor() {
        super();
        this.connection = null;
        this.dataChannel = null;
        this.isHost = false;
        
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        };
    }

    // Вспомогательная функция: Ждем, пока браузер соберет все пути (ICE candidates)
    // Это нужно, чтобы получить одну длинную строку для копирования
    _waitForIceGathering() {
        return new Promise((resolve) => {
            if (this.connection.iceGatheringState === 'complete') {
                resolve();
            } else {
                const check = () => {
                    if (this.connection.iceGatheringState === 'complete') {
                        this.connection.removeEventListener('icegatheringstatechange', check);
                        resolve();
                    }
                };
                this.connection.addEventListener('icegatheringstatechange', check);
            }
        });
    }

    _createConnection() {
        this.connection = new RTCPeerConnection(this.config);

        this.connection.onconnectionstatechange = () => {
            console.log('Connection State:', this.connection.connectionState);
            if (this.connection.connectionState === 'connected') {
                // Ждем открытия канала данных
            } else if (this.connection.connectionState === 'disconnected') {
                this.emit(NETWORK_EVENTS.DISCONNECTED);
            }
        };
    }

    // --- HOST LOGIC ---
    async createOffer() {
        this.isHost = true;
        this._createConnection();

        // Хост создает канал
        this.dataChannel = this.connection.createDataChannel("vanguard_channel", {
            ordered: true
        });
        this._setupChannelListeners();

        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);

        // Ждем сбора всех кандидатов
        await this._waitForIceGathering();

        // Возвращаем полный JSON для передачи другу
        return JSON.stringify(this.connection.localDescription);
    }

    async finalizeHandshake(answerStr) {
        try {
            const answer = JSON.parse(answerStr);
            await this.connection.setRemoteDescription(answer);
        } catch (e) {
            this.emit(NETWORK_EVENTS.ERROR, "Ошибка при чтении Ответа: " + e.message);
        }
    }

    // --- CLIENT LOGIC ---
    async joinGame(offerStr) {
        this.isHost = false;
        this._createConnection();

        // Клиент ловит канал
        this.connection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this._setupChannelListeners();
        };

        try {
            const offer = JSON.parse(offerStr);
            await this.connection.setRemoteDescription(offer);

            const answer = await this.connection.createAnswer();
            await this.connection.setLocalDescription(answer);

            await this._waitForIceGathering();

            return JSON.stringify(this.connection.localDescription);
        } catch (e) {
            this.emit(NETWORK_EVENTS.ERROR, "Ошибка при чтении Оффера: " + e.message);
            throw e;
        }
    }

    // --- CHANNEL LOGIC ---
    _setupChannelListeners() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log("Data Channel OPEN!");
            this.emit(NETWORK_EVENTS.CONNECTED);
        };

        this.dataChannel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.emit(NETWORK_EVENTS.DATA, msg);
            } catch (e) {
                console.error("Invalid JSON received", event.data);
            }
        };

        this.dataChannel.onerror = (err) => {
            console.error("Data Channel Error:", err);
            this.emit(NETWORK_EVENTS.ERROR, err);
        };
    }

    send(type, payload) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type, payload }));
        } else {
            console.warn("Cannot send: Channel not open");
        }
    }
}