export function nightPeriod(date = new Date()) {
  if (date.getHours() >= 6 && date.getHours() < 18) return null;
  const evening = new Date(date);
  if (date.getHours() < 6) evening.setDate(evening.getDate() - 1);
  return evening.getFullYear() + '-' + (evening.getMonth()+1) + '-' + evening.getDate();
}
