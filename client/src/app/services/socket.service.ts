import * as io from 'socket.io-client';
import { Injectable } from '@angular/core';
import { getUserIDFromJWT } from './jwt.service';
import { config } from '../app.config';

@Injectable()
export class SocketService {
    private url = config.socket.main;
    private socket: SocketIOClient.Socket;
    /** possibly redundant with the player's instance of currentMapName */
    public currentMapRoom: string = null;

    /** Initlizes the socket */
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
    /** Sends logout message to the socket server */
    logout() {
        this.socket.emit('logout');
    }
    /** Sends the stuck message to the server */
    stuck() {
        this.socket.emit('stuck', {sessionID: getUserIDFromJWT(), roomName: this.currentMapRoom});
    }
    /**
     * Join a new map room on the socket
     * @param roomName The name of the map to join
     * @param playerName The name of the player
     */
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
    /** Leave the socket map room the player is currently in */
    leaveRoom() {
        this.socket.emit('leave_room', {userID: getUserIDFromJWT(), roomName: this.currentMapRoom});
        this.currentMapRoom = null;
    }
}
