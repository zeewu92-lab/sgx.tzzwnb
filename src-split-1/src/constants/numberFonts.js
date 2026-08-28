export const NUMBER_FONTS = [
  { id: 'inter', name: '系統圓體', family: "'Inter', sans-serif", googleFont: 'Inter:wght@900', copyright: '© 2020 The Inter Project Authors' },
  { id: 'orbitron', name: '數位科技', family: "'Orbitron', sans-serif", googleFont: 'Orbitron:wght@700', copyright: '© 2018 The Orbitron Project Authors' },
  { id: 'playfair', name: '經典襯線', family: "'Playfair Display', serif", googleFont: 'Playfair+Display:wght@700', copyright: '© 2017 The Playfair Display Project Authors' },
  { id: 'monoton', name: '純調線條', family: "'Monoton', sans-serif", googleFont: 'Monoton', copyright: '© 2011 Vernon Adams' },
  // Nabla 是可變字體，不支援一般的 wght 軸，改用它自己的 EDPT（立體深度）／EHLT（高光）軸，
  // 所以額外多帶一個 variationSettings 欄位，渲染時要一併套用，只給 font-family 是看不出立體效果的。
  { id: 'nabla', name: '立體霓虹', family: "'Nabla', system-ui", googleFont: 'Nabla', variationSettings: '"EDPT" 100, "EHLT" 12', copyright: '© 2022 The Nabla Project Authors' },
  { id: 'foldit', name: '灰色摺紙', family: "'Foldit', sans-serif", googleFont: 'Foldit:wght@700', copyright: '© 2021–2022 The Foldit Font Project Authors' },
  { id: 'bungee-shade', name: '彈跳陰影', family: "'Bungee Shade', sans-serif", googleFont: 'Bungee+Shade', copyright: '© 2008 The Bungee Project Authors' },
];

export function getNumberFontFamily(fontId) {
  const found = NUMBER_FONTS.find(f => f.id === fontId);
  return found ? found.family : NUMBER_FONTS[0].family;
}

export function getNumberFontVariation(fontId) {
  const found = NUMBER_FONTS.find(f => f.id === fontId);
  return (found && found.variationSettings) || 'normal';
}

export const SIL_OFL_1_1_TEXT = `SIL OPEN FONT LICENSE
Version 1.1 - 26 February 2007

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply to any
document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components
as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to
a new environment.

"Author" refers to any designer, engineer, programmer, technical writer
or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining a
copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in
Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or in
the appropriate machine-readable metadata fields within text or binary
files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the
corresponding Copyright Holder. This restriction only applies to the
primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole, must
be distributed entirely under this license, and must not be distributed
under any other license. The requirement for fonts to remain under
this license does not apply to any document created using the Font
Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.`;

export const BIG_NUMBER_FONT_SIZES = { 1: 130, 2: 116, 3: 100, 4: 84, 5: 70 };

export function getBigNumberFontSize(digitCount) {
  return BIG_NUMBER_FONT_SIZES[digitCount] || BIG_NUMBER_FONT_SIZES[5];
}

export const _loadedFontLinks = new Set();

export function ensureGoogleFontLoaded(googleFont) {
  if (!googleFont || _loadedFontLinks.has(googleFont) || typeof document === 'undefined') return;
  _loadedFontLinks.add(googleFont);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${googleFont}&display=swap`;
  document.head.appendChild(link);
}
