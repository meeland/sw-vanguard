// src/Unit.js

export class Unit {
    constructor(id, type, owner, baseStats, q, r) {
        this.id = id;
        this.type = type;
        this.owner = owner;
        
        this.baseStats = { ...baseStats };
        
        this.currentHp = this.baseStats.hp;
        this.morale = this.baseStats.morale;
        
        this.q = q;
        this.r = r;
        this.orientation = 0; 

        this.actionsLeft = 2;
        this.actionsTaken = {
            move: false,
            attack: false,
            turn: false,
            ability: false
        };
    }

    calculateCurrentStats(currentHexTerrain) {
        let speed = this.baseStats.speed;
        let range = this.baseStats.range;

        // 1. Логика Болота (приоритет: скорость падает до 1)
        if (currentHexTerrain.name === 'Болото') {
            speed = 1;
        } else {
            // 2. Логика Леса (скорость -2, но не меньше 1)
            if (currentHexTerrain.name === 'Лес') {
                speed = Math.max(1, speed - 2);
                range = Math.max(1, range - 2);
            }
            // 3. Логика Дороги (бонус к скорости)
            if (currentHexTerrain.name === 'Дорога') {
                if (this.type === 'infantry' || this.type === 'spearman' || this.type === 'archer') {
                    speed += 1;
                } else if (this.type.includes('cavalry')) {
                    speed += 2;
                }
            }
            // 4. Логика Поселения
            if (currentHexTerrain.name === 'Поселение') {
                if (this.type.includes('cavalry')) speed = Math.max(1, speed - 2);
                else speed = Math.max(1, speed - 1);
            }
        }

        // 5. Логика Холма (бонус к дальности)
        if (currentHexTerrain.name === 'Холм' && (this.type === 'archer' || this.type === 'horse_archer')) {
            range += 1;
        }

        return { speed, range };
    }

    canPerformAction(actionType) {
        if (this.actionsLeft <= 0) return false;
        if (actionType === 'turn_left' || actionType === 'turn_right') {
            return !this.actionsTaken.turn; // Поворот можно делать только 1 раз (любой)
        }
        return !this.actionsTaken[actionType];
    }
    
    consumeAction(actionType) {
        this.actionsLeft--;
        if (actionType === 'turn_left' || actionType === 'turn_right') {
            this.actionsTaken.turn = true;
        } else {
            this.actionsTaken[actionType] = true;
        }
    }
    
    resetTurn() {
        this.actionsLeft = 2;
        this.actionsTaken = { move: false, attack: false, turn: false, ability: false };
    }
}