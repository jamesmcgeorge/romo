import * as ex from 'excalibur';
import { Creature } from './creature';
import { InputService } from '../services/input.service';
import { GMService } from '../services/gm.service';



interface ISeenTiles {
    [key: string]: string;
}


export class Player extends Creature {
    /** The name of the player's current map for easy reference */
    public currentMapName: string;
    /** Which tiles has the player seen, used by the fogService, could be moved into the fogService itself */
    public seenTiles: ISeenTiles;
    /** The GMSservice instance */
    public gmService: GMService;
    /** The InputService instance */
    public inputService: InputService;
    /** Timer to keep track of the last time the player performed an action */
    private lastActionTime: number = 1000;

    public onInitialize(engine: ex.Engine) {
        super.onInitialize(engine);
        console.log('Inventory', this.inventory);
        engine.input.pointers.primary.on('down', (event: ex.Input.PointerEvent) => {
            // maybe do something here?
        });

        engine.input.pointers.primary.on('up', (event: ex.Input.PointerEvent) => {
            this.inputService.processMouseInput(event, engine, this);
        });
    }
    public update(engine: ex.Engine, delta: number) {
        super.update(engine, delta);
        if (this.canSetAction && this.lastActionTime >= 150) {
            this.processInput(engine, delta);
        }
        this.lastActionTime += delta;

    }
    /**
     * Processes input, currently keyboard from here
     * @param engine Excalibur game engine instance
     * @param delta delta time, not currently used
     */
    private processInput(engine: ex.Engine, delta: number) {
        // console.log('Key pressed')
        const action = this.inputService.getKeyboardInputAction(engine);
        if (action) {
            this.lastActionTime = 0;
            this.setNextAction(action);
        }
    }
    /**
     * Sets the players socket
     * @param socket socket to set
     */
    public setSocket(socket: SocketIOClient.Socket) {
        super.setSocket(socket);
    }
    /**
     * Gets the socket assigned to the player
     */
    public getSocket() {
        return super.getSocket();
    }
}
