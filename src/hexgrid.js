export const TERRAIN_TYPES = {
    SPACE: { id: 'space', name: 'Космос', color: '#050510' }, // Черно-синий
    ASTEROID: { id: 'asteroid', name: 'Астероид', color: '#2d1c18' }
};

export class Hex {
    constructor(q, r, terrain) {
        this.q = q; this.r = r; this.col = q;
        this.terrain = terrain; this.unitId = null;
    }
}

export class HexMap {
    constructor(width = 13, height = 13, hexSize = 35) {
        this.width = width; this.height = height; this.hexSize = hexSize;
        this.grid = new Map();
        this.generateMap();
    }

    generateMap() {
        this.grid.clear();
        for (let col = 0; col < this.width; col++) {
            for (let row = 0; row < this.height; row++) {
                const q = col;
                const r = row - (col - (col & 1)) / 2;
                
                // По умолчанию космос, с шансом 15% - астероид
                let terrain = Math.random() < 0.15 ? TERRAIN_TYPES.ASTEROID : TERRAIN_TYPES.SPACE;
                
                this.grid.set(`${q},${r}`, new Hex(q, r, terrain));
            }
        }
    }

    getHex(q, r) { return this.grid.get(`${q},${r}`); }
    getAllHexes() { return Array.from(this.grid.values()); }

    getNeighborCoords(q, r, direction) {
        const dirs = [ {q:1,r:0}, {q:0,r:1}, {q:-1,r:1}, {q:-1,r:0}, {q:0,r:-1}, {q:1,r:-1} ];
        const d = dirs[(direction + 6) % 6]; return { q: q + d.q, r: r + d.r };
    }

    getNeighborDirectionIndex(q1, r1, q2, r2) {
        const dq = q2 - q1; const dr = r2 - r1;
        const dirs = [ {q:1,r:0}, {q:0,r:1}, {q:-1,r:1}, {q:-1,r:0}, {q:0,r:-1}, {q:1,r:-1} ];
        for (let i = 0; i < 6; i++) { if (dirs[i].q === dq && dirs[i].r === dr) return i; }
        return -1;
    }

    hexToPixel(q, r) {
        const x = this.hexSize * (3 / 2 * q);
        const y = this.hexSize * Math.sqrt(3) * (r + q / 2);
        return { x, y };
    }

    pixelToHex(x, y) {
        const q = (2 / 3 * x) / this.hexSize;
        const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / this.hexSize;
        return this.cubeRound(q, r, -q - r);
    }

    cubeRound(q, r, s) {
        let rq = Math.round(q); let rr = Math.round(r); let rs = Math.round(s);
        const q_diff = Math.abs(rq - q); const r_diff = Math.abs(rr - r); const s_diff = Math.abs(rs - s);
        if (q_diff > r_diff && q_diff > s_diff) rq = -rr - rs;
        else if (r_diff > s_diff) rr = -rq - rs;
        return { q: rq, r: rr };
    }
}