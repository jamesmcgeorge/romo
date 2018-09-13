import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import 'rxjs/add/operator/toPromise';

import * as ex from 'excalibur';
import { GMService } from '../services/gm.service';
import {Player} from '../objects/player';
import { SocketService } from '../services/socket.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class GameComponent implements OnInit {
    game: ex.Engine;
    player: Player;
    socket: SocketIOClient.Socket;

    // kGame: Kiwi.Game;

    constructor(private gmService: GMService,
        private socketService: SocketService) { }

    ngOnInit() {
        this.organiseGame();
    }

    async organiseGame() {
        this.setupCanvas();
        this.setupSocket();
        this.gmService.loadGameEngine(this.game);
        this.gmService.loadAllResources();
        if (await this.gmService.loadPlayer()) {
            await this.gmService.startGame();
            this.gmService.createWorld();
        } else {
            this.gmService.clearResources();
        }
    }

    setupCanvas() {
        this.game = new ex.Engine({
            canvasElementId: 'game',
            width: 800,
            height: 600,
            // displayMode: ex.DisplayMode.FullScreen,
            pointerScope: ex.Input.PointerScope.Canvas,
            });
        ex.Physics.collisionResolutionStrategy = ex.CollisionResolutionStrategy.Box;
        ex.Physics.checkForFastBodies = false;
    }

    setupSocket() {
        this.socketService.init();
        console.log('Socket Created');
        this.socket = this.socketService.getSocket();
    }
}
