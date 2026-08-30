export const CAL_OPTIONS = [
  { id: 'gregory', label: { 'zh-TW': '西曆（不轉換）', en: 'Gregorian (no conversion)', ja: '西暦（変換なし）', ko: '양력(변환 없음)' } },
  { id: 'chinese', label: { 'zh-TW': '農曆', en: 'Lunar (Chinese)', ja: '旧暦', ko: '음력' } },
  { id: 'islamic', label: { 'zh-TW': '伊斯蘭曆', en: 'Islamic', ja: 'イスラム暦', ko: '이슬람력' } },
  { id: 'hebrew', label: { 'zh-TW': '希伯來曆', en: 'Hebrew', ja: 'ヘブライ暦', ko: '히브리력' } },
  { id: 'buddhist', label: { 'zh-TW': '佛曆', en: 'Buddhist', ja: '仏暦', ko: '불기' } },
  { id: 'japanese', label: { 'zh-TW': '日本曆', en: 'Japanese', ja: '和暦', ko: '일본력' } },
];

// lat／lng：每個城市的座標（WGS84，小數度），用來算日出／日落時間，
// 精度足夠給「城市詳細頁」參考用，不是導航等級的精確座標。
// 每一筆代表「一個時區」，用該時區裡最具代表性的城市命名（例如中國統一用北京，不分省市）。
export const CITIES = [
  { id: 'TPE', tz: 'Asia/Taipei', lat: 25.03, lng: 121.56, name: { 'zh-TW': '台北', en: 'Taipei', ja: '台北', ko: '타이베이' }, country: { 'zh-TW': 'Taipei', en: 'Taipei', ja: 'Taipei', ko: 'Taipei' } },
  { id: 'BJS', tz: 'Asia/Shanghai', lat: 39.90, lng: 116.41, name: { 'zh-TW': '北京', en: 'Beijing', ja: '北京', ko: '베이징' }, country: { 'zh-TW': '中國', en: 'China', ja: '中国', ko: '중국' } },
  { id: 'TYO', tz: 'Asia/Tokyo', lat: 35.68, lng: 139.69, name: { 'zh-TW': '東京', en: 'Tokyo', ja: '東京', ko: '도쿄' }, country: { 'zh-TW': '日本', en: 'Japan', ja: '日本', ko: '일본' } },
  { id: 'SEL', tz: 'Asia/Seoul', lat: 37.57, lng: 126.98, name: { 'zh-TW': '首爾', en: 'Seoul', ja: 'ソウル', ko: '서울' }, country: { 'zh-TW': '韓國', en: 'South Korea', ja: '韓国', ko: '대한민국' } },
  { id: 'SIN', tz: 'Asia/Singapore', lat: 1.35, lng: 103.82, name: { 'zh-TW': '新加坡', en: 'Singapore', ja: 'シンガポール', ko: '싱가포르' }, country: { 'zh-TW': '新加坡', en: 'Singapore', ja: 'シンガポール', ko: '싱가포르' } },
  { id: 'BKK', tz: 'Asia/Bangkok', lat: 13.75, lng: 100.50, name: { 'zh-TW': '曼谷', en: 'Bangkok', ja: 'バンコク', ko: '방콕' }, country: { 'zh-TW': '泰國', en: 'Thailand', ja: 'タイ', ko: '태국' } },
  { id: 'KUL', tz: 'Asia/Kuala_Lumpur', lat: 3.14, lng: 101.69, name: { 'zh-TW': '吉隆坡', en: 'Kuala Lumpur', ja: 'クアラルンプール', ko: '쿠알라룸푸르' }, country: { 'zh-TW': '馬來西亞', en: 'Malaysia', ja: 'マレーシア', ko: '말레이시아' } },
  { id: 'MNL', tz: 'Asia/Manila', lat: 14.60, lng: 120.98, name: { 'zh-TW': '馬尼拉', en: 'Manila', ja: 'マニラ', ko: '마닐라' }, country: { 'zh-TW': '菲律賓', en: 'Philippines', ja: 'フィリピン', ko: '필리핀' } },
  { id: 'SGN', tz: 'Asia/Ho_Chi_Minh', lat: 10.82, lng: 106.63, name: { 'zh-TW': '胡志明市', en: 'Ho Chi Minh City', ja: 'ホーチミン', ko: '호찌민' }, country: { 'zh-TW': '越南', en: 'Vietnam', ja: 'ベトナム', ko: '베트남' } },
  { id: 'DXB', tz: 'Asia/Dubai', lat: 25.20, lng: 55.27, name: { 'zh-TW': '杜拜', en: 'Dubai', ja: 'ドバイ', ko: '두바이' }, country: { 'zh-TW': '阿聯', en: 'UAE', ja: 'UAE', ko: 'UAE' } },
  { id: 'DEL', tz: 'Asia/Kolkata', lat: 28.61, lng: 77.21, name: { 'zh-TW': '新德里', en: 'New Delhi', ja: 'ニューデリー', ko: '뉴델리' }, country: { 'zh-TW': '印度', en: 'India', ja: 'インド', ko: '인도' } },
  { id: 'JKT', tz: 'Asia/Jakarta', lat: -6.21, lng: 106.85, name: { 'zh-TW': '雅加達', en: 'Jakarta', ja: 'ジャカルタ', ko: '자카르타' }, country: { 'zh-TW': '印尼', en: 'Indonesia', ja: 'インドネシア', ko: '인도네시아' } },
  { id: 'SYD', tz: 'Australia/Sydney', lat: -33.87, lng: 151.21, name: { 'zh-TW': '雪梨', en: 'Sydney', ja: 'シドニー', ko: '시드니' }, country: { 'zh-TW': '澳洲', en: 'Australia', ja: 'オーストラリア', ko: '호주' } },
  { id: 'AKL', tz: 'Pacific/Auckland', lat: -36.85, lng: 174.76, name: { 'zh-TW': '奧克蘭', en: 'Auckland', ja: 'オークランド', ko: '오클랜드' }, country: { 'zh-TW': '紐西蘭', en: 'New Zealand', ja: 'ニュージーランド', ko: '뉴질랜드' } },
  { id: 'LON', tz: 'Europe/London', lat: 51.51, lng: -0.13, name: { 'zh-TW': '倫敦', en: 'London', ja: 'ロンドン', ko: '런던' }, country: { 'zh-TW': '英國', en: 'United Kingdom', ja: 'イギリス', ko: '영국' } },
  { id: 'PAR', tz: 'Europe/Paris', lat: 48.85, lng: 2.35, name: { 'zh-TW': '巴黎', en: 'Paris', ja: 'パリ', ko: '파리' }, country: { 'zh-TW': '法國', en: 'France', ja: 'フランス', ko: '프랑스' } },
  { id: 'BER', tz: 'Europe/Berlin', lat: 52.52, lng: 13.40, name: { 'zh-TW': '柏林', en: 'Berlin', ja: 'ベルリン', ko: '베를린' }, country: { 'zh-TW': '德國', en: 'Germany', ja: 'ドイツ', ko: '독일' } },
  { id: 'ROM', tz: 'Europe/Rome', lat: 41.90, lng: 12.50, name: { 'zh-TW': '羅馬', en: 'Rome', ja: 'ローマ', ko: '로마' }, country: { 'zh-TW': '義大利', en: 'Italy', ja: 'イタリア', ko: '이탈리아' } },
  { id: 'MAD', tz: 'Europe/Madrid', lat: 40.42, lng: -3.70, name: { 'zh-TW': '馬德里', en: 'Madrid', ja: 'マドリード', ko: '마드리드' }, country: { 'zh-TW': '西班牙', en: 'Spain', ja: 'スペイン', ko: '스페인' } },
  { id: 'MOW', tz: 'Europe/Moscow', lat: 55.75, lng: 37.62, name: { 'zh-TW': '莫斯科', en: 'Moscow', ja: 'モスクワ', ko: '모스크바' }, country: { 'zh-TW': '俄羅斯', en: 'Russia', ja: 'ロシア', ko: '러시아' } },
  { id: 'CAI', tz: 'Africa/Cairo', lat: 30.04, lng: 31.24, name: { 'zh-TW': '開羅', en: 'Cairo', ja: 'カイロ', ko: '카이로' }, country: { 'zh-TW': '埃及', en: 'Egypt', ja: 'エジプト', ko: '이집트' } },
  { id: 'JNB', tz: 'Africa/Johannesburg', lat: -26.20, lng: 28.05, name: { 'zh-TW': '約翰尼斯堡', en: 'Johannesburg', ja: 'ヨハネスブルグ', ko: '요하네스버그' }, country: { 'zh-TW': '南非', en: 'South Africa', ja: '南アフリカ', ko: '남아프리카공화국' } },
  { id: 'NYC', tz: 'America/New_York', lat: 40.71, lng: -74.01, name: { 'zh-TW': '紐約', en: 'New York', ja: 'ニューヨーク', ko: '뉴욕' }, country: { 'zh-TW': '美國', en: 'United States', ja: 'アメリカ', ko: '미국' } },
  { id: 'CHI', tz: 'America/Chicago', lat: 41.88, lng: -87.63, name: { 'zh-TW': '芝加哥', en: 'Chicago', ja: 'シカゴ', ko: '시카고' }, country: { 'zh-TW': '美國', en: 'United States', ja: 'アメリカ', ko: '미국' } },
  { id: 'DEN', tz: 'America/Denver', lat: 39.74, lng: -104.99, name: { 'zh-TW': '丹佛', en: 'Denver', ja: 'デンバー', ko: '덴버' }, country: { 'zh-TW': '美國', en: 'United States', ja: 'アメリカ', ko: '미국' } },
  { id: 'LAX', tz: 'America/Los_Angeles', lat: 34.05, lng: -118.24, name: { 'zh-TW': '洛杉磯', en: 'Los Angeles', ja: 'ロサンゼルス', ko: '로스앤젤레스' }, country: { 'zh-TW': '美國', en: 'United States', ja: 'アメリカ', ko: '미국' } },
  { id: 'HNL', tz: 'Pacific/Honolulu', lat: 21.31, lng: -157.86, name: { 'zh-TW': '檀香山', en: 'Honolulu', ja: 'ホノルル', ko: '호놀룰루' }, country: { 'zh-TW': '美國', en: 'United States', ja: 'アメリカ', ko: '미국' } },
  { id: 'YTO', tz: 'America/Toronto', lat: 43.65, lng: -79.38, name: { 'zh-TW': '多倫多', en: 'Toronto', ja: 'トロント', ko: '토론토' }, country: { 'zh-TW': '加拿大', en: 'Canada', ja: 'カナダ', ko: '캐나다' } },
  { id: 'MEX', tz: 'America/Mexico_City', lat: 19.43, lng: -99.13, name: { 'zh-TW': '墨西哥城', en: 'Mexico City', ja: 'メキシコシティ', ko: '멕시코시티' }, country: { 'zh-TW': '墨西哥', en: 'Mexico', ja: 'メキシコ', ko: '멕시코' } },
  { id: 'SAO', tz: 'America/Sao_Paulo', lat: -23.55, lng: -46.63, name: { 'zh-TW': '聖保羅', en: 'São Paulo', ja: 'サンパウロ', ko: '상파울루' }, country: { 'zh-TW': '巴西', en: 'Brazil', ja: 'ブラジル', ko: '브라질' } },
];
