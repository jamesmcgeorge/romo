import * as ex from 'excalibur';
import { Creature } from './creature';
import { InputService } from '../services/input.service';
import { GMService } from '../services/gm.service';



interface ISeenTiles {
    [key: string]: string;
}


export class Player extends Creature {
    public currentMapName: string;
    public seenTiles: ISeenTiles;
    public gmService: GMService;
    public inputService: InputService;

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
    private processInput(engine: ex.Engine, delta: number) {
        // console.log('Key pressed')
        const action = this.inputService.getKeyboardInputAction(engine);
        if (action) {
            this.lastActionTime = 0;
            this.setNextAction(action);
        }
    }
    public setSocket(socket: SocketIOClient.Socket) {
        super.setSocket(socket);
    }
    public getSocket() {
        return super.getSocket();
    }
}
