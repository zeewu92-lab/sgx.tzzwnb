// 城市（時區）經緯度對照表 + 球面投影工具
//
// 這裡只做「城市光點在地球圖片上該畫在哪裡」這件事，跟地球圖片本身完全解耦：
// 圖片只負責「寫實地球長什麼樣子」，光點位置永遠用經緯度即時算出來，
// 所以無論使用者加了哪個城市、時間怎麼變、要不要換一張地球圖，都不用重新對位。
//
// 座標是市中心的概略值（小數點後一兩位），對「畫在地球上的一個光點」來說已經足夠精準。
// 找不到的時區會回傳 null，呼叫端應該跳過該城市（不畫光點，但城市清單仍正常顯示）。
export const TZ_COORDS = {
  // 亞洲
  'Asia/Taipei': [25.03, 121.56],
  'Asia/Tokyo': [35.68, 139.65],
  'Asia/Shanghai': [31.23, 121.47],
  'Asia/Hong_Kong': [22.28, 114.16],
  'Asia/Macau': [22.20, 113.55],
  'Asia/Singapore': [1.35, 103.82],
  'Asia/Seoul': [37.57, 126.98],
  'Asia/Bangkok': [13.75, 100.50],
  'Asia/Jakarta': [-6.21, 106.85],
  'Asia/Manila': [14.60, 120.98],
  'Asia/Kolkata': [28.61, 77.21],
  'Asia/Calcutta': [28.61, 77.21],
  'Asia/Dubai': [25.20, 55.27],
  'Asia/Karachi': [24.86, 67.01],
  'Asia/Dhaka': [23.81, 90.41],
  'Asia/Kuala_Lumpur': [3.14, 101.69],
  'Asia/Ho_Chi_Minh': [10.82, 106.63],
  'Asia/Yangon': [16.87, 96.20],
  'Asia/Ulaanbaatar': [47.92, 106.92],
  'Asia/Tel_Aviv': [32.08, 34.78],
  'Asia/Jerusalem': [31.78, 35.22],
  'Asia/Riyadh': [24.71, 46.68],
  'Asia/Almaty': [43.24, 76.93],
  // 大洋洲
  'Australia/Sydney': [-33.87, 151.21],
  'Australia/Melbourne': [-37.81, 144.96],
  'Australia/Brisbane': [-27.47, 153.03],
  'Australia/Perth': [-31.95, 115.86],
  'Australia/Adelaide': [-34.93, 138.60],
  'Pacific/Auckland': [-36.85, 174.76],
  'Pacific/Guam': [13.44, 144.79],
  'Pacific/Honolulu': [21.31, -157.86],
  'Pacific/Fiji': [-18.14, 178.44],
  // 歐洲
  'Europe/London': [51.51, -0.13],
  'Europe/Dublin': [53.35, -6.26],
  'Europe/Paris': [48.85, 2.35],
  'Europe/Berlin': [52.52, 13.40],
  'Europe/Madrid': [40.42, -3.70],
  'Europe/Lisbon': [38.72, -9.14],
  'Europe/Rome': [41.90, 12.50],
  'Europe/Amsterdam': [52.37, 4.90],
  'Europe/Brussels': [50.85, 4.35],
  'Europe/Zurich': [47.37, 8.54],
  'Europe/Vienna': [48.21, 16.37],
  'Europe/Prague': [50.08, 14.44],
  'Europe/Warsaw': [52.23, 21.01],
  'Europe/Stockholm': [59.33, 18.06],
  'Europe/Oslo': [59.91, 10.75],
  'Europe/Copenhagen': [55.68, 12.57],
  'Europe/Helsinki': [60.17, 24.94],
  'Europe/Athens': [37.98, 23.73],
  'Europe/Istanbul': [41.01, 28.98],
  'Europe/Moscow': [55.76, 37.62],
  // 美洲
  'America/New_York': [40.71, -74.01],
  'America/Chicago': [41.88, -87.63],
  'America/Denver': [39.74, -104.99],
  'America/Los_Angeles': [34.05, -118.24],
  'America/Anchorage': [61.22, -149.90],
  'America/Toronto': [43.65, -79.38],
  'America/Vancouver': [49.28, -123.12],
  'America/Mexico_City': [19.43, -99.13],
  'America/Bogota': [4.71, -74.07],
  'America/Lima': [-12.05, -77.04],
  'America/Santiago': [-33.45, -70.65],
  'America/Sao_Paulo': [-23.55, -46.63],
  'America/Argentina/Buenos_Aires': [-34.60, -58.38],
  // 非洲 / 中東
  'Africa/Cairo': [30.04, 31.24],
  'Africa/Johannesburg': [-26.20, 28.05],
  'Africa/Lagos': [6.52, 3.38],
  'Africa/Nairobi': [-1.29, 36.82],
  'Africa/Casablanca': [33.57, -7.59],
  // UTC
  'UTC': [0, 0],
  'Etc/UTC': [0, 0],
};

export function getTzCoords(tz) {
  return TZ_COORDS[tz] || null;
}

// 正射投影（orthographic projection）：把「經緯度」換算成地球圖片上的
// 相對座標（-1 ~ 1），中心點（centerLat, centerLon）對應這張地球素材鏡頭
// 正對著的那個點。cosC < 0 代表落在地球背面，不該畫出來。
export function projectToGlobe(lat, lon, centerLat, centerLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const phi = toRad(lat);
  const phi1 = toRad(centerLat);
  const lambda = toRad(lon);
  const lambda0 = toRad(centerLon);

  const cosC =
    Math.sin(phi1) * Math.sin(phi) +
    Math.cos(phi1) * Math.cos(phi) * Math.cos(lambda - lambda0);

  // 太靠近球體邊緣（接近背面）的光點捨棄不畫，避免看起來貼在地球外面
  if (cosC < 0.08) return null;

  const x = Math.cos(phi) * Math.sin(lambda - lambda0);
  const y =
    Math.cos(phi1) * Math.sin(phi) -
    Math.sin(phi1) * Math.cos(phi) * Math.cos(lambda - lambda0);

  return { x, y, edge: cosC < 0.22 };
}
