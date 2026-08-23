export const NUMBER_FONTS = [
  {
    id: 'inter',
    name: '系統圓體',
    family: "'Inter', sans-serif",
    googleFont: 'Inter:wght@900',
    copyright: '© 2020 The Inter Project Authors',
  },
  {
    id: 'orbitron',
    name: '數位科技',
    family: "'Orbitron', sans-serif",
    googleFont: 'Orbitron:wght@700',
    copyright: '© 2018 The Orbitron Project Authors',
  },
  {
    id: 'playfair',
    name: '經典襯線',
    family: "'Playfair Display', serif",
    googleFont: 'Playfair+Display:wght@700',
    copyright: '© 2017 The Playfair Display Project Authors',
  },
  {
    id: 'monoton',
    name: '純調線條',
    family: "'Monoton', sans-serif",
    googleFont: 'Monoton',
    copyright: '© 2011 Vernon Adams',
  },
  {
    id: 'nabla',
    name: '立體霓虹',
    family: "'Nabla', system-ui",
    googleFont: 'Nabla',
    variationSettings: '"EDPT" 100, "EHLT" 12',
    copyright: '© 2022 The Nabla Project Authors',
  },
  {
    id: 'foldit',
    name: '灰色摺紙',
    family: "'Foldit', sans-serif",
    googleFont: 'Foldit:wght@700',
    copyright: '© 2021–2022 The Foldit Font Project Authors',
  },
  {
    id: 'bungee-shade',
    name: '彈跳陰影',
    family: "'Bungee Shade', sans-serif",
    googleFont: 'Bungee+Shade',
    copyright: '© 2008 The Bungee Project Authors',
  },
];

export function getNumberFontFamily(fontId) {
  const found = NUMBER_FONTS.find(f => f.id === fontId);
  return found ? found.family : NUMBER_FONTS[0].family;
}

export function getNumberFontVariation(fontId) {
  const found = NUMBER_FONTS.find(f => f.id === fontId);
  return (found && found.variationSettings) || 'normal';
}

export const BIG_NUMBER_FONT_SIZES = {
  1: 130,
  2: 116,
  3: 100,
  4: 84,
  5: 70,
};

export function getBigNumberFontSize(digitCount) {
  return BIG_NUMBER_FONT_SIZES[digitCount] || BIG_NUMBER_FONT_SIZES[5];
}
