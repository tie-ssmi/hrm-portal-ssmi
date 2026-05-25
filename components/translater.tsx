const jobTitleMap: Record<string, string> = {
  'headOfDepartment': 'ຫົວໜ້າພະແນກ',
  'deputyHeadOfDepartment': 'ຮອງຫົວໜ້າພະແນກ',
  'technicalStaff': 'ວິຊາການ',
  'housekeeper': 'ແມ່ບ້ານ',
  'security': 'ຮັກສາຄວາມປອດໄພ',
  'manager': 'ຜູ້ຈັດການ',
  'teamLead': 'ຫົວໜ້າໜ່ວຍງາຍ',
  'ActingTeamLead': 'ວ່າການ ຫົວໜ້າໜ່ວຍງາຍ',
  'AssistantDirector': 'ຜູ້ຊ່ວຍ ຜູ້ອຳນວຍການ',
  'ActingAssistantDirector': 'ວ່າການ ຜູ້ຊ່ວຍ ຜູ້ອຳນວຍການ',
  'ExecutiveAssistant': 'ເລຂາ',
  'ActingExecutiveAssistant': 'ວ່າການ ເລຂາ',
    'ActingCEO': 'ວ່າການ ຜູ້ອຳນວຍການ',
  'ActingDCEO': 'ວ່າການ ຮອງຜູ້ອຳນວຍການ',
    'ActingCTO': 'ວ່າການ ຜູ້ອຳນວຍການຝ່າຍເຕັກໂນໂລຊິ',
    'ActingCFO': 'ວ່າການ ຜູ້ອຳນວຍຝ່າຍການເງີນ',
    'ActingCOO': 'ວ່າການ ຜູ້ອຳນວຍການຝ່າຍປະຕິບັດການ',
     'ActingheadOfDepartment': 'ວ່າການ ຫົວໜ້າພະແນກ',
  'ActingdeputyHeadOfDepartment': 'ວ່າການ ຮອງຫົວໜ້າພະແນກ',
  'CEO': 'ຜູ້ອຳນວຍການ',
  'DCEO': 'ຮອງຜູ້ອຳນວຍການ',
    'CTO': 'ຜູ້ອຳນວຍການຝ່າຍເຕັກໂນໂລຊິ',
    'DCTO': 'ຮອງຜູ້ອຳນວຍການຝ່າຍເຕັກໂນໂລຊິ',
    'CFO': 'ຜູ້ອຳນວຍຝ່າຍການເງີນ',
    'DCFO': 'ຮອງຜູ້ອຳນວຍຝ່າຍການເງີນ',
    'COO': 'ຜູ້ອຳນວຍການຝ່າຍປະຕິບັດການ',
    'DCOO': 'ຮອງຜູ້ອຳນວຍການຝ່າຍປະຕິບັດການ',
    'CMO': 'ຜູ້ອຳນວຍການຝ່າຍການຕະຫຼາດ',
    'DCMO': 'ຮອງຜູ້ອຳນວຍການຝ່າຍການຕະຫຼາດ',
    'ActingCMO': 'ວ່າການ ຜູ້ອຳນວຍການຝ່າຍການຕະຫຼາດ',
    'ActingSupervisor': 'ວ່າການ ຫົວໜ້າຈູງານ',
    'Supervisor': 'ຫົວໜ້າຈູງານ',

}

const employeeTypeMap: Record<string, string> = {
  'Full-time': 'ພະນັກງານສົມບູນ',
  'Part-time': 'ພະນັກງານ Part-time',
  'Contract': 'ພະນັກງານສັນຍາຈ້າງ',
  'Intern': 'ພະນັກງານຝືກງານ',
  '95': 'ພະນັກງານ 95',
}

export const translateJobTitle = (value: string | undefined): string =>
  value ? (jobTitleMap[value] ?? value) : ''

export const translateEmployeeType = (value: string): string =>
  employeeTypeMap[value] ?? value
