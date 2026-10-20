"use client";

// ** core
import { useRouter } from "next/navigation";

// ** assets / icons
import { CalendarClock, CheckCircle2, ChevronRight, ClipboardList, Clock, Lock } from "lucide-react";

// ** shared components
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useMyForms } from "@/lib/use-form-queries";
import { cn } from "@/lib/utils";
import { closesSoon, formatFormDateTime, type MyFormSummary } from "@/services/forms";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function FormStateBadge({ form }: { form: MyFormSummary }) {
  if (form.status === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        <CalendarClock className="h-3 w-3" />
        ເປີດ {formatFormDateTime(form.openAt)}
      </span>
    );
  }
  if (form.status === "closed") {
    return (
      <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
        <Lock className="h-3 w-3" />
        ປິດຮັບແລ້ວ
      </span>
    );
  }
  if (form.submittedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3" />
        ຕອບແລ້ວ
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      <Clock className="h-3 w-3" />
      ຍັງບໍ່ໄດ້ຕອບ
    </span>
  );
}

function actionLabel(form: MyFormSummary): string {
  if (form.status === "open" && !form.submittedAt) return "ຕອບແບບຟອມ";
  if (form.status === "open" && form.allowEdit) return "ແກ້ໄຂຄຳຕອບ";
  return "ເບິ່ງຄຳຕອບ";
}

export default function FormsPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const { data: forms = [], isLoading, error } = useMyForms(firebaseUser?.uid);

  const pendingCount = forms.filter((f) => f.status === "open" && !f.submittedAt).length;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-foreground text-2xl font-bold">ແບບສອບຖາມ</h1>
        <p className="text-muted-foreground">
          {pendingCount > 0 ? `ມີ ${pendingCount} ແບບຟອມທີ່ລໍຖ້າທ່ານຕອບ` : "ແບບຟອມ ແລະ ແບບສອບຖາມຈາກ HR"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive py-10 text-center text-sm">
          ໂຫຼດແບບຟອມບໍ່ສຳເລັດ: {error instanceof Error ? error.message : String(error)}
        </p>
      ) : forms.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center">
          <ClipboardList className="h-10 w-10 opacity-40" />
          <p className="text-sm">ຍັງບໍ່ມີແບບຟອມສຳລັບທ່ານ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <button
              key={form.id}
              type="button"
              // ຍັງບໍ່ຮອດເວລາເປີດ — ສະແດງໃຫ້ຮູ້ລ່ວງໜ້າ ແຕ່ເຂົ້າຕອບບໍ່ໄດ້
              disabled={form.status === "scheduled"}
              className="block w-full text-left disabled:cursor-default disabled:opacity-75"
              onClick={() => router.push(`/dashboard/forms/fill?id=${form.id}`)}
            >
              <Card
                className={cn(
                  "transition-colors hover:bg-accent/40",
                  form.status === "open" && !form.submittedAt && "border-l-4 border-l-primary",
                )}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-foreground font-semibold">{form.title}</p>
                      {form.isQuiz && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          ແບບທົດສອບ
                        </span>
                      )}
                      <FormStateBadge form={form} />
                    </div>
                    {form.description && (
                      <p className="text-muted-foreground line-clamp-2 text-sm">{form.description}</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {form.questionCount} ຄຳຖາມ
                      {form.submittedAt && ` · ຕອບເມື່ອ ${formatDate(form.submittedAt)}`}
                      {form.score && (
                        <span className="text-foreground font-medium">
                          {` · ຄະແນນ ${form.score.earned}/${form.score.total}`}
                        </span>
                      )}
                    </p>
                    {form.status !== "closed" && form.closeAt && (
                      <p
                        className={cn(
                          "text-xs",
                          closesSoon(form.closeAt) && !form.submittedAt
                            ? "text-destructive font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        ປິດຮັບຄຳຕອບ {formatFormDateTime(form.closeAt)}
                      </p>
                    )}
                  </div>
                  <div className="text-primary flex shrink-0 items-center gap-1 text-sm font-medium">
                    {form.status !== "scheduled" && (
                      <>
                        <span className="hidden sm:inline">{actionLabel(form)}</span>
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
