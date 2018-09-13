import * as ex from 'excalibur';
import { Action, IActionReturn, SocketAction, ISocketActionUpdate, ActionType } from './action';
import { Creature } from '../objects/creature';
import { getUserIDFromJWT } from '../services/jwt.service';
import { Cell } from 'Index';
import { Player } from '../objects/player';
import { ActionService } from '../services/action.service';

export interface IActionAttack {
    target: string;
    part: number;
    dmg: {
        hp: number;
        mp: number;
        st: number;
    };
    stats: {
        hp: number;
        mp: number;
        st: number;
    };
}

interface IPartDamage {
    /** The index of the body part hit on the target */
   p: number;
   /** The array of effects put on the part */
   e: {
       /** The enum index of the effect type */
       i: number;
       /** The amount of turns remaining for the effect */
       t: number;
   }[];
}

export interface IActionAttackPackageNew {
    /** Target name */
    t: string;
    /** Miss (0), block, (1) or parry (2) notification */
    d?: number;
    /** Array of individual attacked parts and their damage and effects */
    p?: IPartDamage[];
    /** Resulting state of the creature after being damaged */
    s?: {
        /** Percentage of consciousness left after attack */
        c: number;
        /** Percentage of blood left after attack */
        b: number;
        /** Percentage of stamina left after attack */
        s: number;
    };
    /** The array of effects put on the whole body */
    e?: {
        /** The enum index of the effect type */
        i: number;
        /** The amount of turns remaining for the effect */
        t: number;
    }[];
}

export class ActionAttack extends Action {
    cell: Cell;
    target: Creature;

    constructor(owner: Player, target: Creature, actionService: ActionService) {
        super(owner, 'Talk', actionService);
        this.target = target;
    }

    perform() {
        super.perform();
        this.sendCommand();
    }
    checkCanPerform(engine: ex.Engine): IActionReturn {
        const actionReturn: IActionReturn = {
            canPerform: false,
            alternateAction: null
        };
        if (!this.target.isFriendly) {
            actionReturn.canPerform = true;
        }
        return actionReturn;
    }
    sendCommand() {
        if (this.socket) {
            const action: SocketAction = {
                sID: getUserIDFromJWT(),
                n: this.owner.name,
                t: ActionType.attack,
                a: {
                    name: this.target.name,
                    x: this.target.x,
                    y: this.target.y,
                }
            };
            this.socket.emit('action', action);
        } else {
            console.log('Socket is missing? ', this.socket);
        }
    }
    finalizeAction(msg: ISocketActionUpdate) {
        super.finalizeAction(msg);
        const update = msg.update as IActionAttackPackageNew;
        if (update) {
            if (update.d !== undefined) {
                switch (update.d) {
                    case 0:
                        this.actionService.actionUpdateMessage.next('Your attack misses ' + this.target.name);
                        break;
                    case 1:
                        this.actionService.actionUpdateMessage.next('Your attack was blocked by ' + this.target.name);
                        break;
                    case 2:
                        this.actionService.actionUpdateMessage.next('Your attack was parried by ' + this.target.name);
                        break;
                }
            } else {
                this.actionService.actionUpdateMessage.next('You attack ' + this.target.name + ' and hit!');
                this.actionService.actionUpdateMessage.next(this.target.name + ' now has:');
                this.actionService.actionUpdateMessage.next(update.s.b + ' blood,');
                this.actionService.actionUpdateMessage.next(update.s.c + ' consciousness, and');
                this.actionService.actionUpdateMessage.next(update.s.s + ' stamina left');

                if (update.e) {

                } else {
                    if (update.p) {
                        for (const part of update.p) {
                            for (const eff of part.e) {
                                this.actionService.actionUpdateMessage.next('You caused a ' + eff.i + ' effect on ' + part.p);
                                this.actionService.actionUpdateMessage.next('It will last for ' + eff.t + ' turns');
                            }
                        }
                    } else {
                        this.actionService.actionUpdateMessage.next('You didn\'t cause any effects :(');
                    }
                }
            }
        }
    }
}
