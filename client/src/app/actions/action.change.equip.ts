import * as ex from 'excalibur';
import { Action, ActionReturn, SocketAction, SocketActionUpdate, ActionType } from './action';
import { getUserIDFromJWT } from '../services/jwt.service';
import { ActionService } from '../services/action.service';
import { Slot } from '../objects/slot';
import { Player } from '../objects/player';

export interface IMoveItem {
    slotFrom: {
        isBag: boolean;
        index: number;
    };
    slotTo: {
        isBag: boolean;
        index: number;
    };
}

export class ActionChangeEquipment extends Action {


    constructor(owner: Player, actionService: ActionService, private move: IMoveItem) {
        super(owner, 'Change Equipment', actionService);
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
                t: ActionType.changeEquip,
                a: {
                    f: [this.move.slotFrom.isBag ? 1 : 0, this.move.slotFrom.index],
                    t: [this.move.slotTo.isBag ? 1 : 0, this.move.slotTo.index],
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
        const update = msg.update;
        if (update.s) {
            const move = update.m;
            let from: Slot, to: Slot;
            if (move.f[0] === 0) {
                from = this.owner.inventory.equipmentSlots[move.f[1]];
            } else {
                from = this.owner.inventory.bagSlots[move.f[1]];
            }
            if (move.t[0] === 0) {
                to = this.owner.inventory.equipmentSlots[move.t[1]];
            } else {
                to = this.owner.inventory.bagSlots[move.t[1]];
            }
            const temp = to.contents;
            to.contents = from.contents;
            from.contents = temp;
            if (temp !== undefined && temp !== null) {
                this.actionService.actionUpdateMessage.next('You swapped an item');
            } else {
                this.actionService.actionUpdateMessage.next('You moved an item');
            }
            this.owner.updateGearSprites(this.owner.gmService.loaderService, this.owner.gmService.spriteService);
            this.owner.setDrawing('stack');
        }
    }
}
