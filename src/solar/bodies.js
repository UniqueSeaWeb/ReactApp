// 太陽系の天体データ。
// 表示用の大きさ・距離は見やすさのために圧縮している（実際の比率ではない）。
// 数値は NASA Planetary Fact Sheet の値を丸めたもの。

const displayRadius = (diameterKm) => 0.35 + 0.18 * Math.sqrt(diameterKm / 1000)
const displayDistance = (au) => 8 + 9 * Math.sqrt(au)

export const SUN = {
  id: 'sun',
  name: '太陽',
  nameEn: 'Sun',
  kind: '恒星',
  radius: 4,
  color: '#ffb547',
  facts: [
    ['直径', '約 139 万 km'],
    ['自転周期', '約 25 日（赤道付近）'],
    ['表面温度', '約 5,500 ℃'],
  ],
  description: '太陽系の質量の約 99.8% を占める恒星。中心部の核融合で生まれたエネルギーが、光と熱として惑星に届いています。',
}

const RAW_PLANETS = [
  {
    id: 'mercury',
    name: '水星',
    nameEn: 'Mercury',
    kind: '岩石惑星',
    diameterKm: 4879,
    au: 0.39,
    periodDays: 88,
    tiltDeg: 0,
    texture: { type: 'rocky', colors: ['#8f8b86', '#a9a5a0', '#6f6b67'] },
    facts: [
      ['自転周期', '約 58.6 日'],
      ['公転周期', '約 88 日'],
    ],
    description: '太陽に最も近く、最も小さな惑星。大気がほとんどないため、昼と夜の温度差がとても大きくなります。',
  },
  {
    id: 'venus',
    name: '金星',
    nameEn: 'Venus',
    kind: '岩石惑星',
    diameterKm: 12104,
    au: 0.72,
    periodDays: 225,
    tiltDeg: 177,
    texture: { type: 'banded', colors: ['#e6c98f', '#d4ae6d', '#efd9a8'] },
    facts: [
      ['自転周期', '約 243 日（逆向き）'],
      ['公転周期', '約 225 日'],
    ],
    description: '厚い二酸化炭素の大気による温室効果で、表面温度は約 460 ℃。太陽系の惑星で最も高温です。',
  },
  {
    id: 'earth',
    name: '地球',
    nameEn: 'Earth',
    kind: '岩石惑星',
    diameterKm: 12742,
    au: 1,
    periodDays: 365.25,
    tiltDeg: 23.4,
    texture: { type: 'earth', colors: ['#2f6fbf', '#4f8f4a', '#f4f6f8'] },
    facts: [
      ['自転周期', '約 23.9 時間'],
      ['公転周期', '約 365 日'],
    ],
    description: '表面に液体の水があり、生命が確認されている唯一の天体。月を 1 つ持っています。',
  },
  {
    id: 'mars',
    name: '火星',
    nameEn: 'Mars',
    kind: '岩石惑星',
    diameterKm: 6779,
    au: 1.52,
    periodDays: 687,
    tiltDeg: 25.2,
    texture: { type: 'rocky', colors: ['#c1532f', '#d9764a', '#8f3a22'] },
    facts: [
      ['自転周期', '約 24.6 時間'],
      ['公転周期', '約 687 日'],
    ],
    description: '表面の酸化鉄（さび）で赤く見える惑星。太陽系最大の火山、オリンポス山があります。',
  },
  {
    id: 'jupiter',
    name: '木星',
    nameEn: 'Jupiter',
    kind: '巨大ガス惑星',
    diameterKm: 139820,
    au: 5.2,
    periodDays: 4333,
    tiltDeg: 3.1,
    texture: { type: 'banded', colors: ['#d8b48a', '#b07f55', '#efdcc0', '#c99b6d'] },
    facts: [
      ['自転周期', '約 9.9 時間'],
      ['公転周期', '約 11.9 年'],
    ],
    description: '太陽系最大の惑星。縞模様の中に見える大赤斑は、地球がすっぽり入るほど巨大な嵐です。',
  },
  {
    id: 'saturn',
    name: '土星',
    nameEn: 'Saturn',
    kind: '巨大ガス惑星',
    diameterKm: 116460,
    au: 9.58,
    periodDays: 10759,
    tiltDeg: 26.7,
    ring: { inner: 1.35, outer: 2.3, color: '#d9c393' },
    texture: { type: 'banded', colors: ['#e3cf98', '#c9ad6e', '#efe0b6'] },
    facts: [
      ['自転周期', '約 10.7 時間'],
      ['公転周期', '約 29.5 年'],
    ],
    description: '氷や岩のかけらでできた大きな環を持つ惑星。平均密度は水よりも小さいことで知られています。',
  },
  {
    id: 'uranus',
    name: '天王星',
    nameEn: 'Uranus',
    kind: '巨大氷惑星',
    diameterKm: 50724,
    au: 19.2,
    periodDays: 30687,
    tiltDeg: 97.8,
    ring: { inner: 1.6, outer: 1.9, color: '#a9cfd6' },
    texture: { type: 'banded', colors: ['#9fd8e0', '#8cc8d2', '#b5e3e9'] },
    facts: [
      ['自転周期', '約 17.2 時間（逆向き）'],
      ['公転周期', '約 84 年'],
    ],
    description: '自転軸が約 98° も傾いていて、横倒しのような姿勢で太陽のまわりを回っています。',
  },
  {
    id: 'neptune',
    name: '海王星',
    nameEn: 'Neptune',
    kind: '巨大氷惑星',
    diameterKm: 49244,
    au: 30.1,
    periodDays: 60190,
    tiltDeg: 28.3,
    texture: { type: 'banded', colors: ['#4a6fd6', '#3c5cbf', '#6a8ae6'] },
    facts: [
      ['自転周期', '約 16.1 時間'],
      ['公転周期', '約 165 年'],
    ],
    description: '太陽系で最も遠い惑星。秒速 500 m を超える、太陽系で最も強い風が吹いています。',
  },
]

export const PLANETS = RAW_PLANETS.map((planet, index) => ({
  ...planet,
  radius: displayRadius(planet.diameterKm),
  distance: displayDistance(planet.au),
  // 初期位置は重ならないように散らす
  phase: (index * 2.39996) % (Math.PI * 2),
  facts: [
    ['直径', `${planet.diameterKm.toLocaleString('ja-JP')} km`],
    ['太陽からの距離', `${planet.au} au`],
    ...planet.facts,
  ],
}))

export const BODIES = [SUN, ...PLANETS]
