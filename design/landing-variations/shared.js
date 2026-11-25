// Shared, illustrative rate model for the landing mockups.
// Values are placeholders shaped like Calgary ParkPlus rules, not live data.
window.YYC = (function () {
  function calgaryNow() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Edmonton',
      weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const wd = get('weekday').replace('.', '');
    return { day: days[wd] ?? 1, hour: Number(get('hour')) % 24, minute: Number(get('minute')) };
  }

  function fmtTime(h, m) {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return m ? `${hh}:${String(m).padStart(2, '0')} ${suffix}` : `${hh} ${suffix}`;
  }

  // Paid 9–18 Mon–Sat; Saturday cheaper; Sunday free.
  function zoneStatus(baseRate, now = calgaryNow()) {
    const t = now.hour + now.minute / 60;
    const paidDay = now.day >= 1 && now.day <= 6;
    if (paidDay && t >= 9 && t < 18) {
      const rate = now.day === 6 ? Math.max(1.5, baseRate * 0.5) : baseRate;
      return { free: false, rate, until: '6 PM' };
    }
    let next = 'tomorrow at 9 AM';
    if (paidDay && t < 9) next = '9 AM';
    if (now.day === 6 && t >= 18) next = 'Monday at 9 AM';
    if (now.day === 0) next = 'Monday at 9 AM';
    return { free: true, rate: 0, until: next };
  }

  // Rush-hour no-stopping windows, weekdays.
  const TOW_WINDOWS = [
    { start: 7, end: 9, label: '7–9 AM' },
    { start: 15.5, end: 18, label: '3:30–6 PM' },
  ];

  function nextTow(now = calgaryNow()) {
    const t = now.hour + now.minute / 60;
    const weekday = now.day >= 1 && now.day <= 5;
    if (weekday) {
      for (const w of TOW_WINDOWS) {
        if (t >= w.start && t < w.end) return { active: true, minutes: Math.round((w.end - t) * 60), window: w };
        if (t < w.start) return { active: false, minutes: Math.round((w.start - t) * 60), window: w };
      }
    }
    // Next weekday morning
    let daysAhead = 1;
    let d = (now.day + 1) % 7;
    while (d === 0 || d === 6) { d = (d + 1) % 7; daysAhead++; }
    const minutes = Math.round((24 * daysAhead - t + 7) * 60);
    return { active: false, minutes, window: TOW_WINDOWS[0], when: daysAhead === 1 ? 'tomorrow' : 'on ' + ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d] };
  }

  return { calgaryNow, fmtTime, zoneStatus, nextTow, TOW_WINDOWS };
})();
