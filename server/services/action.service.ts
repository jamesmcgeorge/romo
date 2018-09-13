import { SocketAction, ActionType, ActionWalk, SocketActionUpdate, ActionWalkUpdate, TileUpdate, ActionCellUpdate, Quest, RawDungeonDoor } from '../floppycarrot/floppycarrot';
import { cellLookup } from "./look.service";
import { updatePlayerMapName, updatePlayerQuests, updatePlayerPosition } from './save/player.service';
import { User, GameManager } from './game.service';
import logger from './logger.service';
import { AttackService } from './attack.service';
import { StatService } from './stat.service';
import { DBSlot } from '../floppycarrot/objects/slot';
import { EffectService } from './effect.service';

interface IActionChgEquip {
    /** The slot the item is moving from, first element in the array is 1 if the slot is a 
     * bag slot, otherwise 0 for equipment, second element is the index of either the bag 
     * slot or equipment slot */
    f: number[];
    /** The slot the item is moving to, first element in the array is 1 if the slot is a 
     * bag slot, otherwise 0 for equipment, second element is the index of either the bag 
     * slot or equipment slot */
    t: number[];
}

interface ActionLootUpdate {
    /** Name of the loot bag */
    n: string;
    /** Array of items in the loot bag */
    i: ISocketItem[];
}
interface ISocketItem {
    /** Item's Material index */
    m: number;
    /** Item's Quality index */
    q: number;
    /** Item's type */
    t: number;
    /** Item's tech or magic addon */
    c: number;
    /** Item's sub type */
    s: number;
    /** weapon type */
    w?: number;
    /** armor type */
    a?: number;
}

interface ISocketActionUpdateLoot {
    /** Success or not */
    s: boolean;
    /** Final piece of loot or not */
    f: boolean;
    /** The index of the item in the lootable array */
    i: number,
    /** Array with value 0 determining if slot going to is a bag or not, value 1 the index of the equipment or bag */
    t: number[],
}

export class ActionManager {
    gm: GameManager;

