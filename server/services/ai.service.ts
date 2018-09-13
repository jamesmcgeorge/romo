import { GameManager, User } from './game.service';
import { DBCreature, MapRoom, ActionType, SocketActionUpdate, Vector2D, DBPlayer, IActionAttack } from '../floppycarrot/floppycarrot';
import { randomRangeInt } from './map/generate';
import * as PF from 'pathfinding';
import { SpriteHelper } from './map/sprite.helper';
// const PF = require('pathfinding');
import logger from './logger.service';
import { AttackService } from './attack.service';
import { Effect } from '../floppycarrot/objects/items/effect';

interface IAICreatureDict {
    [key: string]: AICreature;
}

interface IAIDict {
    [key: string]: AI;
}

export enum AIType {
    guard,
    patrol,
    meander,
}

export class AIManager {
    /**
     * Internal reference to the GameManager instance
     */
    gm: GameManager;
    /**
     * Private dictionary of AI the manager is holding
     */
    private ais: IAIDict;
    spriteHelper: SpriteHelper
    
    constructor(gm: GameManager) {
        this.gm = gm;
        this.spriteHelper = new SpriteHelper();
        this.ais = {};
    }

    addNewAIToRoom(room: MapRoom) {
        logger.info('Adding AI to ' + room.name);
        this.ais[room.name] = new AI(this, room);
    }

    addPlayerToAIRoom(roomName: string, player: User) {
        const ai: AI = this.ais[roomName];
        if (ai) {
            let found = false;
            for (const user of ai.room.players) {
                if (user.email === player.email) {
                    found = true;
                }
            }
            if (!found) {
                ai.room.players.push(player);
            }
        }
    }
    getAI(roomName: string): AI {
        return this.ais[roomName];
    }
    
    processAIForRoom(roomName: string): SocketActionUpdate[] {
        const ai: AI = this.ais[roomName];
        if (ai) {
            // logger.info('Processing ' + roomName + ' AI');
            ai.processNPCActions();
            return ai.getUpdates();
        }
        return [];
    }
}

export class AI {
    /**
     * Private dictionary of AICreatures
     */
    private aiCreatures: IAICreatureDict;
    /**
     * Private reference to the room this AI is controlling
     */
    room: MapRoom;
    /**
     * Private reference to the AIManager
     */
    aim: AIManager;

    private grid: PF.Grid;
    // private tempGrid: PF.Grid;

    private finder: PF.AStarFinder;

    constructor(manager: AIManager, room: MapRoom) {
        this.aim = manager;
        this.room = room;
        this.aiCreatures = {};
        for (const creature of room.map.creatures) {
            this.aiCreatures[creature.name] = new AICreature(creature, this);
        }
        this.setupAStar();
    }

    private setupAStar() {
        this.grid = new PF.Grid(100,100);
        for (let i = 0; i < this.room.map.width; i++) {
            for (let j = 0; j < this.room.map.height; j++) {
                if (this.aim.spriteHelper.isSolid(this.room.map.layers[1].data[i + j * this.room.map.width])) {
                    this.grid.setWalkableAt(i,j, false);
                } /*else {
                    logger.info('Walkable space at: ', i, j, this.room.map.layers[1].data[i + j * this.room.map.width])
                }*/
            }
        }
        this.finder = new PF.AStarFinder({
            diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacle,
        });
    }
    /**
     * Update the A* grid
     * @param x X coord
     * @param y Y coord
     * @param isWalkable Whether or not the cell is walkable/passable
     */
    public updateGrid(x: number, y: number, isWalkable: boolean) {
        this.grid.setWalkableAt(x,y, isWalkable);
    }
    /**
     * Uses A* to find the path between the two points on the map grid
     * @param from      The Vector2D starting point, must be in cell grid coords and not world pixel
     * @param to        The Vector2D end point, must be in cell grid coords and not world pixel
     */
    public findPath(from: Vector2D, to: Vector2D) {

        const tempGrid = this.grid.clone();
        logger.info('Finding path: ', from.x, from.y, to.x, to.y);
        const path = this.finder.findPath(from.x, from.y, to.x, to.y, tempGrid);
        if (path.length === 0) {
            logger.info('Couldn\'t find a path');
            return null;
        }
        return path;
    }
    /**
     * Check if a cell is occupied by another creature
     * @param dest The cell to test
     */
    public isCellOccupied(dest: Vector2D) {
        for (const creatName of Object.keys(this.aiCreatures)) {
            const ai: AICreature = this.aiCreatures[creatName];
            if (ai) {
                if (ai.creature.pos.equals(dest)) {
                    return true;
                }
            }
        }
        return false;
    }

