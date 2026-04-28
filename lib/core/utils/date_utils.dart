int dayOfYear(DateTime date) {
  final firstDay = DateTime(date.year);
  return date.difference(firstDay).inDays + 1;
}
