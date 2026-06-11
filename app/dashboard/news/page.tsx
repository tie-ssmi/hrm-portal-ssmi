'use client'

// ** core
import { useState, useEffect } from 'react'

// ** assets / icons
import { Badge, CalendarDays, MessageSquare, User2, Building2 } from 'lucide-react'

// ** shared components
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
export default function NewsPage() {
  const initialNews =
  {
    "createAt": "2026-03-19T02:30:00.000Z",
    "createBy": "ໂອລີເດດ ວົງສະຫວ່າງ",
    "description": "ກອງປະຊຸມວາງແຜນຍຸດທະສາດປະຈຳເດືອນ ມີນາ 2026 ຮ່ວມກັບຜູ້ຈັດການທັງ 8 ສາຂາ ເພື່ອສະຫຼຸບຜົນການດຳເນີນງານໃນໄຕມາດທີ 1 ແລະ ກຳນົດທິດທາງການຂະຫຍາຍຕົວຂອງທຸລະກິດໃນໄລຍະຖັດໄປ",
    "docType": "image",
    "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fprofiles%2Fcf8ef0cb-1b5a-465c-962f-77e40c642423.png?alt=media&token=139a6be9-1e60-43b6-98ba-f3b6be4b92b6",
    "note": "ກະລຸນາເຂົ້າຮ່ວມໃຫ້ກົງເວລາ",
    "title": "ປະຊຸມວາງແຜນ"
  }
  const newsItems = [
  {
    "createAt": "2026-03-19T02:30:00.000Z",
    "createBy": "ໂອລີເດດ ວົງສະຫວ່າງ",
    "description": "ກອງປະຊຸມວາງແຜນຍຸດທະສາດປະຈຳເດືອນ ມີນາ 2026 ຮ່ວມກັບຜູ້ຈັດການທັງ 8 ສາຂາ ເພື່ອສະຫຼຸບຜົນການດຳເນີນງານໃນໄຕມາດທີ 1 ແລະ ກຳນົດທິດທາງການຂະຫຍາຍຕົວຂອງທຸລະກິດໃນໄລຍະຖັດໄປ",
    "docType": "image",
    "docURL": "https://firebasestorage.googleapis.com/v0/b/hrm-ssmi.firebasestorage.app/o/images%2Fprofiles%2Fcf8ef0cb-1b5a-465c-962f-77e40c642423.png?alt=media&token=139a6be9-1e60-43b6-98ba-f3b6be4b92b6",
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
  const [selectedNews, setSelectedNews] = useState(newsItems[0] || initialNews)
  const [openSheetIndex, setOpenSheetIndex] = useState<number | null>(null)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setOpenSheetIndex(null)
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  
  return (
    <div className=" space-y-6 ">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-foreground font-noto-lao text-primary">ຂ່າວສານ ແລະ ແຈ້ງການ</h1>
        <p className="text-muted-foreground font-noto-lao">ຕິດຕາມການເຄື່ອນໄຫວລ່າສຸດຈາກທັງໝົດ 8 ສາຂາ</p>
      </div>

      {/* Grid Layout: computer*/}
      {/* Grid 5*/}
      <div className="hidden lg:grid grid-cols-2 items-start gap-6 w-full">
        {/* grid 2 box */}
        <div className="grid gap-6 grid-cols-1 ">
          {newsItems.map((item, index) => (
            <Card 
              key={index} 
              className="flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 border-slate-200 cursor-pointer"
              onClick={() => setSelectedNews(item)}
            >
              {/* ສ່ວນຮູບພາບ */}


              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xl font-bold font-noto-lao line-clamp-1">
                  {item.title}
                </CardTitle>

              </CardHeader>

              <CardContent className="p-4 pt-0 flex-grow">
                <p className="text-sm font-noto-lao line-clamp-2 mb-3">
                  {item.description}
                </p>
                {item.note && (
                  <div className="p-2 rounded-md border-l-4 border-primary flex items-start gap-2">
                    <MessageSquare className="h-3 w-3 mt-1 text-primary" />
                    <p className="text-xs italic text-slate-500 font-noto-lao">{item.note}</p>
                  </div>
                )}

               
              
            
              </CardContent>

              <CardFooter className="px-4 border-t  flex justify-between items-center">

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
                  <span>{new Date(item.createAt).toLocaleDateString('lo-LA')}</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
        {/* grid 3 box whit overflow*/}
        <div className="sticky top-4 self-start w-full">

          <Card className="flex max-h-[calc(100vh-1rem)] min-h-0 flex-col overflow-hidden hover:shadow-xl">
            {/* ສ່ວນຮູບພາບ */}


            <CardHeader className="p-4 pb-2  border-b">
              <CardTitle className="text-xl font-bold font-noto-lao line-clamp-1">
                {selectedNews.title}
              </CardTitle>

            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 pt-0">
              <p className="text-sm  font-noto-lao  mb-3">
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
                {selectedNews.description}
              </p>
              
              {selectedNews.note && (
                <div className="p-2 rounded-md border-l-4 border-primary flex items-start gap-2">
                  <MessageSquare className="h-3 w-3 mt-1 text-primary" />
                  <p className="text-xs italic text-slate-500 font-noto-lao">{selectedNews.note}</p>
                </div>
              )}
               {selectedNews.docType === 'image' && selectedNews.docURL ? (
                  <div className="mt-4">
                    <img src={selectedNews.docURL} alt={selectedNews.title} className="w-full h-auto rounded-md" />
                  </div>
                ) : selectedNews.docType === 'doc' && selectedNews.docURL ? (
                  <div className="mt-4">
                    <a href={selectedNews.docURL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary">
                      <Badge className="h-4 w-4" />
                      <span className="text-sm font-medium">ເອກະສານ PDF</span>
                    </a>
                  </div>
                ) : null}
            </CardContent>

            <CardFooter className="px-4 border-t flex justify-between items-center">

              <div>
                <div className="flex items-center gap-2">
                  <User2 className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">{selectedNews.createBy}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">ສາຂາ ຫຼວງພະບາງ</span>
                </div>

              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <CalendarDays className="h-3 w-3" />
                <span>{new Date(selectedNews.createAt).toLocaleDateString('lo-LA')}</span>
              </div>
            </CardFooter>
          </Card>

        </div>
      </div>
                  {/* on mobil */}
      <div className="lg:hidden  flex flex-wrap gap-2">
      {newsItems.map((side,index) => (
        <Sheet key={index} open={openSheetIndex === index} onOpenChange={(isOpen) => setOpenSheetIndex(isOpen ? index : null)}>
          <SheetTrigger asChild>
            <Card 
              className="flex w-full flex-col overflow-hidden hover:shadow-xl transition-all duration-300 border-slate-200 cursor-pointer"
            >
              {/* ສ່ວນຮູບພາບ */}


              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xl font-bold font-noto-lao line-clamp-1">
                  {side.title}
                </CardTitle>

              </CardHeader>

              <CardContent className="p-4 pt-0 flex-grow">
                <p className="text-sm font-noto-lao line-clamp-2 mb-3">
                  {side.description}
                </p>
                {side.note && (
                  <div className="p-2 rounded-md border-l-4 border-primary flex items-start gap-2">
                    <MessageSquare className="h-3 w-3 mt-1 text-primary" />
                    <p className="text-xs italic text-slate-500 font-noto-lao">{side.note}</p>
                  </div>
                )}

               
              
            
              </CardContent>

              <CardFooter className="px-4 border-t  flex justify-between items-center">

                <div>
                  <div className="flex items-center gap-2">
                    <User2 className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">{side.createBy}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">ສາຂາ ຫຼວງພະບາງ</span>
                  </div>

                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>{new Date(side.createAt).toLocaleDateString('lo-LA')}</span>
                </div>
              </CardFooter>
            </Card>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="data-[side=bottom]:max-h-[50vh] data-[side=top]:max-h-[50vh]"
          >
            <SheetHeader>
              <SheetTitle className="font-noto-lao">{side.title}</SheetTitle>
              <SheetDescription className="font-noto-lao text-sm text-muted-foreground flex items-center justify-between gap-4">
               
                <div>
                  <div className="flex items-center gap-2">
                    <User2 className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">{side.createBy}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">ສາຂາ ຫຼວງພະບາງ</span>
                  </div>

                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>{new Date(side.createAt).toLocaleDateString('lo-LA')}</span>
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="no-scrollbar overflow-y-auto px-4 space-y-4">
              <p className="text-sm font-noto-lao leading-relaxed">
                {side.description}
              </p>
              
              {side.note && (
                <div className="p-2 rounded-md border-l-4 border-primary flex items-start gap-2">
                  <MessageSquare className="h-3 w-3 mt-1 text-primary" />
                  <p className="text-xs italic text-slate-500 font-noto-lao">{side.note}</p>
                </div>
              )}
              
              {side.docType === 'image' && side.docURL ? (
                <div className="mt-4">
                  <img src={side.docURL} alt={side.title} className="w-full h-auto rounded-md" />
                </div>
              ) : side.docType === 'doc' && side.docURL ? (
                <div className="mt-4">
                  <a href={side.docURL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary">
                    <Badge className="h-4 w-4" />
                    <span className="text-sm font-medium">ເອກະສານ PDF</span>
                  </a>
                </div>
              ) : null}
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">ປິດ</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>

    </div>
  )
}
