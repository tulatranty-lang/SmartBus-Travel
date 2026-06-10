function normalize(message = '') {
  return String(message)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function detect(message = '') {
  const raw = String(message || '');
  const text = normalize(raw);
  const entities = {};
  let intent = 'inform';

  if (/xin chao|chao|hello|hi\b|ban co the giup gi|can tim duong|smartbus oi/.test(text)) intent = 'greet';
  else if (/tam biet|bye|goodbye|cam on|hen gap lai|minh hieu roi/.test(text)) intent = 'goodbye';
  else if (/bao nhieu|thong ke|tong so|co may/.test(text)) intent = 'ask_stats';
  else if (/review|danh gia|nhan xet|cong dong noi gi|co ai danh gia/.test(text)) intent = 'ask_place_review';
  else if (/1 buoi|mot buoi|nua ngay|1 ngay|mot ngay|2 ngay|hai ngay|3 ngay|ba ngay|cuoi tuan|lich trinh|ke hoach|plan|tiet kiem|nhom ban|gia dinh/.test(text)) intent = 'ask_trip_plan';
  else if (/lay vi tri|dinh vi|vi tri cua toi|toi dang o dau|gps/.test(text)) intent = 'ask_gps_location';
  else if (/an gi|mon ngon|dac san|am thuc|hai san|cao lau|mi quang|bun bo|food/.test(text)) intent = 'ask_food_near_place';
  else if (/gan toi|quanh day|near me/.test(text) && /dia diem|di dau|du lich|cho|choi|check/.test(text)) intent = 'ask_place_near_me';
  else if (/dia diem|du lich|di choi|nen di dau|cho nao dep|mua sam|cho|bien|tam bien|check-in|song ao|tam linh|chua|ly son|ba na|vinh moc|dai noi|hoi an|my son|cu lao cham|tam ky|vinwonders|son tra|ngu hanh son|cau rong|cua tung|sa huynh/.test(text)) intent = 'ask_tourist_place';
  else if (/ben.*gan|gan.*ben|tram.*gan|gan.*tram|diem dung.*gan|nearest stop/.test(text)) intent = 'ask_nearest_stop';
  else if (/bao lau|eta|may phut|khi nao.*den/.test(text)) intent = 'ask_bus_eta';
  else if (/gia|ve|fare/.test(text)) intent = 'ask_fare';
  else if (/gio|lich|chuyen|hoat dong|tan suat/.test(text)) intent = 'ask_schedule';
  else if (/bao cao|su co|ket|tre|dong/.test(text)) intent = 'report_problem';
  else if (/tuyen|den|toi|di|ra|lam sao toi|bang xe bus nao|co tuyen nao qua/.test(text)) intent = 'ask_route';

  const provinceRules = [
    ['QT', /quang tri|dong ha|vinh moc|cua tung|cua viet|la vang|hien luong|khe sanh/],
    ['HUE', /hue|thua thien|dai noi|dong ba|thien mu|khai dinh|tu duc|lang co|a luoi/],
    ['DN', /da nang|danang|ba na|my khe|son tra|ngu hanh|cau rong|cho han|hai van/],
    ['QN_CU', /quang nam|hoi an|chua cau|my son|cu lao cham|tam ky|vinwonders|cau mong|tra que|thanh ha|an bang|cua dai/],
    ['QNG', /quang ngai|ly son|sa ky|sa huynh|son my|thien an|ba to|dung quat|van tuong|tra bong/],
  ];
  const province = provinceRules.find(([, rx]) => rx.test(text));
  if (province) entities.provinceCode = province[0];

  const prefixed = raw.match(/\b(QT|HUE|DN|DNG|QNG|QN)\s*-?\s*(\d{1,2})(?:\s*-?\s*(old|2025|tour))?\b/i);
  if (prefixed) {
    const prefix = prefixed[1].toUpperCase() === 'DNG' ? 'DN' : prefixed[1].toUpperCase();
    const suffix = prefixed[3] ? `-${prefixed[3].toLowerCase()}` : '';
    entities.routeId = `${prefix}-${String(prefixed[2]).padStart(2, '0')}${suffix}`;
  }

  const placeRouteRules = [
    [/hoi an|chua cau|cho hoi an|cua dai|an bang|ha my|tra que|thanh ha/, 'QN-02-2025', 'Hội An'],
    [/cu lao cham/, 'QN-02-2025', 'Cù Lao Chàm'],
    [/my son|duy xuyen|cau mong/, 'QN-06-old', 'Thánh địa Mỹ Sơn'],
    [/tam ky|me viet nam|phu ninh|ky anh/, 'QN-21-2025', 'Tam Kỳ'],
    [/vinwonders|nam hoi an/, 'QN-14-tour', 'VinWonders Nam Hội An'],
    [/dong giang|doi che|cong troi|suoi mo/, 'QN-03-old', 'Đông Giang'],
    [/cua dai|viet han/, 'QN-02-2025', 'Cửa Đại'],
    [/ba na|cau vang|suoi mo/, 'DN-03', 'Bà Nà Hills'],
    [/my khe|cong vien bien dong/, 'DN-05', 'Bãi biển Mỹ Khê'],
    [/cau rong|bao tang cham|san bay.*viet han/, 'DN-06', 'Cầu Rồng'],
    [/cho han|song han/, 'DN-05', 'Chợ Hàn'],
    [/hai van|khu cong nghe cao/, 'DN-14', 'Đèo Hải Vân'],
    [/vinh moc|cua tung|cua viet|con co/, 'QT-03', 'Địa đạo Vịnh Mốc'],
    [/hien luong|ben hai|ho xa|vinh chap/, 'QT-01', 'Cầu Hiền Lương'],
    [/thanh co|la vang|hai lang/, 'QT-02', 'Thành cổ Quảng Trị'],
    [/khe sanh|ta con|lao bao/, 'QT-01', 'Sân bay Tà Cơn'],
    [/dai noi|kinh thanh|dong ba|truong tien/, 'HUE-01', 'Đại Nội Huế'],
    [/thien mu|tu duc|khai dinh|thuy xuan|lang huong/, 'HUE-05', 'Lăng Khải Định'],
    [/thuan an|vinh hien/, 'HUE-03', 'Biển Thuận An'],
    [/lang co|lap an/, 'HUE-10', 'Đầm Lập An - Lăng Cô'],
    [/a luoi/, 'HUE-12', 'A Lưới'],
    [/ly son|sa ky|son my|my khe quang ngai/, 'QNG-03', 'Đảo Lý Sơn'],
    [/sa huynh/, 'QNG-02', 'Sa Huỳnh'],
    [/thien an|song tra/, 'QNG-01', 'Núi Thiên Ấn'],
    [/ba to|ba vi/, 'QNG-04', 'Ba Tơ'],
    [/dung quat|van tuong|doosan/, 'QNG-05', 'Vạn Tường'],
    [/tra bong/, 'QNG-08', 'Trà Bồng'],
  ];
  const mapped = placeRouteRules.find(([rx]) => rx.test(text));
  if (mapped) {
    entities.routeId = entities.routeId || mapped[1];
    entities.placeName = mapped[2];
  }

  if (/my khe|bien|tam bien/.test(text)) entities.placeCategory = 'beach';
  else if (/cho|mua sam|shopping/.test(text)) entities.placeCategory = 'shopping';
  else if (/check-in|song ao/.test(text)) entities.placeCategory = 'checkin';
  else if (/chua|tam linh|ngu hanh/.test(text)) entities.placeCategory = 'spiritual';

  if (!entities.routeId) {
    const m = raw.match(/tuyến\s*(\d{1,2})|t\.?\s*(\d{1,2})/i);
    if (m) {
      const n = String(m[1] || m[2]).padStart(2, '0');
      const prefixByProvince = { QT: 'QT', HUE: 'HUE', DN: 'DN', DNG: 'DN', QNG: 'QNG', QN_CU: 'QN' }[entities.provinceCode];
      entities.routeId = prefixByProvince ? `${prefixByProvince}-${n}` : n;
    }
  }

  if (/nua ngay/.test(text)) entities.timeAvailable = 'nửa ngày';
  if (/1 buoi|mot buoi/.test(text)) entities.timeAvailable = '1 buổi';
  if (/1 ngay|mot ngay/.test(text)) entities.timeAvailable = '1 ngày';
  if (/2 ngay|hai ngay/.test(text)) entities.timeAvailable = '2 ngày';
  if (/3 ngay|ba ngay/.test(text)) entities.timeAvailable = '3 ngày';
  if (/cuoi tuan/.test(text)) entities.timeAvailable = 'cuối tuần';
  if (/tiet kiem|gia re|it tien/.test(text)) entities.budget = 'low';
  if (/gia dinh/.test(text)) entities.travelStyle = 'gia đình';
  if (/nhom ban|ban be/.test(text)) entities.travelStyle = 'nhóm bạn';
  if (/thich bien|bien/.test(text)) entities.travelStyle = entities.travelStyle || 'thích biển';
  if (/lich su|di san/.test(text)) entities.travelStyle = entities.travelStyle || 'thích lịch sử';
  if (/an uong|am thuc/.test(text)) entities.travelStyle = entities.travelStyle || 'thích ăn uống';
  return { intent, entities };
}
module.exports = { detect };