    public processNPCActions() {
        for (const creatName of Object.keys(this.aiCreatures)) {
            const ai: AICreature = this.aiCreatures[creatName];
            if (ai) {
                ai.processTurn();
            }
        }
    }
    public getUpdates(): SocketActionUpdate[] {
        const arr: SocketActionUpdate[] = [];
        for (const creatName of Object.keys(this.aiCreatures)) {
            const ai: AICreature = this.aiCreatures[creatName];
            if (ai) {
                if (ai.nextAction) {
                    // logger.info('Next Action - ' + ai.creature.name, ai.nextAction);
                    arr.push(ai.nextAction);
                    ai.lastAction = ai.nextAction;
                }
            }
        }
        return arr;
    }

    private removeCreature(creature: DBCreature) {
        delete this.aiCreatures[creature.name];
    }
}

const Directions = [
    {name: 'North', number: 8, change: {x: 0, y: -16}},
    {name: 'South', number: 2, change: {x: 0, y: 16}},
    {name: 'West', number: 4, change: {x: -16, y: 0}},
    {name: 'East', number: 6, change: {x: 16, y: 0}},
    {name: 'North West', number: 7, change: {x: -16, y: -16}},
    {name: 'North East', number: 9, change: {x: 16, y: -16}},
    {name: 'South West', number: 1, change: {x: -16, y: 16}},
    {name: 'South East', number: 3, change: {x: 16, y: 16}}
];

export class AICreature {
    /** Underlying creature in DB format */
    public creature: DBCreature;
    private ai: AI;
    public lastAction: SocketActionUpdate;
    private lastPosSawPlayer: Vector2D;
    private path: number[][];
    private curPathStep: number;
    private targetPlayer: User;
    public nextAction: SocketActionUpdate;

