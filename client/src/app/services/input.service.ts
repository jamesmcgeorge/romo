import * as ex from 'excalibur';
import { Action, ActionType } from '../actions/action';
import { Creature } from '../objects/creature';
import { Subject } from 'rxjs/Subject';
import { Player } from '../objects/player';
import { ActionService, KeyboardDownAction } from './action.service';
import { Injectable } from '@angular/core';
import { openDoors, closedDoors } from './sprite.service';
import { Lootable } from '../objects/loot.bag';
const Keys = ex.Input.Keys;

@Injectable()
export class InputService {
    public showRadialSubject = new Subject<boolean>();
    public menuDataSubject = new Subject<any>();
    private tempPlayer: Player;
    private menuOptions: any[];
    private cellClicked: ex.Cell;
    private actorClicked: Creature | Lootable;
    private xDist: number;
    private yDist: number;
    public lastKeyAction: KeyboardDownAction;
    private inputAction: KeyboardDownAction;
    private keysDown: ex.Input.Keys[] = [];

    constructor(private actionService: ActionService) {}

    /**
     * Get's an action from the current keyboard input
     * @param engine The Excalibur.js game engine instance
     */
    public getKeyboardInputAction(engine: ex.Engine): Action {
        this.checkKeysDown(engine);
        this.checkPossibleInput();
        const actionToReturn = this.actionService.getKeyBoardDownAction(this.inputAction);
        return actionToReturn;
    }
    /**
     * Populates this.keysDown with the all current keys being pressed
     * @param engine The Excalibur.js game engine instance
     */
    private checkKeysDown(engine: ex.Engine) {
        this.keysDown = engine.input.keyboard.getKeys();
    }
    /** Iterates through the current keys being pressed and then populates this.inputAction */
    private checkPossibleInput() {
        this.inputAction = null;

        if (this.keysDown.length === 1) {
            if (this.isPressed(Keys.Num1)) {
                this.inputAction = KeyboardDownAction.walkSW;
            } else if (this.isPressed(Keys.Num3)) {
                this.inputAction = KeyboardDownAction.walkSE;
            } else if (this.isPressed(Keys.Num7)) {
                this.inputAction = KeyboardDownAction.walkNW;
            } else if (this.isPressed(Keys.Num9)) {
                this.inputAction = KeyboardDownAction.walkNE;
            } else if (this.isPressed(Keys.Down) || this.isPressed(Keys.Num2)) {
                this.inputAction = KeyboardDownAction.walkS;
            } else if (this.isPressed(Keys.Left) || this.isPressed(Keys.Num4)) {
                this.inputAction = KeyboardDownAction.walkW;
            } else if (this.isPressed(Keys.Right) || this.isPressed(Keys.Num6)) {
                this.inputAction = KeyboardDownAction.walkE;
            } else if (this.isPressed(Keys.Up) || this.isPressed(Keys.Num8)) {
                this.inputAction = KeyboardDownAction.walkN;
            } else if (this.isPressed(Keys.Space)) {
                this.inputAction = KeyboardDownAction.contextAction;
            }
        } else if (this.keysDown.length === 2) {
            if ((this.isPressed(Keys.Down) && this.isPressed(Keys.Left)) || (this.isPressed(Keys.Num2) && this.isPressed(Keys.Num4))) {
                this.inputAction = KeyboardDownAction.walkSW;
            } else if ((this.isPressed(Keys.Down) && this.isPressed(Keys.Right)) || (this.isPressed(Keys.Num2) && this.isPressed(Keys.Num6))) {
                this.inputAction = KeyboardDownAction.walkSE;
            } else if ((this.isPressed(Keys.Up) && this.isPressed(Keys.Left)) || (this.isPressed(Keys.Num4) && this.isPressed(Keys.Num8))) {
                this.inputAction = KeyboardDownAction.walkNW;
            } else if ((this.isPressed(Keys.Up) && this.isPressed(Keys.Right)) || (this.isPressed(Keys.Num8) && this.isPressed(Keys.Num6))) {
                this.inputAction = KeyboardDownAction.walkNE;
            }
        }
    }
    /**
     * Checks if a key is being pressed
     * @param key Key to check
     */
    private isPressed(key: ex.Input.Keys): boolean {
        if (this.keysDown.indexOf(key) >= 0) {
            return true;
        }
        return false;
    }
    /**
     * Processes left and right mouse clicks
     * @param event Excalibur.js input pointer event to process
     * @param engine The Excalibur.js game engine instance
     * @param player The player object
     */
    public processMouseInput(event: ex.Input.PointerEvent, engine: ex.Engine, player: Player) {
        if (event.button === 0) {
            this.processLeftClick(event, engine);
        } else if (event.button === 2) {
            this.processRightClick(event, engine, player);
        }
    }
    /**
     * Processes the left click, currently only logs which cell is clicked for debugging
     * @param event Excalibur.js input pointer event to process
     * @param engine The Excalibur.js game engine instance
     */
    private processLeftClick(event: ex.Input.PointerEvent, engine: ex.Engine) {
        console.log(event);
        const cellClicked = engine.currentScene.tileMaps[0].getCellByPoint(event.worldPos.x, event.worldPos.y);
        console.log(cellClicked);
    }
    /**
     * Processes the right clicks, this is mostly a contextual input
     * @param event Excalibur.js input pointer event to process
     * @param engine The Excalibur.js game engine instance
     * @param player The player object
     */
    private processRightClick(event: ex.Input.PointerEvent, engine: ex.Engine, player: Player) {
        this.showRadialSubject.next(true);
        this.tempPlayer = player;
        this.cellClicked = engine.currentScene.tileMaps[0].getCellByPoint(event.worldPos.x, event.worldPos.y);
        const fogCellClicked = engine.currentScene.tileMaps[1].getCellByPoint(event.worldPos.x, event.worldPos.y);
        // If the player is clicking in fog, don't let them see any menu
        if (fogCellClicked.sprites.length > 0) {
            return;
        }

        this.actorClicked = null;
        // check if we're right clicking on a monster
        for (const actor of player.gmService.monsters) {
            if (actor.x === this.cellClicked.x && actor.y === this.cellClicked.y) {
                this.actorClicked = actor;
            }
        }
        // If we didn't find a monster, check if it's another player
        if (!this.actorClicked) {
            for (const actor of player.gmService.otherPlayers) {
                if (actor.x === this.cellClicked.x && actor.y === this.cellClicked.y) {
                    this.actorClicked = actor;
                }
            }
        }
        // If we still haven't clicked something, check if there is a lootable object
        if (!this.actorClicked) {
            for (const lootable of player.gmService.lootables) {
                if (lootable.x === this.cellClicked.x && lootable.y === this.cellClicked.y) {
                    this.actorClicked = lootable;
                }
            }
        }


        this.menuOptions = [];
        const playerCell = engine.currentScene.tileMaps[0].getCellByPoint(player.x, player.y);
        this.xDist = Math.abs(playerCell.x - this.cellClicked.x);
        this.yDist = Math.abs(playerCell.y - this.cellClicked.y);

        if (this.actorClicked) {
            player.canSetAction = false;
            this.menuOptions.push({name: 'Look', aType: ActionType.look});
            this.getActorMenuOptions();
        } else if (this.cellClicked.sprites[1]) {
            player.canSetAction = false;
            this.menuOptions.push({name: 'Look', aType: ActionType.look});
            if (this.xDist <= 16 && this.yDist <= 16) {
                this.getMenuOptions(this.cellClicked.sprites[1].spriteId);
            }
        }
        // organise where to show the popup menu
        const left = event.pagePos.x - 50;
        const right = window.innerWidth - event.pagePos.x + 50;
        const top = event.pagePos.y;
        const bottom = window.innerHeight - event.pagePos.y;

        const data = {
            menuOptions: this.menuOptions,
            css: {
                left: left + 'px',
                right: right + 'px',
                top: top + 'px',
                bottom: bottom + 'px',
            }
        };
        this.menuDataSubject.next(data);
    }
    /**
     * Process the menu item that was selected
     * @param i The index of the menu item
     */
    public processMenuClick(i: number) {
        const payload = {
            menuOption: this.menuOptions[i],
            data: {
                cell: this.cellClicked,
                targetCreature: this.actorClicked,
            }
        };
        const action = this.actionService.getAction(payload);
        if (action) {
            this.tempPlayer.setNextAction(action);
        } else {
            this.tempPlayer.canSetAction = true;
        }
        this.tempPlayer = undefined;
    }
    /** Get the menu options for when an Actor is clicked */
    private getActorMenuOptions() {
        if ((<Lootable>this.actorClicked).isLootable) {
            if (this.xDist <= 32 && this.yDist <= 32) {
                this.menuOptions.push({name: 'Loot', aType: ActionType.checkLoot});
            }
        } else {
            const creature = <Creature>this.actorClicked;
            if (creature.isFriendly) {
                if (this.xDist <= 32 && this.yDist <= 32) {
                    this.menuOptions.push({name: 'Talk', aType: ActionType.talk});
                }
            }
        }
    }
    /**
     * Get the menu options based on the sprite clicked
     * @param spriteId The ID of the sprite being clicked
     */
    private getMenuOptions(spriteId: number) {
        if (openDoors.indexOf(spriteId) >= 0) {
            this.menuOptions.push({name: 'Close', aType: ActionType.closeDoor});
        }
        if (closedDoors.indexOf(spriteId) >= 0) {
            this.menuOptions.push({name: 'Open', aType: ActionType.openDoor});
        }
        // Want to change this to an array of stair sprites to allow more variety, same as the above door options
        if (spriteId === 1061) {
            const x = this.cellClicked.x;
            const y = this.cellClicked.y;
            const nextMap = this.tempPlayer.gmService.determineNextMap(x, y);
            if (nextMap) {
                this.menuOptions.push({name: 'Up', aType: ActionType.changeMap, data: nextMap});
            }
        }
        // Want to change this to an array of stair sprites to allow more variety
        if (spriteId === 1063) {
            const x = this.cellClicked.x;
            const y = this.cellClicked.y;
            const nextMap = this.tempPlayer.gmService.determineNextMap(x, y);
            if (nextMap) {
                this.menuOptions.push({name: 'Down', aType: ActionType.changeMap, data: nextMap});
            }
        }
    }
}
