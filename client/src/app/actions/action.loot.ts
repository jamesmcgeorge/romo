import * as ex from 'excalibur';
import { Action, ActionReturn, SocketAction, SocketActionUpdate, ActionType } from './action';
import { getUserIDFromJWT } from '../services/jwt.service';
import { Player } from '../objects/player';
import { ActionService } from '../services/action.service';
import { Lootable } from '../objects/loot.bag';
import { ISocketItem } from '../objects/item';

export interface ActionLootUpdate {
    /** Name of the loot bag */
    n: string;
    /** Array of items in the loot bag */
    i: ISocketItem[];
}

export class ActionLoot extends Action {

    constructor(owner: Player, private lootable: Lootable, actionService: ActionService) {
        super(owner, 'Loot', actionService);
    }

    perform() {
        super.perform();
        this.sendCommand();
    }
    checkCanPerform(engine: ex.Engine): ActionReturn {
        const actionReturn: ActionReturn = {
            canPerform: false,
            alternateAction: null
        };
        if (this.owner.stats.currentConsciousness > 0) {
            actionReturn.canPerform = true;
        }
        return actionReturn;
    }
    sendCommand() {
        if (this.socket) {
            const action: SocketAction = {
                sID: getUserIDFromJWT(),
                n: this.owner.name,
                t: ActionType.checkLoot,
                a: {
                    n: this.lootable.name,
                    x: this.lootable.x / 16,
                    y: this.lootable.y / 16,
                }
            };
            this.socket.emit('action', action);
        } else {
            console.log('Socket is missing? ', this.socket);
        }
    }
    finalizeAction(msg: SocketActionUpdate) {
        super.finalizeAction(msg);
        // console.log(msg);
        const update = msg.update as ActionLootUpdate;
        if (update) {
            console.log(update);
            this.owner.gmService.inventoryService.loadLootContainer(update);
            this.owner.gmService.inventoryService.showLootContainer(this.lootable.pos.x, this.lootable.pos.y);
        }
    }
}
