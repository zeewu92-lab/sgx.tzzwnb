export const CAL_OPTIONS = [
  { id: 'gregory', label: { 'zh-TW': '西曆（不轉換）', en: 'Gregorian (no conversion)', ja: '西暦（変換なし）', ko: '양력(변환 없음)' } },
  { id: 'chinese', label: { 'zh-TW': '農曆', en: 'Lunar (Chinese)', ja: '旧暦', ko: '음력' } },
  { id: 'islamic', label: { 'zh-TW': '伊斯蘭曆', en: 'Islamic', ja: 'イスラム暦', ko: '이슬람력' } },
  { id: 'hebrew', label: { 'zh-TW': '希伯來曆', en: 'Hebrew', ja: 'ヘブライ暦', ko: '히브리력' } },
  { id: 'buddhist', label: { 'zh-TW': '佛曆', en: 'Buddhist', ja: '仏暦', ko: '불기' } },
  { id: 'japanese', label: { 'zh-TW': '日本曆', en: 'Japanese', ja: '和暦', ko: '일본력' } },
];

// lat／lng：每個時區代表城市的座標（WGS84，小數度），只用來算日出／日落時間，
// 精度足夠給「城市詳細頁」參考用，不是導航等級的精確座標。
export const COUNTRIES = [
  { id: 'CN', flag: '🇨🇳', name: { 'zh-TW': '中國', en: 'China', ja: '中国', ko: '중국' }, zones: [{ tz: 'Asia/Shanghai', lat: 31.23, lng: 121.47 }] },
  { id: 'JP', flag: '🇯🇵', name: { 'zh-TW': '日本', en: 'Japan', ja: '日本', ko: '일본' }, zones: [{ tz: 'Asia/Tokyo', lat: 35.68, lng: 139.69 }] },
  { id: 'KR', flag: '🇰🇷', name: { 'zh-TW': '韓國', en: 'South Korea', ja: '韓国', ko: '대한민국' }, zones: [{ tz: 'Asia/Seoul', lat: 37.57, lng: 126.98 }] },
  { id: 'SG', flag: '🇸🇬', name: { 'zh-TW': '新加坡', en: 'Singapore', ja: 'シンガポール', ko: '싱가포르' }, zones: [{ tz: 'Asia/Singapore', lat: 1.35, lng: 103.82 }] },
  { id: 'TH', flag: '🇹🇭', name: { 'zh-TW': '泰國', en: 'Thailand', ja: 'タイ', ko: '태국' }, zones: [{ tz: 'Asia/Bangkok', lat: 13.75, lng: 100.50 }] },
  { id: 'MY', flag: '🇲🇾', name: { 'zh-TW': '馬來西亞', en: 'Malaysia', ja: 'マレーシア', ko: '말레이시아' }, zones: [{ tz: 'Asia/Kuala_Lumpur', lat: 3.14, lng: 101.69 }] },
  { id: 'PH', flag: '🇵🇭', name: { 'zh-TW': '菲律賓', en: 'Philippines', ja: 'フィリピン', ko: '필리핀' }, zones: [{ tz: 'Asia/Manila', lat: 14.60, lng: 120.98 }] },
  { id: 'VN', flag: '🇻🇳', name: { 'zh-TW': '越南', en: 'Vietnam', ja: 'ベトナム', ko: '베트남' }, zones: [{ tz: 'Asia/Ho_Chi_Minh', lat: 10.82, lng: 106.63 }] },
  { id: 'AE', flag: '🇦🇪', name: { 'zh-TW': '阿聯', en: 'UAE', ja: 'UAE', ko: 'UAE' }, zones: [{ tz: 'Asia/Dubai', lat: 25.20, lng: 55.27 }] },
  { id: 'IN', flag: '🇮🇳', name: { 'zh-TW': '印度', en: 'India', ja: 'インド', ko: '인도' }, zones: [{ tz: 'Asia/Kolkata', lat: 22.57, lng: 88.36 }] },
  { id: 'ID', flag: '🇮🇩', name: { 'zh-TW': '印尼', en: 'Indonesia', ja: 'インドネシア', ko: '인도네시아' }, zones: [{ tz: 'Asia/Jakarta', lat: -6.21, lng: 106.85 }] },
  { id: 'AU', flag: '🇦🇺', name: { 'zh-TW': '澳洲', en: 'Australia', ja: 'オーストラリア', ko: '호주' }, zones: [{ tz: 'Australia/Sydney', lat: -33.87, lng: 151.21 }] },
  { id: 'NZ', flag: '🇳🇿', name: { 'zh-TW': '紐西蘭', en: 'New Zealand', ja: 'ニュージーランド', ko: '뉴질랜드' }, zones: [{ tz: 'Pacific/Auckland', lat: -36.85, lng: 174.76 }] },
  { id: 'GB', flag: '🇬🇧', name: { 'zh-TW': '英國', en: 'United Kingdom', ja: 'イギリス', ko: '영국' }, zones: [{ tz: 'Europe/London', lat: 51.51, lng: -0.13 }] },
  { id: 'FR', flag: '🇫🇷', name: { 'zh-TW': '法國', en: 'France', ja: 'フランス', ko: '프랑스' }, zones: [{ tz: 'Europe/Paris', lat: 48.85, lng: 2.35 }] },
  { id: 'DE', flag: '🇩🇪', name: { 'zh-TW': '德國', en: 'Germany', ja: 'ドイツ', ko: '독일' }, zones: [{ tz: 'Europe/Berlin', lat: 52.52, lng: 13.40 }] },
  { id: 'IT', flag: '🇮🇹', name: { 'zh-TW': '義大利', en: 'Italy', ja: 'イタリア', ko: '이탈리아' }, zones: [{ tz: 'Europe/Rome', lat: 41.90, lng: 12.50 }] },
  { id: 'ES', flag: '🇪🇸', name: { 'zh-TW': '西班牙', en: 'Spain', ja: 'スペイン', ko: '스페인' }, zones: [{ tz: 'Europe/Madrid', lat: 40.42, lng: -3.70 }] },
  { id: 'RU', flag: '🇷🇺', name: { 'zh-TW': '俄羅斯', en: 'Russia', ja: 'ロシア', ko: '러시아' }, zones: [{ tz: 'Europe/Moscow', lat: 55.75, lng: 37.62 }] },
  { id: 'EG', flag: '🇪🇬', name: { 'zh-TW': '埃及', en: 'Egypt', ja: 'エジプト', ko: '이집트' }, zones: [{ tz: 'Africa/Cairo', lat: 30.04, lng: 31.24 }] },
  { id: 'ZA', flag: '🇿🇦', name: { 'zh-TW': '南非', en: 'South Africa', ja: '南アフリカ', ko: '남아프리카공화국' }, zones: [{ tz: 'Africa/Johannesburg', lat: -26.20, lng: 28.05 }] },
  {
    id: 'US', flag: '🇺🇸', name: { 'zh-TW': '美國', en: 'United States', ja: 'アメリカ', ko: '미국' },
    zones: [
      { tz: 'America/New_York', lat: 40.71, lng: -74.01, label: { 'zh-TW': '東岸（紐約）', en: 'Eastern (New York)', ja: '東部（ニューヨーク）', ko: '동부(뉴욕)' } },
      { tz: 'America/Chicago', lat: 41.88, lng: -87.63, label: { 'zh-TW': '中部（芝加哥）', en: 'Central (Chicago)', ja: '中部（シカゴ）', ko: '중부(시카고)' } },
      { tz: 'America/Denver', lat: 39.74, lng: -104.99, label: { 'zh-TW': '山區（丹佛）', en: 'Mountain (Denver)', ja: '山岳部（デンバー）', ko: '산악부(덴버)' } },
      { tz: 'America/Los_Angeles', lat: 34.05, lng: -118.24, label: { 'zh-TW': '西岸（洛杉磯）', en: 'Pacific (Los Angeles)', ja: '西部（ロサンゼルス）', ko: '서부(로스앤젤레스)' } },
      { tz: 'Pacific/Honolulu', lat: 21.31, lng: -157.86, label: { 'zh-TW': '夏威夷', en: 'Hawaii', ja: 'ハワイ', ko: '하와이' } },
    ],
  },
  { id: 'CA', flag: '🇨🇦', name: { 'zh-TW': '加拿大', en: 'Canada', ja: 'カナダ', ko: '캐나다' }, zones: [{ tz: 'America/Toronto', lat: 43.65, lng: -79.38 }] },
  { id: 'MX', flag: '🇲🇽', name: { 'zh-TW': '墨西哥', en: 'Mexico', ja: 'メキシコ', ko: '멕시코' }, zones: [{ tz: 'America/Mexico_City', lat: 19.43, lng: -99.13 }] },
  { id: 'BR', flag: '🇧🇷', name: { 'zh-TW': '巴西', en: 'Brazil', ja: 'ブラジル', ko: '브라질' }, zones: [{ tz: 'America/Sao_Paulo', lat: -23.55, lng: -46.63 }] },
];
