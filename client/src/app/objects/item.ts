import {Material} from './material';

/** Item quality interface */
export interface IQuality {
    name: string;
    index: number;
    /** Effect this quality has on the value of the Item */
    valueMult: number;
}

export enum ItemType {
    armor,
    weapon,
    consumable,
    junk,
    bag,
    ring,
}
/** Interface to send Item data over socket */
export interface ISocketItem {
    /** The material index of the item */
    m: number;
    /** The quality index of the item */
    q: number;
    /** The primary type of item */
    t: number;
    /** The weapon type of the item, if any */
    w?: number;
    /** The armor type of the item, if any */
    a?: number;
    /** The subtype of the item, if any */
    s?: number;
    /** The enhancement of the item, if any (tech or magic) */
    e?: any;
    /** Total bag slots of the item, if any */
    b?: number;
}

export const QualitiesArray: IQuality[] = [
    {name: 'poor', index: 0, valueMult: 0.8},
    {name: 'normal', index: 1, valueMult: 1},
    {name: 'good', index: 2, valueMult: 1.1},
    {name: 'rubbish', index: 3, valueMult: 0.6},
    {name: 'great', index: 4, valueMult: 1.2},
    {name: 'awesome', index: 5, valueMult: 1.3},
];

export class Item {
    public weight: number;
    public value: number;

    constructor(public type: ItemType, public subType: number, public material: Material, protected baseWeight: number, protected baseValue: number, public quality: IQuality, public techMagic?: any) {
        this.calculateWeight();
        this.caclculateValue();
        if (techMagic) {
            // do something about the enhancement? do all items need this? Maybe only weapons?
        }
    }
    /** Gets the description for the item to display in the inventory screen */
    get description() {
        const str = `
Weight: ${this.weight.toFixed(2)}
Value: ${this.value.toFixed(2)}
Quality: ${this.quality.name}
Material: ${this.material.name}
`;
    return str;
    }
    /** Calculate the weight of the item by it's components */
    private calculateWeight() {
        this.weight = this.baseWeight;
        this.weight *= this.material.weightMult;
        if (this.techMagic) {
            this.weight *= this.techMagic.weightMult;
        }
    }
    /** Calculate the value of the item by it's components */
    private caclculateValue() {
        this.value = this.baseValue;
        this.value *= this.material.valueMult;
        if (this.techMagic) {
            this.weight *= this.techMagic.valueMult;
        }
        this.value = this.value * this.quality.valueMult;
    }
}
