/* =========================================================
   Dear, My Love — Beijing date utilities
   All calendar decisions use Asia/Shanghai explicitly.
   No browser-local date construction is used for calendar math.
   ========================================================= */
(function (global) {
  "use strict";

  const TIME_ZONE = "Asia/Shanghai";
  const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  function asDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid Date");
    return date;
  }

  function zonedParts(value = new Date()) {
    const date = asDate(value);
    const values = {};
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== "literal") values[part.type] = part.value;
    }
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
      weekday: values.weekday ?? null
    };
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function makeIso(year, month, day) {
    return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
  }

  function todayIso(value = new Date()) {
    const parts = zonedParts(value);
    return makeIso(parts.year, parts.month, parts.day);
  }

  function timeParts(value = new Date()) {
    return zonedParts(value);
  }

  function formatTime(value = new Date(), withSeconds = false) {
    const parts = zonedParts(value);
    return withSeconds
      ? `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
      : `${pad(parts.hour)}:${pad(parts.minute)}`;
  }

  function parseIso(iso) {
    if (typeof iso !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return null;
    return { iso, year, month, day };
  }

  function calendarDaysBetween(fromIso, toIso) {
    const from = parseIso(fromIso);
    const to = parseIso(toIso);
    if (!from || !to) return null;
    const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
    const toUtc = Date.UTC(to.year, to.month - 1, to.day);
    return Math.round((toUtc - fromUtc) / DAY_MS);
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysTogether(iso, now = new Date()) {
    const today = todayIso(now);
    const days = calendarDaysBetween(iso, today);
    return days === null ? null : days + 1;
  }

  function formatIso(iso, style = "cn") {
    const value = parseIso(iso);
    if (!value) return "";
    if (style === "dot") return `${value.year}.${pad(value.month)}.${pad(value.day)}`;
    if (style === "short") return `${pad(value.month)}.${pad(value.day)}`;
    if (style === "monthDay") return `${value.month} 月 ${value.day} 日`;
    return `${value.year} 年 ${value.month} 月 ${value.day} 日`;
  }

  function resolveAnnualDate(original, year, leapDayPolicy) {
    if (original.month === 2 && original.day === 29 && !isLeapYear(year)) {
      if (leapDayPolicy === "feb28") return { month: 2, day: 28, policy: "feb28" };
      if (leapDayPolicy === "mar1") return { month: 3, day: 1, policy: "mar1" };
      return { needsPolicy: true };
    }
    return { month: original.month, day: original.day, policy: null };
  }

  /**
   * Find the next yearly occurrence of a calendar date.
   * A Feb-29 date never silently maps to Feb-28 or Mar-1: without an explicit
   * leapDayPolicy the result is marked needsPolicy.
   */
  function nextAnnual(iso, options = {}) {
    const original = parseIso(iso);
    if (!original) return null;
    const now = options.now ?? new Date();
    const leapDayPolicy = options.leapDayPolicy ?? null;
    const nowIso = todayIso(now);
    const today = parseIso(nowIso);
    let year = Math.max(today.year, original.year);
    let resolved = resolveAnnualDate(original, year, leapDayPolicy);
    if (resolved.needsPolicy) {
      return {
        iso,
        targetIso: null,
        target: null,
        year,
        days: null,
        isToday: false,
        needsPolicy: true,
        policy: null,
        reason: "2 月 29 日在非闰年需要先确认按 2 月 28 日还是 3 月 1 日处理。"
      };
    }
    let targetIso = makeIso(year, resolved.month, resolved.day);
    if (targetIso < nowIso) {
      year += 1;
      resolved = resolveAnnualDate(original, year, leapDayPolicy);
      if (resolved.needsPolicy) {
        return {
          iso,
          targetIso: null,
          target: null,
          year,
          days: null,
          isToday: false,
          needsPolicy: true,
          policy: null,
          reason: "2 月 29 日在非闰年需要先确认按 2 月 28 日还是 3 月 1 日处理。"
        };
      }
      targetIso = makeIso(year, resolved.month, resolved.day);
    }
    const target = parseIso(targetIso);
    return {
      iso,
      targetIso,
      target,
      year,
      days: calendarDaysBetween(nowIso, targetIso),
      isToday: targetIso === nowIso,
      needsPolicy: false,
      policy: resolved.policy
    };
  }

  function nextBirthday(iso, options = {}) {
    return nextAnnual(iso, options);
  }

  function nextAnniversary(iso, options = {}) {
    return nextAnnual(iso, options);
  }

  /** Unix timestamp of 00:00:00 Asia/Shanghai for a calendar date. */
  function beijingMidnightUnix(iso) {
    const value = parseIso(iso);
    if (!value) return null;
    return Date.UTC(value.year, value.month - 1, value.day) - SHANGHAI_OFFSET_MS;
  }

  function remainingUntil(targetIso, now = new Date()) {
    const target = parseIso(targetIso);
    if (!target) return null;
    const nowIso = todayIso(now);
    const isToday = targetIso === nowIso;
    const targetUnix = beijingMidnightUnix(targetIso);
    const rawDiff = targetUnix - asDate(now).getTime();
    const totalSeconds = isToday ? 0 : Math.max(0, Math.floor(rawDiff / 1000));
    return {
      targetIso,
      target,
      isToday,
      totalSeconds,
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  }

  function isAnnualToday(iso, now = new Date(), options = {}) {
    const original = parseIso(iso);
    if (!original) return false;
    const today = parseIso(todayIso(now));
    if (today.year < original.year) return false;
    const policy = options.leapDayPolicy ?? null;
    if (original.month === 2 && original.day === 29) {
      if (today.month === 2 && today.day === 29) return true;
      if (policy === "feb28") return today.month === 2 && today.day === 28;
      if (policy === "mar1") return today.month === 3 && today.day === 1;
      return false;
    }
    return today.month === original.month && today.day === original.day;
  }

  function isAnniversaryToday(iso, now = new Date(), options = {}) {
    return isAnnualToday(iso, now, options);
  }

  function isBirthdayToday(iso, now = new Date(), options = {}) {
    return isAnnualToday(iso, now, options);
  }

  function dayOfYear(iso) {
    const value = parseIso(iso);
    if (!value) return null;
    const start = Date.UTC(value.year, 0, 1);
    const current = Date.UTC(value.year, value.month - 1, value.day);
    return Math.floor((current - start) / DAY_MS) + 1;
  }

  global.DMLDate = {
    TIME_ZONE,
    zonedParts,
    todayIso,
    timeParts,
    formatTime,
    parseIso,
    calendarDaysBetween,
    isLeapYear,
    daysTogether,
    formatIso,
    nextAnnual,
    nextBirthday,
    nextAnniversary,
    beijingMidnightUnix,
    remainingUntil,
    isAnniversaryToday,
    isBirthdayToday,
    dayOfYear
  };
})(window);
