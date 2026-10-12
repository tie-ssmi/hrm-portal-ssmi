// Read-only view of the per-type workOutside fields (location, OT hours,
// training costs, audit checklist, notes). Shared by the requester's detail
// page and the approver's detail page. Renders nothing for a doc that has none
// of these fields, which covers every request filed before the 4-type form.

// ** assets / icons
import {
  MapPin,
  Clock,
  Wallet,
  Building,
  Phone,
  ListChecks,
  StickyNote,
  FileText,
  User,
} from 'lucide-react'

// ** config / utils / types / hooks
import { formatLak, formatUsd } from '@/lib/offsite-form-types'
import { formatLaoDate } from '@/lib/format'
import type { WorkOutsideRecord } from '@/types/workOutside'

function Block({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-lg border p-3">
      <p className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-xs">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <div className="text-foreground text-sm leading-6">{children}</div>
    </div>
  )
}

export function OffsiteTypeDetails({ record }: { record: WorkOutsideRecord }) {
  const {
    location,
    customerName,
    details,
    startTime,
    endTime,
    totalHours,
    estimatedCost,
    costItems,
    exchangeRate,
    costTotals,
    organizer,
    registrationDeadline,
    coordinators,
    documentChecklist,
    notes,
  } = record

  const hasTime = !!(startTime || endTime || totalHours != null)
  const hasAny =
    location ||
    customerName ||
    details ||
    hasTime ||
    estimatedCost != null ||
    costItems?.length ||
    organizer ||
    registrationDeadline ||
    coordinators?.length ||
    documentChecklist?.length ||
    notes?.length
  if (!hasAny) return null

  return (
    <div className="space-y-3">
      {(location || customerName || hasTime) && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {location && (
            <Block icon={MapPin} label="ສະຖານທີ່">
              {location}
            </Block>
          )}
          {customerName && (
            <Block icon={User} label="ລູກຄ້າ">
              {customerName}
            </Block>
          )}
          {hasTime && (
            <Block icon={Clock} label="ເວລາ">
              <span className="tabular-nums">
                {(startTime || endTime) && `${startTime || '—'} – ${endTime || '—'}`}
                {totalHours != null && (
                  <span className="text-muted-foreground">
                    {startTime || endTime ? ' · ' : ''}
                    {totalHours} ຊົ່ວໂມງ
                  </span>
                )}
              </span>
            </Block>
          )}
        </div>
      )}

      {details && (
        <Block icon={FileText} label="ລາຍລະອຽດ">
          <p className="whitespace-pre-wrap">{details}</p>
        </Block>
      )}

      {(costItems?.length || estimatedCost != null) && (
        <Block icon={Wallet} label="ຄ່າໃຊ້ຈ່າຍ">
          {costItems && costItems.length > 0 && (
            <div className="-mx-1 mb-2 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="px-1 py-1.5 font-medium">#</th>
                    <th className="px-1 py-1.5 font-medium">ລາຍການ</th>
                    <th className="px-1 py-1.5 text-right font-medium">ກີບ</th>
                    <th className="px-1 py-1.5 text-right font-medium">USD</th>
                    <th className="px-1 py-1.5 font-medium">ໝາຍເຫດ</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {costItems.map((c, i) => (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="text-muted-foreground px-1 py-1.5">{c.no ?? i + 1}</td>
                      <td className="px-1 py-1.5">{c.item}</td>
                      <td className="px-1 py-1.5 text-right whitespace-nowrap">
                        {c.lak != null ? c.lak.toLocaleString('en-US') : ''}
                      </td>
                      <td className="px-1 py-1.5 text-right whitespace-nowrap">
                        {c.usd != null ? c.usd.toLocaleString('en-US') : ''}
                      </td>
                      <td className="text-muted-foreground px-1 py-1.5 text-xs">{c.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
            {costTotals && (
              <>
                <dt className="text-muted-foreground">ລວມເປັນກີບ</dt>
                <dd className="text-right">{formatLak(costTotals.lak)}</dd>
                {costTotals.usd > 0 && (
                  <>
                    <dt className="text-muted-foreground">
                      ລວມເປັນໂດລາ
                      {exchangeRate?.lakPerUsd
                        ? ` (1 USD = ${exchangeRate.lakPerUsd.toLocaleString('en-US')} ກີບ)`
                        : ''}
                    </dt>
                    <dd className="text-right">
                      {formatUsd(costTotals.usd)} = {formatLak(costTotals.usdConvertedToLak)}
                    </dd>
                  </>
                )}
              </>
            )}
            {estimatedCost != null && (
              <>
                <dt className="font-semibold">ລວມທັງໝົດ</dt>
                <dd className="text-right font-semibold">{formatLak(estimatedCost)}</dd>
              </>
            )}
          </dl>
        </Block>
      )}

      {(organizer || registrationDeadline || coordinators?.length) && (
        <Block icon={Building} label="ຂໍ້ມູນການຝຶກອົບຮົມ">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {organizer && (
              <>
                <dt className="text-muted-foreground">ຜູ້ຈັດ</dt>
                <dd>{organizer}</dd>
              </>
            )}
            {registrationDeadline && (
              <>
                <dt className="text-muted-foreground">ກຳນົດລົງທະບຽນ</dt>
                <dd>{formatLaoDate(registrationDeadline)}</dd>
              </>
            )}
            {coordinators && coordinators.length > 0 && (
              <>
                <dt className="text-muted-foreground">ຜູ້ປະສານງານ</dt>
                <dd className="space-y-0.5">
                  {coordinators.map((c, i) => (
                    <p key={i}>
                      {c.name}
                      {c.phone && (
                        <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 tabular-nums">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
                      )}
                    </p>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </Block>
      )}

      {documentChecklist && documentChecklist.length > 0 && (
        <Block icon={ListChecks} label="ລາຍການເອກະສານທີ່ຕ້ອງກະກຽມ">
          <div className="space-y-3">
            {documentChecklist.map((g, i) => (
              <div key={i}>
                {g.group && <p className="mb-1 font-medium">{g.group}</p>}
                <ol className="space-y-1">
                  {g.items.map((it, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-muted-foreground w-5 shrink-0 tabular-nums">
                        {it.no ?? j + 1}.
                      </span>
                      <span className="flex-1">{it.item}</span>
                      {it.remark && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {it.remark}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Block>
      )}

      {notes && notes.length > 0 && (
        <Block icon={StickyNote} label="ໝາຍເຫດ">
          <ul className="list-disc space-y-1 pl-4">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  )
}
