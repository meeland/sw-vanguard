// src/Renderer.js

export class GameRenderer {
    constructor(canvas, map) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.map = map;
        this.hexSize = 30; // Радиус гекса
        this.camera = { x: 0, y: 0, zoom: 1 };
        
        // Обработчики мыши для зума и панорамирования
        this.setupInput();
    }

    drawHex(x, y, color, isStroke = false) {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30; // -30 для ориентации "угол вверх"
            const angle_rad = Math.PI / 180 * angle_deg;
            const px = x + this.hexSize * Math.cos(angle_rad);
            const py = y + this.hexSize * Math.sin(angle_rad);
            if (i === 0) this.ctx.moveTo(px, py);
            else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        if (!isStroke) this.ctx.fill();
        this.ctx.stroke();
    }

    render(units, activeUnit) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        
        // Применяем камеру
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        // Рендер карты
        this.map.grid.forEach((hex) => {
            const { x, y } = this.hexToPixel(hex.q, hex.r);
            this.drawHex(x, y, hex.terrain.color);
        });

        // Рендер юнитов (упрощенно кружками или картинками)
        units.forEach(unit => {
            const { x, y } = this.hexToPixel(unit.q, unit.r);
            // Отрисовка базы юнита
            this.ctx.fillStyle = unit.owner === 'player' ? 'blue' : 'red';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 15, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Отрисовка ХП бара над юнитом
            this.ctx.fillStyle = 'green';
            this.ctx.fillRect(x - 15, y - 25, 30 * (unit.currentHp / unit.maxHp), 5);
            
            // Отрисовка секторов (Фронт, Фланг, Тыл) для активного юнита
            if (unit === activeUnit) {
               this.drawOrientationMarkers(x, y, unit.orientation);
            }
        });

        this.ctx.restore();
    }

    hexToPixel(q, r) {
        // Конвертация аксиальных координат в пиксели
        const x = this.hexSize * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
        const y = this.hexSize * (3./2 * r);
        return { x, y };
    }
    
    drawOrientationMarkers(x, y, orientation) {
        // Здесь рисуем дуги цветов: зеленый (фронт), желтый (фланг), красный (тыл)
        // Используем orientation (0-5) для поворота canvas context и отрисовки секторов
    }
	
	drawUnitSelection(unit) {
    const { x, y } = this.hexToPixel(unit.q, unit.r);
    
    // Рисуем подсветку секторов
    // Фронт (зеленый) - 2 сектора
    this.drawSector(x, y, unit.orientation, 'rgba(0, 255, 0, 0.3)'); 
    this.drawSector(x, y, (unit.orientation + 1) % 6, 'rgba(0, 255, 0, 0.3)');

    // Фланги (желтый) - 2 сектора
    this.drawSector(x, y, (unit.orientation + 2) % 6, 'rgba(255, 255, 0, 0.3)');
    this.drawSector(x, y, (unit.orientation + 5) % 6, 'rgba(255, 255, 0, 0.3)');

    // Тыл (красный) - 2 сектора
    this.drawSector(x, y, (unit.orientation + 3) % 6, 'rgba(255, 0, 0, 0.3)');
    this.drawSector(x, y, (unit.orientation + 4) % 6, 'rgba(255, 0, 0, 0.3)');
}

	drawSector(cx, cy, directionIndex, color) {
    const radius = this.hexSize;
    const startAngle = (directionIndex * 60 - 30) * Math.PI / 180;
    const endAngle = (directionIndex * 60 + 30) * Math.PI / 180;

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.arc(cx, cy, radius, startAngle, endAngle);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
}
}