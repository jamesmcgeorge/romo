import * as ex from 'excalibur';
import { Vector } from 'excalibur';

/** Camera strategy to stop the camera moving past the bounds of the current map but keeping the player centered as long as possible */
export class LockCameraToActorWithinTileMapBoundsStrategy implements ex.ICameraStrategy<ex.Actor> {
    constructor(public target: ex.Actor, public mapHeight: number, public mapWidth: number) {}

    public action = (target: ex.Actor, _cam: ex.BaseCamera, _eng: ex.Engine, _delta: number) => {
        const center = new Vector(target.getCenter().x, target.getCenter().y);
        if (center.x < _eng.halfDrawWidth) {
            center.x = _eng.halfDrawWidth;
        }
        if (center.y < _eng.halfDrawHeight) {
                center.y = _eng.halfDrawHeight;
        }
        const maxX = this.mapWidth - _eng.halfDrawWidth;
        if (center.x > maxX) {
            center.x = maxX;
        }
        const maxY = this.mapHeight - _eng.halfDrawHeight;

        if (center.y > maxY) {
            center.y = maxY;
        }
        return center;
    }

 }
