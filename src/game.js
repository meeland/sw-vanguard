// src/Game.js
import { HexMap, TERRAIN_TYPES } from './HexGrid.js';
import { Unit } from './Unit.js';

export class Game {
    constructor(renderer, network) {
        this.renderer = renderer;
        this.network = network;
        this.map = new HexMap(25, 25);
        this.units = [];
        this.turnQueue = []; // Очередь юнитов
        this.currentUnitIndex = 0;
        this.phase = 'LOBBY'; // LOBBY, SELECTION, PLACEMENT, BATTLE, STATS
        
        this.localPlayerId = null;
        this.setupNetworkHandlers();
    }

    setupNetworkHandlers() {
        this.network.onData = (data) => {
            if (data.type === 'MOVE') this.executeMove(data.unitId, data.path);
            if (data.type === 'ATTACK') this.executeAttack(data.attackerId, data.targetId);
            if (data.type === 'END_TURN') this.nextTurn();
            // ... другие события синхронизации
        };
    }

    startGame() {
        this.phase = 'SELECTION';
        // Показать UI выбора войск
    }

    // Генерация очереди ходов
    generateInitiativeQueue() {
        // Сортировка: Скорость -> Кавалерия -> Рандом
        this.units.sort((a, b) => {
            if (b.baseSpeed !== a.baseSpeed) return b.baseSpeed - a.baseSpeed;
            
            const isACav = a.type.includes('cavalry');
            const isBCav = b.type.includes('cavalry');
            if (isACav && !isBCav) return -1;
            if (!isACav && isBCav) return 1;
            
            return Math.random() - 0.5; // Случайно, если все равно (нужен seed для синхронизации!)
        });
        this.turnQueue = [...this.units];
    }

    // Проверка провоцированной атаки (Opportunity Attack)
    checkOpportunityAttack(movingUnit, path) {
        // Проходим по пути. Если соседний гекс занят врагом и movingUnit входит в его зону атаки:
        // Враг атакует мгновенно.
        // movingUnit получает урон.
        // У врага отнимается действие атаки в ЕГО следующем ходу.
    }

    endUnitTurn() {
        this.currentUnitIndex++;
        if (this.currentUnitIndex >= this.turnQueue.length) {
            // Новый раунд
            this.currentUnitIndex = 0;
            this.generateInitiativeQueue(); // Пересчет инициативы (если скорость меняется)
        }
        this.startUnitTurn(this.turnQueue[this.currentUnitIndex]);
    }
}