    constructor(gm: GameManager) {
        this.gm = gm;
    }
    /**
     * Handles the user SocketAction messages from the client
     * @param msg The message from the client
     * @param user The user sending the message
     * @param socket The socket sending the message
     */
    public async handleAction(msg: SocketAction, user: User, socket: SocketIO.Socket) {
        const update: SocketActionUpdate = {
            name: msg.n,
            type: msg.t,
            update: null
        };
        try {
            switch (msg.t) {
                case ActionType.walk:
                    update.update = this.handleWalkAction(msg, user);
                    break;
                case ActionType.openDoor:
                    update.update = this.handleOpenDoorAction(msg);
                    break;
                case ActionType.closeDoor:
                    update.update = this.handleCloseDoorAction(msg);
                    break;
                case ActionType.look:
                    update.update = this.handleLookAction(msg);
                    break;
                case ActionType.talk:
                    update.update = this.handleTalkAction();
                    break;
                case ActionType.rest:
                    update.update = this.handleRestAction(user);
                    break;
                case ActionType.genNewDungeon:
                    update.update = await this.handleGenNewDungeon(msg, user);
                    break;
                case ActionType.changeMap:
                    update.update = await this.handleChangeMap(msg, user, socket);
                    break;
                case ActionType.attack:
                    update.update = this.handleAttack(msg, user);
                    break;
                case ActionType.changeEquip:
                    update.update = this.handleChangeEquip(msg, user);
                    break;
                case ActionType.checkLoot:
                    update.update = this.handleCheckLoot(msg, user);
                    break;
                case ActionType.takeLoot:
                    update.update = this.handleTakeLoot(msg, user);
                    break;
                case ActionType.trashItem:
                    update.update = this.handleTrashItem(msg, user);
                    break;
                case ActionType.genNewQuest:
                    update.update = this.handleGenNewQuest(msg, user);
                    break;
                default:
                    console.log('Default Action');
                    break;
            }
            this.checkEffects(user);
            return update;
        } catch (err) {
            logger.error(err);
        }
    }
    /**
     * Check if the user has any effects to process after performing an action.
     * Should probably rework this to only take effect if the player truly performs an action
     * @param user The user to check
     */
    private checkEffects(user: User) {
        let hasEffect = user.stats.body.currentEffects.length > 0;

        for (const part of user.stats.body.bodyParts) {
            if (part.currentEffects.length > 0) {
                hasEffect = true;
                break;
            }
        }
        if (hasEffect) {
            const effService = new EffectService(this.gm, user);
            effService.processEffects();
            // effService.sendEffectUpdate();

            if (user.stats.blood === 0) {
                effService.clearAllEffects();
                user.killAndRespawn();
            } else {
                this.gm.databaseManager.updatePlayerStats(user);
            }
        }
    }
    /**
     * Handle the user's walk action. Needs to be reworked as it's currently not really authoritative
     * @param msg Walk message from the client
     * @param user The user sending the message
     */
    private handleWalkAction(msg: SocketAction, user: User) {
        const action = msg.a as ActionWalk;
        user.pos.x += action.changeX;
        user.pos.y += action.changeY;
        const update: ActionWalkUpdate = {
            newX: user.pos.x,
            newY: user.pos.y,
        };
        return update;
    }
    /**
     * Handles the open door actions, including updating the A* map grid for the AI
     * @param msg Open door message from the client
     */
    private handleOpenDoorAction(msg: SocketAction) {
        const action = msg.a;
        const room = this.gm.getUsersMapRoom(msg.sID);
        let door: RawDungeonDoor;
        for (const mapDoor of room.map.doors) {
            if (mapDoor.idx === action.idx) {
                door = mapDoor;
            }
        }
        const cell = door.openSprite;
        this.gm.aiManager.getAI(room.name).updateGrid(action.x, action.y, true);
        const dbUpdate: TileUpdate = {
            lIndex: '1',
            cIndex: action.idx.toString(),
            content: cell + 1,
        }
        this.gm.databaseManager.updateTileInMap(room.name, dbUpdate);
        // async update open door in DB
        const update: ActionCellUpdate = {
            idx: action.idx,
            newSpriteId: door.openSprite,
            newSheetId: 0,
            isSolid: false,
        };
        return update;
    }
    /**
     * Handles the close door actions, including updating the A* map grid for the AI
     * @param msg Close door message from the client
     */
    private handleCloseDoorAction(msg: SocketAction) {
        const action = msg.a;
        const room = this.gm.getUsersMapRoom(msg.sID);
        let door: RawDungeonDoor;
        for (const mapDoor of room.map.doors) {
            if (mapDoor.idx === action.idx) {
                door = mapDoor;
            }
        }
        const cell = door.closedSprite;
        this.gm.aiManager.getAI(room.name).updateGrid(action.x, action.y, false);
        // async update open door in DB
        const dbUpdate: TileUpdate = {
            lIndex: '1',
            cIndex: action.idx.toString(),
            content: cell + 1,
        }
        this.gm.databaseManager.updateTileInMap(room.name, dbUpdate);
        const update: ActionCellUpdate = {
            idx: action.idx,
            newSpriteId: door.closedSprite,
            newSheetId: 0,
            isSolid: true,
        }
        return update;
    }
    /**
     * Handles the look action, needs to be reworked to something more robust and easier to add more objects to
     * @param msg Look message from the client
     */
    private handleLookAction(msg: SocketAction) {
        const action = msg.a;
        const room = this.gm.getUsersMapRoom(msg.sID);
        let look;
        for (const creature of room.map.creatures) {
            if (creature.pos.x === action.x && creature.pos.y === action.y) {
                look = creature.name;
            }
        }
        if (!look) {
            for (const item of room.map.items) {
                if (item.pos.x === action.x && item.pos.y === action.y) {
                    look = item.item.itemName;
                }
            }
        }
        if (!look) {
            for (const layer of room.map.layers) {
                if (layer.name !== 'Floor') {
                    const cellSprite = layer.data[action.idx] - 1;
                    look = cellLookup[cellSprite];
                }
            }
        }
        if (!look) {
            look = 'Nothing to see';
        }
        const update = {
            msg: look,
        }
        return update;
    }
    /**
     * Handles talk, currently only one NPC talks, so it's always the same action...
     */
    private handleTalkAction() {
        const update = {
            intro: 'Hi, I\'m Dave! Welcome to my humble tavern!',
            options: [
                {
                    name: 'Rest',
                    aType: ActionType.rest,
                    data: {},
                },{
                    name: 'Explore random dungeon',
                    aType: ActionType.genNewDungeon,
                    data: {},
                },{
                    name: 'Shop',
                    aType: ActionType.shop,
                    data: {},
                }
            ]
        }
        return update;
    }
    /**
     * Handles the rest action, heals up the user
     * @param user The user resting
     */
    private handleRestAction(user: User) {
        const hpRegen = 100 - user.stats.blood;
        const mpRegen = 100 - user.stats.consciousness;
        const stRegen = 100 - user.stats.stamina;
    
        user.stats.blood = 100;
        user.stats.consciousness = 100;
        user.stats.stamina = 100;
    
        // TODO fix some injuries etc
    
        // async save player data to DB
        
        const update = {
            hp: hpRegen,
            sta: stRegen,
            mp: mpRegen,
        }
        this.gm.databaseManager.updatePlayerStats(user);
        return update;
    }
    /**
     * Creates a new random dungeon for the user
     * @param msg New dungeon message
     * @param user User requesting the new dungeon
     */
    private async handleGenNewDungeon(msg: SocketAction, user: User) {
        // delete current random dungeon and fog data
        await this.gm.databaseManager.deleteUserDungeons(user);
        await this.gm.databaseManager.deleteRandomFogData(user);

        const totalFeatures = (msg.a.d + 1) * 15;

        const maps = this.gm.createNewDungeon('Random-' + msg.n, 100, 100, totalFeatures, msg.a.l, msg.a.d);
        const quest: Quest = {
            isCurrent: true,
            name: 'Random-' + msg.n,
        };
        updatePlayerQuests(this.gm, user.sessionID, quest);
        // clear old room/s
        for (let i = 0; i < 16; i++) {
            this.gm.roomManager.deleteRoom('Random-' + msg.n + '-' + i);
        }
        const socketMaps = this.gm.prepareMapsForSending(maps);
        return socketMaps;
    }
    /**
     * Handles changing the map for the user
     * @param msg Change map message
     * @param user User requesting the map change
     * @param socket The socket the user is on
     */
    private async handleChangeMap(msg: SocketAction, user: User, socket: SocketIO.Socket) {
        this.gm.socketManager.smm.alertOnUserLeaveRoom(user);
        this.gm.roomManager.removeUserFromRoom(user.sessionID, user.mapRoom);
        this.gm.roomManager.addUserToRoom(user, msg.a.map);
        user.pos.x = msg.a.x;
        user.pos.y = msg.a.y;
        user.mapRoom = msg.a.map;
        await updatePlayerMapName(this.gm, user.sessionID, msg.a.map);
        await updatePlayerPosition(this.gm, user.sessionID, user.pos);
        this.gm.socketManager.smm.alertOnUserJoinRoom(user.mapRoom, user.sessionID);
        this.gm.socketManager.smm.informNewRoomMateOfExistingPlayers(user.mapRoom, socket);
        return null;
    }
    /**
     * Handles the user attacking a monster
     * @param msg The attack message
     * @param user The user performing the attack
     */
    private handleAttack(msg: SocketAction, user: User) {
        const room = this.gm.roomManager.getRoom(user.mapRoom);
        for (const creature of room.map.creatures) {
            if (creature.name === msg.a.name) {
                // get an attack service to handle the combat
                const atkService = new AttackService(user, creature);
                let dmg = undefined;
                // mainhand attack first
                if (atkService.checkAttackHit(true)) {
                    if (!atkService.checkAttackBlocked()) {
                        if (!atkService.checkAttackParried(true)) {
                            dmg = atkService.performHit(true);
                        }                     
                    } 
                }
                // TODO: off hand attack
                
                // unsure if want to only gain XP on hit, or perhaps do some gain regardless
                if (dmg !== undefined) {
                    // gain stats
                    const statSvc = new StatService(user, this.gm);
                    statSvc.performAttackStatUpdate();
                }

                const results = atkService.getResults();

                return results;
            }
        }
        logger.error('Attack target missing', msg);
    }
    /**
     * Handles the user changing equipment around in their inventory and bag slots
     * @param msg The change equip message
     * @param user The user changing equip
     */
    private handleChangeEquip(msg: SocketAction, user: User) {
        const move = msg.a as IActionChgEquip;
        if (move !== undefined) {
            let from: DBSlot, to: DBSlot;
            if (move.f[0] === 0) {
                from = user.inventory.equipmentSlots[move.f[1]];
            } else {
                from = user.inventory.bagSlots[move.f[1]];
            }
            if (move.t[0] === 0) {
                to = user.inventory.equipmentSlots[move.t[1]];
            } else {
                to = user.inventory.bagSlots[move.t[1]];
            }
            const temp = to.item;
            to.item = from.item;
            from.item = temp;

            // send update to DB
            if (move.f[0] === 0) {
                this.gm.databaseManager.updateEquipmentSlot(user.email, from, move.f[1]);
            } else {
                this.gm.databaseManager.updateBagSlot(user.email, from, move.f[1]);
            }
            if (move.t[0] === 0) {
                this.gm.databaseManager.updateEquipmentSlot(user.email, to, move.t[1]);
            } else {
                this.gm.databaseManager.updateBagSlot(user.email, to, move.t[1]);
            }
            const update = {
                s: true,
                m: move,
            }
            return update;
        }
    }
    /**
     * Handles opening up a lootable container
     * @param msg The check loot message
     * @param user The user checking loot
     */
    private handleCheckLoot(msg: SocketAction, user: User) {
        const lootableName = msg.a.n;
        const lootable = this.gm.roomManager.findLootable(lootableName, user.mapRoom);
        // console.log('Lootable: ' + JSON.stringify(lootable));
        // console.log('Lootable: ' + JSON.stringify(lootable));
        const update: ActionLootUpdate = {
            n: lootableName,
            i: new Array<ISocketItem>(),
        };

        for (const loot of lootable.loot) {
            const isi: ISocketItem = {
                m: loot.material,
                q: loot.quality,
                t: loot.type,
                c: loot.techMagic,
                s: loot.subType,
                w: loot.weaponType,
                a: loot.armorType,
            }
            update.i.push(isi);
        }
        // console.log('Lootable update: ' + JSON.stringify(update.i));
        return update;
    }
    /**
     * Handles taking loot from a container
     * @param msg The take loot message
     * @param user The user taking loot
     */
    private handleTakeLoot(msg: SocketAction, user: User) {
        const lootableName = msg.a.n;
        const act = msg.a;
        const lootable = this.gm.roomManager.findLootable(lootableName, user.mapRoom);
        const update: ISocketActionUpdateLoot = {
            s: false,
            f: false,
            i: act.i,
            t: act.t,
        }
        if (act.i >= lootable.loot.length) {
            console.log('Trying to loot that which does not exist');
        } else {
            const looted = lootable.loot.splice(act.i, 1);
            let to: DBSlot;
            // in memory update
            if (act.t[0] === 0) {
                to = user.inventory.equipmentSlots[act.t[1]];
            } else {
                to = user.inventory.bagSlots[act.t[1]];
            }
            if (to === undefined) {
                console.log('Slot is undefined:')
                console.log(JSON.stringify(msg));
                console.log('--SLOTS--')
                console.log(JSON.stringify(user.inventory.equipmentSlots[act.t[1]]));
                console.log(JSON.stringify(user.inventory.bagSlots[act.t[1]]));
            } else if (to.item !== undefined && to.item !== null) {
                console.log('Cannot loot onto an existing item');
            } else {
                to.item = looted[0];

                // db update
                if (act.t[0] === 0) {
                    this.gm.databaseManager.updateEquipmentSlot(user.email, to, act.t[1]);
                } else {
                    this.gm.databaseManager.updateBagSlot(user.email, to, act.t[1]);
                }
                // update lootable in DB
                this.gm.databaseManager.deleteLootableFromMap(lootable.name, user.mapRoom);
                if (lootable.loot.length === 0) {
                    update.f = true;
                } else {
                    this.gm.databaseManager.addLootableToMap(lootable, user.mapRoom);
                }
                   
                update.s = true;
            }
            
        }
        
        return update;
    }
    /**
     * Handles deleting an item that's no longer wanted
     * @param msg The trash message
     * @param user The user trashing
     */
    private handleTrashItem(msg: SocketAction, user: User) {
        const move = msg.a as IActionChgEquip;
        const update = {
            s: false,
            m: move,
        }
        if (move !== undefined) {
            let from: DBSlot;
            if (move.f[0] === 0) {
                from = user.inventory.equipmentSlots[move.f[1]];
            } else {
                from = user.inventory.bagSlots[move.f[1]];
            }
            from.item = null;

            // send update to DB
            if (move.f[0] === 0) {
                this.gm.databaseManager.updateEquipmentSlot(user.email, from, move.f[1]);
            } else {
                this.gm.databaseManager.updateBagSlot(user.email, from, move.f[1]);
            }
            update.s = true;
            return update;
        }
        return update;
    }
    /**
     * Creates a new quest for the user
     * @param msg The new quest message
     * @param user The user requesting a new quest
     */
    private handleGenNewQuest(msg: SocketAction, user: User) {
        
        this.gm.questManager.createNewQuest(user, msg.a.g);
    }
}
