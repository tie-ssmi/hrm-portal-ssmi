const LAO_DAYS   = ['ວັນອາທິດ','ວັນຈັນ','ວັນອັງຄານ','ວັນພຸດ','ວັນພະຫັດ','ວັນສຸກ','ວັນເສົາ']
const LAO_MONTHS = ['ມັງກອນ (1)','ກຸມພາ (2)','ມີນາ (3)','ເມສາ (4)','ພຶດສະພາ (5)','ມິຖຸນາ (6)','ກໍລະກົດ (7)','ສິງຫາ (8)','ກັນຍາ (9)','ຕຸລາ (10)','ພະຈິກ (11)','ທັນວາ (12)']
const LAO_MONTHS_NUMBER = ['1','2','3','4','5','6','7','8','9','10','11','12']
export function formatDayDateLao(date: Date): string {
  return `${LAO_DAYS[date.getDay()]}, ${date.getDate()} ${LAO_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}
export function formatMonthDateLao(date: Date): string {
  return ` ${date.getDate()} ${LAO_MONTHS[date.getMonth()]} `
}
export function formatDatedayLao(date: Date): string {
  return ` ${date.getDate()} ${LAO_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}
export function formatDateLao(date: Date): string {
  return `${date.getDate()}/${LAO_MONTHS_NUMBER[date.getMonth()]}/${date.getFullYear()}`
}
