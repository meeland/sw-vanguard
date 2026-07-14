export const UPGRADES = {
    'artillery_traditions': { 
        type: 'tradition',
        id: 'artillery_traditions', 
        name: 'Артиллерийские традиции', 
        desc: 'Все орудия всех кораблей получают +10% к урону.', 
        icon: 'assets/upgrades/artillerytraditions.png' 
    },
    'sniper_training': { 
        type: 'tradition',
        id: 'sniper_training', 
        name: 'Снайперские упражнения', 
        desc: 'Увеличивает дальность стрельбы всех орудий на 1 гекс.', 
        icon: 'assets/upgrades/snipertraining.png' 
    },
    'defense_protocols': { 
        type: 'technology',
        id: 'defense_protocols', 
        name: 'Защитные протоколы', 
        desc: 'Щиты всех кораблей получают +15% к прочности.', 
        icon: 'assets/upgrades/defenceprotocols.png' 
    },
    'force_engines': { 
        type: 'technology',
        id: 'force_engines', 
        name: 'Форсирование движков', 
        desc: 'Все корабли S-тоннажа получают +1 к скорости.', 
        icon: 'assets/upgrades/forceengines.png' 
    }
};

export const WEAPONS = {
    'light_cannon': { icon: 'assets/lightcanon.png', name: 'Лёгкое орудие', desc: 'Скорострельное орудие ближнего боя.', damage: 15, range: 3 },
    'medium_cannon': { icon: 'assets/mediumcanon.png', name: 'Среднее орудие', desc: 'Стандартный калибр.', damage: 30, range: 4 },
    'heavy_cannon': { icon: 'assets/heavycanon.png', name: 'Тяжёлое орудие', desc: 'Главный калибр дредноутов.', damage: 60, range: 6 }
};

export const ABILITIES = {
    'jammer': { type: 'active', icon: 'assets/jammer.png', name: 'Наводчик помех', desc: 'Снижает дальность стрельбы всех орудий цели на 2 гекса на 2 хода.', cooldown: 3, range: 6 },
    'stasis': { type: 'active', icon: 'assets/stasis.png', name: 'Стазис', desc: 'Снижает скорость цели на 2 на 2 хода.', cooldown: 3, range: 3 }
};

export const STATUS_EFFECTS_DICT = {
    'jammed': { name: 'Помехи', icon: 'assets/jammer.png', desc: 'Дальность стрельбы снижена на 2.' },
    'stasis': { name: 'Стазис', icon: 'assets/stasis.png', desc: 'Скорость снижена на 2.' }
};

export const UNIT_STATS = {
    'ship_s': { faction: 'standard', name: 'Истребитель (S)', tonnage: 'S', maxHp: 50, maxShield: 30, shieldRegen: 10, speed: 5, img: 'assets/units/ship_s.png', icon: 'assets/units/icons/ship_s_icon.png', abilities: [], weapons: ['light_cannon', 'light_cannon'] },
    'ship_m': { faction: 'standard', name: 'Корвет (M)', tonnage: 'M', maxHp: 100, maxShield: 80, shieldRegen: 15, speed: 4, img: 'assets/units/ship_m.png', icon: 'assets/units/icons/ship_m_icon.png', abilities: ['jammer'], weapons: ['medium_cannon', 'medium_cannon'] },
    'ship_l': { faction: 'standard', name: 'Крейсер (L)', tonnage: 'L', maxHp: 200, maxShield: 150, shieldRegen: 20, speed: 3, img: 'assets/units/ship_l.png', icon: 'assets/units/icons/ship_l_icon.png', abilities: ['stasis'], weapons: ['light_cannon', 'light_cannon', 'heavy_cannon'] },
    'ship_xl': { faction: 'standard', name: 'Дредноут (XL)', tonnage: 'XL', maxHp: 400, maxShield: 250, shieldRegen: 30, speed: 2, img: 'assets/units/ship_xl.png', icon: 'assets/units/icons/ship_xl_icon.png', abilities: [], weapons: ['light_cannon', 'light_cannon', 'medium_cannon', 'medium_cannon', 'heavy_cannon'] }
};