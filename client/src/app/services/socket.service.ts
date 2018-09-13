import { Observable } from 'rxjs/Observable';
import { MessageType, SocketMessage } from '../../floppycarrot';
import * as io from 'socket.io-client';
import { Injectable } from '@angular/core';
import { getUserIDFromJWT } from './jwt.service';
import { config } from '../app.config';

interface ListenerMap {
    type: string;
    function: Function;
}

@Injectable()
export class SocketService {
    private url = config.socket.main;
    private socket: SocketIOClient.Socket;
    public currentMapRoom: string = null;

    init() {
        const token = localStorage.getItem('token');
        this.socket = io.connect(this.url, {
            query: {token: token},
        });
        this.socket.on('auth', (data) => {
            if (data.isValid) {
                console.log('Socket Session Valid');
            } else {
                console.log('Socket Session InValid');
            }
        });
    }
    getSocket() {
        return this.socket;
    }
    disconnect() {
        this.socket.disconnect();
    }
    logout() {
        this.socket.emit('logout');
    }
    stuck() {
        this.socket.emit('stuck', {sessionID: getUserIDFromJWT(), roomName: this.currentMapRoom});
    }
    joinRoom(roomName: string, playerName: string) {
        if (this.currentMapRoom === null) {
            this.socket.emit('join_room', {
                userID: getUserIDFromJWT(),
                roomName: roomName,
                playerName: playerName
            });
            this.currentMapRoom = roomName;
        } else {
            console.error('Cannot join map room without leaving other first');
        }
    }
    leaveRoom() {
        this.socket.emit('leave_room', {userID: getUserIDFromJWT(), roomName: this.currentMapRoom});
        this.currentMapRoom = null;
    }
    setupListeners(listenerArray: ListenerMap[]) {
        for (const listener of listenerArray) {
            this.socket.on(listener.type, listener.function);
        }
    }

    send(type: string, data: any) {
        this.socket.emit(type, data);
    }

    sendMessage(message) {
        this.socket.emit('add-message', {userId: getUserIDFromJWT(), type: MessageType.chat, time: Date.now(), data: message});
    }

    getMessages() {
        const observable = new Observable(observer => {
            this.socket = io(this.url);
            this.socket.on('message', (message: SocketMessage) => {
                console.log(message);
                message.convertedTime = new Date(message.time).toLocaleTimeString();
                observer.next(message);
            });
            return () => {
                this.socket.disconnect();
            };
        });
        return observable;
    }
}