    constructor(creature: DBCreature, ai: AI) {
        this.creature = creature;
        this.ai = ai;
    }
    /**
     * Send a log message for the monster
     * @param message Message to send
     * @param object Any extra info to log
     */
    private log(message: string, object?: any) {
        logger.info(this.creature.name + ': ' + message, object);  
    }
    /** Process the AI turn */
    public processTurn() {
        if (this.creature.stats.blood === 0) {
            this.kill();
        }
        let foundAction = false;
        let count = 0;
        this.nextAction = null;
        while (!foundAction && count < 10) {
            if (this.creature.isFriendly) {
                foundAction = this.handleFriendlyActions();
            } else {
                foundAction = this.handleHostileActions();
            }
            count++;
        }
        this.processEffects();
        if (this.creature.stats.blood === 0) {
            this.kill();
        }
    }
    /** Processes the effects currently on the creature */
    private processEffects() {
        let flag = false;
        for (const eff of this.creature.stats.body.currentEffects) {
            Effect.processEffect(eff, this.creature, this.creature.stats.body);
            flag = true;
            if (this.checkBloodLevel()) {
                return;
            }
        }
        for (const part of this.creature.stats.body.bodyParts) {
            for (const eff of part.currentEffects) {
                Effect.processEffect(eff, this.creature, part);
                flag = true;
                if (this.checkBloodLevel()) {
                    return;
                }
            }
        }
        if (flag) {
            console.log('Effects Processed, ' + this.creature.stats.blood + " blood left for " + this.creature.name);
        }
    }
    /** Kills the creature and informs the client */
    private kill() {
        const dedUpdate: SocketActionUpdate = {
            name: this.creature.name,
            type: ActionType.die,
            update: null,
        }
        this.ai.aim.gm.socketManager.smm.sendAIUpdate(this.ai.room.name, dedUpdate);
        this.ai.aim.gm.roomManager.killCreature(this.ai.room.name, this.creature);
    }
    /** Checks if the creature is still alive with enough blood */
    private checkBloodLevel() {
        if (this.creature.stats.blood < 0) {
            this.creature.stats.blood = 0;
            this.log('bled to death');
            return true;
        }
        return false;
    }
    /** Looks for the closest player the creature can see */
    private getClosestSeenPlayer() {
        let closest: User = null;
        let distance: number;
        for (const sessionID of Object.keys(this.ai.room.players)) {
            const player = this.ai.room.players[sessionID];
            if (!this.isWithinMaxDistance(player)) {
                // logger.info('Player not within distance');
                continue;
            }
            if (closest) {
                const curDist = this.getDistanceFromPlayer(player);
                if (curDist < distance) {
                    const canSee = this.canSeePlayer(player);
                    if (canSee) {
                        closest = player;
                        distance = curDist;
                    }
                }
            } else {
                if (this.canSeePlayer(player)) {
                    distance = this.getDistanceFromPlayer(player);
                    closest = player;
                }
            }
        }
        return closest;
    }
    /**
     * Checks if the player is within a max follow distance to prevent endless chasing
     * @param player The player to check against
     */
    private isWithinMaxDistance(player: User): boolean {
        if (Math.abs(player.pos.x - this.creature.pos.x) > 300 ||
            Math.abs(player.pos.y - this.creature.pos.y) > 300) {
            return false;
        }
        return true;
    }
    /**
     * Check if the monster can see the player
     * @param player The player to check against
     */
    private canSeePlayer(player: User): boolean {
        let foundOpaque = false;
        let curCellLayer;
        const vecStart = new Vector2D(this.creature.pos.x, this.creature.pos.y);
        const vecDist = player.pos.sub(vecStart);
        const vecNorm = vecDist.normalize();
        while (!foundOpaque) {
            vecStart.addEqual(new Vector2D(vecNorm.x * 8, vecNorm.y *8));
            
            if (Math.abs(vecStart.x - player.pos.x) < 8 && Math.abs(vecStart.y - player.pos.y) < 8) {
                this.log('Can see the player');
                return true;
            }
            curCellLayer = this.ai.room.map.layers[1].data[Math.floor(vecStart.x/16) + Math.floor(vecStart.y/16) * this.ai.room.map.width];
            
            if (!this.ai.aim.spriteHelper.isSpriteSeeThrough(curCellLayer)) {
                foundOpaque = true;
            }
        }
        return false;
    }
    /**
     * Gets monster squared distance from the player, faster than square rooting for actual distance
     * @param player The player to check
     */
    private getDistanceFromPlayer(player: User): number {
        const monPos = this.creature.pos;
        const userPos = player.pos;
        const x = userPos.x - monPos.x;
        const y = userPos.y - monPos.y;
        const dist = (x * x) + (y * y);
        return dist;
    }
    /**
     * To be implemented, check if the monster can hear the player through walls/doors
     * @param player The player to check
     */
    private canHearPlayer(player: User) {

    }
    /** Process the friendly/passive AI actions */
    private handleFriendlyActions(): boolean {
        switch (this.creature.aiType) {
            case AIType.guard:
                return this.handlePassiveGuard();
            case AIType.meander:
                return true;
            case AIType.patrol:
                return true;
            default:
                this.log('AI had default type');
                return true;  
        }
    }
    /** Process the hostile AI actions */
    private handleHostileActions(): boolean {
        switch (this.creature.aiType) {
            case AIType.guard:
                return this.handleHostileGuard();
            case AIType.meander:
                return true;
            case AIType.patrol:
                return true;
            default:
                this.log('AI had default type');
                return true;  
        }
    }
    /** Handle the AI thoughts of a hostile guard */
    private handleHostileGuard() {
        // Check to see if we have moved too far away from our guard position
        if (this.isOutOfGuardRange()) {
            this.log('Out of guard range, should return home');
            if (this.path) {
                const pathEndX = this.path[this.path.length-1][0] * 16;
                const pathEndY = this.path[this.path.length-1][1] * 16;
                if (pathEndX === this.creature.origin.x && pathEndY === this.creature.origin.y) {
                    this.log('Path already set for home, continuing');
                    this.curPathStep += 1;
                    return this.moveToNextAStarPath();
                }
            }
            this.log('Setting path for home');
            this.path = this.ai.findPath(this.creature.pos.divideByScalar(16), this.creature.origin.divideByScalar(16));
            // this.log('New path', this.path);
            this.curPathStep = 1;
            return this.moveToNextAStarPath();
        }
        // Check if a player is visible
        if (this.checkForPlayer()) {
            // Check if player is in range for attack
            if (this.isPlayerInRange()) {
                this.log('Attacking player');
                this.attackPlayer();
                return true;
            } else {
                // Check if we already have a path we're following
                if (this.path && this.path.length > 0) {
                    // this.log('We have path already:', this.path);
                    const pathEnd = this.path[this.path.length -1];
                    // Check if the player is still in the same position as last time
                    if (pathEnd[0] === this.lastPosSawPlayer.x && pathEnd[1] === this.lastPosSawPlayer.y) {
                        this.log('Path still valid, player at end');
                        this.curPathStep += 1;
                        return this.moveToNextAStarPath();
                    // Otherwise we should make a new path to follow
                    } else {
                        this.log('Player moved, getting new path');
                        this.path = this.ai.findPath(this.creature.pos.divideByScalar(16), this.lastPosSawPlayer);
                        // this.log('New path', this.path);
                        this.curPathStep = 1;
                        return this.moveToNextAStarPath();
                    }
                // Otherwise we create a new path to follow
                } else {
                    this.log('We don\'t have a path', {cP: this.creature.pos.divideByScalar(16), lP: this.lastPosSawPlayer});
                    this.path = this.ai.findPath(this.creature.pos.divideByScalar(16), this.lastPosSawPlayer);
                    // this.log('Set path', this.path);
                    this.curPathStep = 1;
                    return this.moveToNextAStarPath();
                }
            }
        // If no player is visible
        } else {
            // If we already have a path to follow, we can continue
            
            if (this.path && this.curPathStep) {
                
                this.curPathStep += 1;
                if (this.path[this.curPathStep]) {
                    this.log('Can\'t see player, continuing on old path');
                    return this.moveToNextAStarPath();
                } else {
                    this.path = null;
                }
            // Otherwise we should just walk randomly
            } else {
                return this.chooseRandomWalkDirection();
            }
        }
    }
    /** Handles the AI for a passive guard type */
    private handlePassiveGuard() {
        if (this.isOutOfGuardRange() && !this.path) {
            this.path = this.ai.findPath(this.creature.pos.divideByScalar(16), this.creature.origin.divideByScalar(16));
            this.curPathStep = 1;
            return this.moveToNextAStarPath();
        } else if (this.path) {
            this.curPathStep += 1;
            return this.moveToNextAStarPath();
        }
        return this.chooseRandomWalkDirection();
    }
    /** Check if the monster has moved too far from origin */
    private isOutOfGuardRange(): boolean {
        const x = Math.abs(this.creature.pos.x - this.creature.origin.x);
        const y = Math.abs(this.creature.pos.y - this.creature.origin.y);

        if (x >= 80 || y >= 80) {
            return true;
        }
        return false;
    }
    /** Checks if the player is within 1 tile range */
    private isPlayerInRange(): boolean {
        const monsterPos = this.creature.pos.divideByScalar(16);
        const x = Math.abs(monsterPos.x - this.lastPosSawPlayer.x);
        const y = Math.abs(monsterPos.y - this.lastPosSawPlayer.y);

        if (x <= 1 && y <= 1) {
            return true;
        }
        return false;
    }
    /** Move the monster to the next step on the A* path */
    private moveToNextAStarPath(): boolean {
        if (this.path && this.path.length > 0 && this.path[this.curPathStep]) {
            const x = this.path[this.curPathStep][0] * 16;
            const y = this.path[this.curPathStep][1] * 16;
            const nextCell = new Vector2D(x, y);
            if (this.isNextCellFree(nextCell)) {
                this.nextAction = {
                    name: this.creature.name,
                    type: ActionType.walk,
                    update: {
                        newX: x,
                        newY: y,
                    }
                };
                this.creature.pos.x = x;
                this.creature.pos.y = y;
                return true;
            }
            this.log('Next cell is occupied');
            this.path = null;
            return true;
        }
        this.log('Path not valid or reached the end, nulling');
        this.path = null;
        return false;
    }
    /** Check if a player is around to chase */
    private checkForPlayer() {
        const player = this.getClosestSeenPlayer();
        if (player) {
            this.targetPlayer = player;
            this.lastPosSawPlayer = player.pos.divideByScalar(16);
            this.log('Found a player to follow: ', this.lastPosSawPlayer);
            return true;
        }
        // logger.info('Can\'t see any player');
        return false;
    }
    /**
     * Choose a random direction to walk in
     * @returns True if a direction is found and the cell is free, False otherwise
     */
    private chooseRandomWalkDirection(): boolean {
        const d: number = randomRangeInt(0, 7);
        const dir = Directions[d];
        const nextCellCoords = new Vector2D(this.creature.pos.x + dir.change.x, this.creature.pos.y + dir.change.y);
        if (this.isNextCellFree(nextCellCoords)) {
            this.nextAction = {
                name: this.creature.name,
                type: ActionType.walk,
                update: {
                    newX: nextCellCoords.x,
                    newY: nextCellCoords.y,
                }
            };
            this.creature.pos.x = nextCellCoords.x;
            this.creature.pos.y = nextCellCoords.y;
            return true;
        } else {
            // might do something here like go back and look for another direction, but currently handled by the monster skipping a turn essentially
        }
        return false;
    }
    /**
     * Checks if the cell is empty
     * @param nextCoords The coords of the cell
     */
    private isNextCellFree(nextCoords: Vector2D): boolean {
        const nextCellLayer2Sprite = this.ai.room.map.layers[1].data[(nextCoords.x/16) + (nextCoords.y/16) * this.ai.room.map.width];
        // console.log('Next cell sprite:', nextCellLayer2Sprite);
        if (this.ai.aim.spriteHelper.isSolid(nextCellLayer2Sprite)) {
            return false;
        }
        if (this.ai.isCellOccupied(nextCoords)) {
            return false;
        }
        return true;
    }
    /** Attack the player */
    private attackPlayer() {
        
        const atkService = new AttackService(this.creature, this.targetPlayer);

        if (atkService.checkAttackHit(true)) {
            if (!atkService.checkAttackBlocked()) {
                if (!atkService.checkAttackParried(true)) {
                    const dmg = atkService.performHit(true);
                }
            }
        }

        const result = atkService.getResults();

        const update: SocketActionUpdate = {
            name: this.creature.name,
            type: ActionType.attack,
            update: result,
        };
        this.ai.aim.gm.socketManager.smm.sendAIUpdate(this.ai.room.name, update);

        if (this.targetPlayer.stats.blood === 0) {
            this.targetPlayer.killAndRespawn();
        }
    }
}
