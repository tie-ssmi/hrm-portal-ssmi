'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge, CalendarDays, MessageSquare, User2, Building2 } from 'lucide-react'

export default function NewsPage() {
  const showNewsItems =
  {
    "createAt": "2026-03-19T02:30:00.000Z",
    "createBy": "ໂອລີເດດ ວົງສະຫວ່າງ",
    "description": "ກອງປະຊຸມວາງແຜນຍຸດທະສາດປະຈຳເດືອນ ມີນາ 2026 ຮ່ວມກັບຜູ້ຈັດການທັງ 8 ສາຂາ ເພື່ອສະຫຼຸບຜົນການດຳເນີນງານໃນໄຕມາດທີ 1 ແລະ ກຳນົດທິດທາງການຂະຫຍາຍຕົວຂອງທຸລະກິດໃນໄລຍະຖັດໄປ",
    "docType": "image",
    "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Fmeeting-01.png?alt=media",
    "note": "ກະລຸນາເຂົ້າຮ່ວມໃຫ້ກົງເວລາ",
    "title": "ປະຊຸມວາງແຜນ"
  }
  const newsItems = [
    {
      "createAt": "2026-03-19T02:30:00.000Z",
      "createBy": "ໂອລີເດດ ວົງສະຫວ່າງ",
      "description": "ກອງປະຊຸມວາງແຜນຍຸດທະສາດປະຈຳເດືອນ ມີນາ 2026 ຮ່ວມກັບຜູ້ຈັດການທັງ 8 ສາຂາ ເພື່ອສະຫຼຸບຜົນການດຳເນີນງານໃນໄຕມາດທີ 1 ແລະ ກຳນົດທິດທາງການຂະຫຍາຍຕົວຂອງທຸລະກິດໃນໄລຍະຖັດໄປ",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Fmeeting-01.png?alt=media",
      "note": "ກະລຸນາເຂົ້າຮ່ວມໃຫ້ກົງເວລາ",
      "title": "ປະຊຸມວາງແຜນ"
    },
    {
      "createAt": "2026-03-19T03:15:20.000Z",
      "createBy": "ມົວ ລີ",
      "description": "ຝຶກອົບຮົມການໃຊ້ລະບົບ HRM ໃໝ່ ໃຫ້ພະນັກງານ 480 ຄົນ",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Ftraining-lpb.png?alt=media",
      "note": "ເນັ້ນການກວດສອບ Accuracy ຂອງ GPS",
      "title": "ຝຶກອົບຮົມໄອທີ"
    },
    {
      "createAt": "2026-03-19T04:00:10.510Z",
      "createBy": "Admin SSMI",
      "description": "ກິດຈະກຳທັດສະນະສຶກສາ ສາຂາຫຼວງພະບາງ",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Ftrip-2026.png?alt=media",
      "note": "ລວມຕົວກັນຢູ່ SSMI LPB",
      "title": "ທັດສະນະສຶກສາ"
    },
    {
      "createAt": "2026-03-19T05:45:00.000Z",
      "createBy": "ສົມສັກ ແກ້ວວົງສາ",
      "description": "ງານລ້ຽງສ້າງສັນປະຈຳປີ ພະແນກບັນຊີ",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Fparty.png?alt=media",
      "note": "ຊຸດແຕ່ງກາຍສີຂາວ",
      "title": "ງານລ້ຽງສັນສັນ"
    },
    {
      "createAt": "2026-03-19T06:20:30.000Z",
      "createBy": "ໂອລີເດດ ວົງສະຫວ່າງ",
      "description": "ກວດກາຄວາມປອດໄພຂອງອາຄານ ສາຂາວຽງຈັນ",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Fsafety-check.png?alt=media",
      "note": "ຜ່ານການກວດກາ 100%",
      "title": "ກວດກາຄວາມປອດໄພ"
    },
    {
      "createAt": "2026-03-19T07:10:00.000Z",
      "createBy": "ມົວ ລີ",
      "description": "ແຂ່ງຂັນກິລາບານສົ່ງ ລະຫວ່າງສາຂາ",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Fvolleyball.png?alt=media",
      "note": "ທີມຫຼວງພະບາງ ຊະນະເລີດ",
      "title": "ກິລາບານສົ່ງ"
    },
    {
      "createAt": "2026-03-19T08:50:15.000Z",
      "createBy": "Admin SSMI",
      "description": "ປະກາດລາງວັນພະນັກງານດີເດັ່ນ ໄຕມາດ 1",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Faward-q1.png?alt=media",
      "note": "ຍິນດີກັບທຸກຄົນທີ່ໄດ້ຮັບລາງວັນ",
      "title": "ລາງວັນດີເດັ່ນ"
    },
    {
      "createAt": "2026-03-19T09:30:45.000Z",
      "createBy": "ສົມສັກ ແກ້ວວົງສາ",
      "description": "ກິດຈະກຳປູກຕົ້ນໄມ້ ຮັກສາສິ່ງແວດລ້ອມ",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Fgreen-day.png?alt=media",
      "note": "ປູກຢູ່ເຂດພື້ນທີ່ສາຂາປາກເຊ",
      "title": "ວັນສີຂຽວ"
    },
    {
      "createAt": "2026-03-19T10:15:00.000Z",
      "createBy": "ມົວ ລີ",
      "description": "ສຳມະນາເລື່ອງຄວາມປອດໄພທາງໄຊເບີ (Cyber Security)",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Fcyber-sec.png?alt=media",
      "note": "ສຳລັບພະແນກໄອທີ ແລະ ບັນຊີ",
      "title": "ສຳມະນາໄອທີ"
    },
    {
      "createAt": "2026-03-19T11:00:22.000Z",
      "createBy": "ໂອລີເດດ ວົງສະຫວ່າງ",
      "description": "ງານວາງສະແດງສິນຄ້າ SSMI Expo 2026",
      "docType": "image",
      "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fevents%2Fexpo-2026.png?alt=media",
      "note": "ງານຈັດຢູ່ສູນການຄ້າລາວ-ໄອເຕັກ",
      "title": "SSMI Expo"
    }
  ]
  return (
    <div className="p-6 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-foreground font-noto-lao text-primary">ຂ່າວສານ ແລະ ແຈ້ງການ</h1>
        <p className="text-muted-foreground font-noto-lao">ຕິດຕາມການເຄື່ອນໄຫວລ່າສຸດຈາກທັງໝົດ 8 ສາຂາ</p>
      </div>

      {/* Grid Layout: computer*/}
      {/* Grid 5*/}
      <div className=" grid grid-cols-2 items-start gap-6">
        {/* grid 2 box */}
        <div className="grid gap-6 grid-cols-1 ">
          {newsItems.map((item, index) => (
            <Card key={index} className="flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 border-slate-200 ">
              {/* ສ່ວນຮູບພາບ */}


              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xl font-bold font-noto-lao line-clamp-1">
                  {item.title}
                </CardTitle>

              </CardHeader>

              <CardContent className="p-4 pt-0 flex-grow">
                <p className="text-sm text-slate-600 font-noto-lao line-clamp-2 mb-3">
                  {item.description}
                </p>
                {item.note && (
                  <div className="bg-slate-50 p-2 rounded-md border-l-4 border-primary flex items-start gap-2">
                    <MessageSquare className="h-3 w-3 mt-1 text-primary" />
                    <p className="text-xs italic text-slate-500 font-noto-lao">{item.note}</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="px-4 border-t bg-slate-50/50 flex justify-between items-center">

                <div>
                  <div className="flex items-center gap-2">
                    <User2 className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">{item.createBy}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">ສາຂາ ຫຼວງພະບາງ</span>
                  </div>

                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>{item.createAt}</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
        {/* grid 3 box whit overflow*/}
        <div className="sticky top-4 self-start w-full">

          <Card className="flex max-h-[calc(100vh-8rem)] min-h-0 flex-col overflow-hidden hover:shadow-xl">
            {/* ສ່ວນຮູບພາບ */}


            <CardHeader className="p-4 pb-2 bg-slate-50/50 border-b">
              <CardTitle className="text-xl font-bold font-noto-lao line-clamp-1">
                {showNewsItems.title}
              </CardTitle>

            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 pt-0">
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              <p className="text-sm text-slate-600 font-noto-lao  mb-3">
                {showNewsItems.description}
              </p>
              {showNewsItems.note && (
                <div className="bg-slate-50 p-2 rounded-md border-l-4 border-primary flex items-start gap-2">
                  <MessageSquare className="h-3 w-3 mt-1 text-primary" />
                  <p className="text-xs italic text-slate-500 font-noto-lao">{showNewsItems.note}</p>
                </div>
              )}
            </CardContent>

            <CardFooter className="px-4 border-t bg-slate-50/50 flex justify-between items-center">

              <div>
                <div className="flex items-center gap-2">
                  <User2 className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">{showNewsItems.createBy}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">ສາຂາ ຫຼວງພະບາງ</span>
                </div>

              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <CalendarDays className="h-3 w-3" />
                <span>{new Date(showNewsItems.createAt).toLocaleDateString('lo-LA')}</span>
              </div>
            </CardFooter>
          </Card>

        </div>
      </div>

    </div>
  )
}
