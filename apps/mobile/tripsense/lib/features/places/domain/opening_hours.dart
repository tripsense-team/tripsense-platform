/// Vietnamese weekday labels used by place-service, Monday first.
const _weekdayLabels = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

/// One line of the weekly schedule.
class OpeningDay {
  const OpeningDay(this.day, this.hours);

  final String day;
  final String hours;
}

/// Parses "Thứ Hai: 07:00–22:00; Thứ Ba: ..." into rows (empty on no match).
List<OpeningDay> parseOpeningHours(String? raw) {
  if (raw == null || raw.trim().isEmpty) return const [];
  final days = <OpeningDay>[];
  for (final part in raw.split(';')) {
    final index = part.indexOf(':');
    if (index <= 0) continue;
    final day = part.substring(0, index).trim();
    final hours = part.substring(index + 1).trim();
    if (day.isNotEmpty && hours.isNotEmpty) days.add(OpeningDay(day, hours));
  }
  return days;
}

/// Hours for [now]'s weekday, or null when the text has no entry for it.
String? todayOpeningHours(String? raw, DateTime now) {
  final label = _weekdayLabels[now.weekday - 1].toLowerCase();
  for (final day in parseOpeningHours(raw)) {
    if (day.day.toLowerCase() == label) return day.hours;
  }
  return null;
}
