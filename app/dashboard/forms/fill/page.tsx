"use client";

// ** core
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// ** assets / icons
import { ArrowLeft, CheckCircle2, FileQuestion, Lock, Star, X } from "lucide-react";

// ** shared components
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ** third party
import { toast } from "sonner";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { useMyForm, useSubmitFormResponse } from "@/lib/use-form-queries";
import { cn } from "@/lib/utils";
import {
  closesSoon,
  formatFormDateTime,
  formQuestions,
  LONG_TEXT_MAX,
  missingRequired,
  SHORT_TEXT_MAX,
  type FormAnswer,
  type FormAnswers,
  type FormQuestion,
  type FormSection,
  type QuizScore,
} from "@/services/forms";

// ເວລາທັງໝົດສະແດງເປັນ Asia/Vientiane — ບໍ່ແມ່ນ timezone ຂອງເຄື່ອງ
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Vientiane",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return dateTimeFormatter.format(d).replace(",", "");
}

// ຂໍ້ຄວາມ error ທີ່ຜູ້ໃຊ້ອ່ານເຂົ້າໃຈ — Firebase ສົ່ງ code ມາ, message ຂອງ HttpsError
// ຈາກ server (functions/src/forms.ts) ເປັນພາສາລາວຢູ່ແລ້ວ ຈຶ່ງໃຊ້ຕໍ່ໄດ້
function friendlyError(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "functions/unavailable" || code === "functions/deadline-exceeded")
    return "ບໍ່ສາມາດເຊື່ອມຕໍ່ server. ກະລຸນາກວດ internet ແລ້ວລອງໃໝ່.";
  if (code === "functions/unauthenticated") return "ກະລຸນາເຂົ້າລະບົບໃໝ່.";
  if (code === "functions/internal" || code === "functions/unknown") return fallback;
  return err instanceof Error && err.message ? err.message : fallback;
}

function hasAnswer(value: FormAnswer | undefined): boolean {
  if (value === undefined || value === "") return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// ຕັດຄຳຕອບທີ່ອ້າງເຖິງຄຳຖາມ/ຕົວເລືອກທີ່ admin ລຶບແລ້ວ — ບໍ່ດັ່ງນັ້ນ server ປະຕິເສດ
// ("ຕົວເລືອກບໍ່ຖືກຕ້ອງ") ໂດຍຜູ້ໃຊ້ບໍ່ເຫັນສາເຫດ
function sanitizeAnswers(sections: FormSection[], answers: FormAnswers): FormAnswers {
  const result: FormAnswers = {};
  for (const q of formQuestions(sections)) {
    const value = answers[q.id];
    if (value === undefined) continue;
    const optionIds = new Set((q.options ?? []).map((o) => o.id));
    if (q.type === "checkbox") {
      const picked = Array.isArray(value) ? value.filter((id) => optionIds.has(id)) : [];
      if (picked.length > 0) result[q.id] = picked;
    } else if (q.type === "radio" || q.type === "dropdown") {
      if (typeof value === "string" && optionIds.has(value)) result[q.id] = value;
    } else if (q.type === "rating") {
      if (typeof value === "number" && value >= 1 && value <= (q.ratingMax ?? 5)) result[q.id] = value;
    } else if (typeof value === "string") {
      result[q.id] = value;
    }
  }
  return result;
}

// ຮ່າງຄຳຕອບທີ່ຍັງບໍ່ໄດ້ສົ່ງ — ເກັບໃນເຄື່ອງນີ້ເທົ່ານັ້ນ, ອ່ານ/ຂຽນບໍ່ໄດ້ (private mode) ກໍບໍ່ເປັນຫຍັງ
const draftKey = (uid: string, formId: string) => `ssmi_form_draft_${uid}_${formId}`;

function readDraft(key: string): FormAnswers | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as FormAnswers) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, answers: FormAnswers) {
  try {
    localStorage.setItem(key, JSON.stringify(answers));
  } catch {
    /* ບໍ່ມີບ່ອນເກັບ — ຂ້າມ */
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ຂ້າມ */
  }
}

export default function FillFormPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [formId, setFormId] = useState<string | null>(null);

  useEffect(() => {
    setFormId(new URLSearchParams(window.location.search).get("id") ?? "");
  }, []);

  const { data, isLoading, error } = useMyForm(uid, formId);
  const submit = useSubmitFormResponse(uid, formId ?? "");

  const [answers, setAnswers] = useState<FormAnswers>({});
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set());
  // ມີການແກ້ໄຂທີ່ຍັງບໍ່ໄດ້ສົ່ງ — ໃຊ້ເຕືອນກ່ອນອອກ ແລະ ບັນທຶກຮ່າງ
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [submitted, setSubmitted] = useState<"new" | "edit" | null>(null);
  // Quiz: ຄະແນນທີ່ server ຄືນມາຕອນສົ່ງ (null = ບໍ່ແມ່ນ quiz ຫຼື admin ຕັ້ງບໍ່ໃຫ້ເຫັນ)
  const [submittedScore, setSubmittedScore] = useState<QuizScore | null>(null);

  const editable =
    !!data && data.form.status === "open" && (!data.response || data.form.allowEdit);
  const storageKey = uid && formId ? draftKey(uid, formId) : null;

  // ໃສ່ຄຳຕອບເກົ່າ (ຫຼື ຮ່າງທີ່ຍັງບໍ່ໄດ້ສົ່ງ) ຄັ້ງດຽວ — ບໍ່ໃຫ້ refetch ຂຽນທັບສິ່ງທີ່ກຳລັງແກ້
  const hasPrefilledRef = useRef(false);
  useEffect(() => {
    if (!data || hasPrefilledRef.current) return;
    hasPrefilledRef.current = true;
    const draft = editable && storageKey ? readDraft(storageKey) : null;
    if (draft) {
      setAnswers(sanitizeAnswers(data.form.sections, draft));
      setDirty(true);
      toast.info("ກູ້ຄືນຄຳຕອບທີ່ທ່ານຍັງບໍ່ໄດ້ສົ່ງ");
      return;
    }
    if (data.response) setAnswers(sanitizeAnswers(data.form.sections, data.response.answers));
  }, [data, editable, storageKey]);

  useEffect(() => {
    if (dirty && storageKey) writeDraft(storageKey, answers);
  }, [answers, dirty, storageKey]);

  // ປິດແທັບ / reload ຕອນມີການແກ້ໄຂຄ້າງ → browser ຖາມຢືນຢັນ
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // Safari / Chrome ລຸ້ນເກົ່າ ຍັງຕ້ອງການອັນນີ້
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const leave = () => router.push("/dashboard/forms");
  const goBack = () => (dirty ? setConfirmLeave(true) : leave());

  if (formId === null || isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-8">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-28 w-full rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Empty className="py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>{error ? "ໂຫຼດແບບຟອມບໍ່ສຳເລັດ" : "ບໍ່ພົບແບບຟອມ"}</EmptyTitle>
          {error && (
            <EmptyDescription>{friendlyError(error, "ກະລຸນາລອງໃໝ່ອີກຄັ້ງ.")}</EmptyDescription>
          )}
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={leave} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            ກັບຄືນ
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const { form, response } = data;

  if (submitted) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia>
            <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-500" />
          </EmptyMedia>
          <EmptyTitle className="text-xl">
            {submitted === "edit" ? "ບັນທຶກການແກ້ໄຂແລ້ວ" : "ສົ່ງຄຳຕອບແລ້ວ"}
          </EmptyTitle>
          <EmptyDescription>ຂອບໃຈທີ່ຕອບແບບຟອມ &quot;{form.title}&quot;</EmptyDescription>
          {submittedScore && (
            <p className="text-foreground mt-2 text-3xl font-bold tabular-nums">
              {submittedScore.earned}/{submittedScore.total}{" "}
              <span className="text-muted-foreground text-base font-normal">ຄະແນນ</span>
            </p>
          )}
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            {form.showResult === "scoreAndAnswers" && (
              // data ຖືກ refetch ແລ້ວ (invalidate ໃນ useSubmitFormResponse) — ໄດ້ເສີຍ ແລະ ຜົນຕໍ່ຂໍ້
              <Button variant="outline" onClick={() => setSubmitted(null)}>
                ເບິ່ງຄຳຕອບ ແລະ ສະເລີຍ
              </Button>
            )}
            <Button onClick={leave}>ກັບໄປໜ້າແບບສອບຖາມ</Button>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  const questions = formQuestions(form.sections);
  const answeredCount = questions.filter((q) => hasAnswer(answers[q.id])).length;
  const totalPoints = Object.values(form.questionPoints ?? {}).reduce((a, b) => a + b, 0);

  const clearInvalid = (questionId: string) =>
    setInvalidIds((prev) => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });

  const setAnswer = (questionId: string, value: FormAnswer | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[questionId];
      else next[questionId] = value;
      return next;
    });
    setDirty(true);
    clearInvalid(questionId);
  };

  const handleSubmit = () => {
    const missing = missingRequired(form.sections, answers);
    if (missing.length > 0) {
      setInvalidIds(new Set(missing.map((q) => q.id)));
      const first = document.getElementById(`question-${missing[0].id}`);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.querySelector<HTMLElement>("input, textarea, button, [role='radio']")?.focus({ preventScroll: true });
      toast.error(`ກະລຸນາຕອບຄຳຖາມທີ່ຈຳເປັນ (${missing.length} ຂໍ້)`);
      return;
    }
    submit.mutate(answers, {
      onSuccess: (result) => {
        if (storageKey) clearDraft(storageKey);
        setDirty(false);
        setSubmittedScore(result.score);
        setSubmitted(response ? "edit" : "new");
        window.scrollTo({ top: 0 });
      },
      onError: (err) => toast.error(friendlyError(err, "ສົ່ງຄຳຕອບບໍ່ສຳເລັດ. ກະລຸນາລອງໃໝ່.")),
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2 gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        ກັບຄືນ
      </Button>

      <Card className="border-t-primary gap-3 border-t-8">
        <CardHeader>
          <CardTitle role="heading" aria-level={1} className="text-2xl font-bold">
            {form.title}
          </CardTitle>
          {form.description && (
            <CardDescription className="whitespace-pre-wrap">{form.description}</CardDescription>
          )}
        </CardHeader>
        {editable && (
          <CardContent className="space-y-1">
            {form.isQuiz && (
              <p className="text-foreground text-sm">
                📝 ແບບທົດສອບ · ຄະແນນເຕັມ {totalPoints} · ສົ່ງແລ້ວແກ້ໄຂຄຳຕອບບໍ່ໄດ້
              </p>
            )}
            {form.closeAt && (
              <p className={cn("text-sm", closesSoon(form.closeAt) ? "text-destructive font-medium" : "text-muted-foreground")}>
                ⏰ ປິດຮັບຄຳຕອບ {formatFormDateTime(form.closeAt)}
              </p>
            )}
            <p className="text-destructive text-xs">* ຈຳເປັນຕ້ອງຕອບ</p>
          </CardContent>
        )}
      </Card>

      {response?.score && (
        <Card className="gap-1 py-4">
          <CardContent className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground text-sm">ຄະແນນຂອງທ່ານ</span>
            <span className="text-foreground text-2xl font-bold tabular-nums">
              {response.score.earned}/{response.score.total}
            </span>
          </CardContent>
        </Card>
      )}

      {!editable && (
        <Alert className="bg-muted">
          <Lock />
          <AlertDescription>
            {form.status === "closed"
              ? "ແບບຟອມນີ້ປິດຮັບຄຳຕອບແລ້ວ"
              : `ທ່ານຕອບແລ້ວເມື່ອ ${formatDateTime(response?.submittedAt)} — ແບບຟອມນີ້ບໍ່ອະນຸຍາດໃຫ້ແກ້ໄຂຄຳຕອບ`}
          </AlertDescription>
        </Alert>
      )}
      {editable && response && (
        <p className="text-muted-foreground text-sm">
          ທ່ານຕອບແລ້ວເມື່ອ {formatDateTime(response.submittedAt)} — ແກ້ໄຂແລ້ວກົດ &quot;ບັນທຶກການແກ້ໄຂ&quot;
        </p>
      )}

      {editable && questions.length > 0 && (
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur">
          <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
            <span>ຄວາມຄືບໜ້າ</span>
            <span className="tabular-nums">
              ຕອບແລ້ວ {answeredCount}/{questions.length}
            </span>
          </div>
          <Progress value={(answeredCount / questions.length) * 100} className="h-1.5" />
        </div>
      )}

      {form.sections.map((section) => (
        <section
          key={section.id}
          className="space-y-4 pt-2"
          aria-labelledby={section.title ? `section-${section.id}` : undefined}
        >
          {(section.title || section.description) && form.sections.length > 1 && (
            <Card className="bg-primary/5 border-primary/20 gap-1 py-4 shadow-none">
              <CardHeader>
                {section.title && (
                  <CardTitle id={`section-${section.id}`} role="heading" aria-level={2} className="text-lg">
                    {section.title}
                  </CardTitle>
                )}
                {section.description && (
                  <CardDescription className="whitespace-pre-wrap">{section.description}</CardDescription>
                )}
              </CardHeader>
            </Card>
          )}

          {(section.questions ?? []).map((q) => {
            const invalid = invalidIds.has(q.id);
            const titleId = `question-title-${q.id}`;
            const errorId = `question-error-${q.id}`;
            const points = form.questionPoints?.[q.id];
            const result = response?.score?.results?.[q.id];
            return (
              <Card
                key={q.id}
                id={`question-${q.id}`}
                className={cn(
                  "scroll-mt-24 py-5",
                  invalid && "border-destructive",
                  result && (result.correct ? "border-green-500" : "border-destructive/60"),
                )}
              >
                <CardContent>
                  <FieldSet data-invalid={invalid || undefined}>
                    <FieldLegend id={titleId} variant="label" className="text-foreground text-base font-medium">
                      {q.title}
                      {q.required && (
                        <span className="text-destructive ml-1" aria-hidden="true">
                          *
                        </span>
                      )}
                      {q.required && <span className="sr-only"> (ຈຳເປັນ)</span>}
                      {form.isQuiz && points !== undefined && (
                        <span className="text-muted-foreground ml-2 text-xs font-normal tabular-nums">
                          {result ? `${result.earned}/${points}` : points} ຄະແນນ
                        </span>
                      )}
                    </FieldLegend>
                    {q.description && <FieldDescription>{q.description}</FieldDescription>}
                    {editable ? (
                      <QuestionInput
                        question={q}
                        value={answers[q.id]}
                        labelledBy={titleId}
                        describedBy={invalid ? errorId : undefined}
                        invalid={invalid}
                        onChange={(value) => setAnswer(q.id, value)}
                      />
                    ) : (
                      <ReadOnlyAnswer
                        question={q}
                        value={answers[q.id]}
                        correct={response?.correctAnswers?.[q.id]}
                      />
                    )}
                    {invalid && <FieldError id={errorId}>ກະລຸນາຕອບຄຳຖາມນີ້</FieldError>}
                  </FieldSet>
                </CardContent>
              </Card>
            );
          })}
        </section>
      ))}

      {editable && (
        <div className="flex justify-end pt-2">
          <Button onClick={handleSubmit} disabled={submit.isPending} size="lg" className="w-full sm:w-auto sm:min-w-40">
            {submit.isPending && <Spinner className="mr-2" />}
            {response ? "ບັນທຶກການແກ້ໄຂ" : "ສົ່ງຄຳຕອບ"}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ອອກຈາກໜ້ານີ້?</AlertDialogTitle>
            <AlertDialogDescription>
              ຄຳຕອບຍັງບໍ່ໄດ້ສົ່ງ. ລະບົບເກັບເປັນຮ່າງໄວ້ໃນເຄື່ອງນີ້ — ກັບມາເປີດແບບຟອມນີ້ອີກຄັ້ງເພື່ອສົ່ງຕໍ່.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ຢູ່ຕໍ່</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>ອອກ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ໂໝດອ່ານຢ່າງດຽວ — ສະແດງເປັນຂໍ້ຄວາມ contrast ເຕັມ ແທນ input ທີ່ disabled (ສີຈາງ ອ່ານຍາກ)
function ReadOnlyAnswer({
  question: q,
  value,
  correct,
}: {
  question: FormQuestion;
  value: FormAnswer | undefined;
  // Quiz ທີ່ admin ໃຫ້ເຫັນເສີຍ — ສະແດງທຸກຕົວເລືອກ ພ້ອມໝາຍ ເສີຍ / ທີ່ເລືອກຜິດ (ມີຂໍ້ຄວາມ, ບໍ່ແມ່ນສີຢ່າງດຽວ)
  correct?: string[];
}) {
  if (correct) {
    const picked = new Set(Array.isArray(value) ? value : value === undefined ? [] : [String(value)]);
    const correctIds = new Set(correct);
    return (
      <ul className="space-y-1.5 text-sm">
        {(q.options ?? []).map((o) => {
          const isCorrect = correctIds.has(o.id);
          const isPicked = picked.has(o.id);
          return (
            <li
              key={o.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2",
                isCorrect && "bg-green-50 dark:bg-green-950/40",
                isPicked && !isCorrect && "bg-destructive/10",
              )}
            >
              {isCorrect ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" aria-hidden="true" />
              ) : isPicked ? (
                <X className="text-destructive h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <span className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span className={cn("text-foreground", isPicked && "font-medium")}>{o.label}</span>
              {isPicked && <span className="text-muted-foreground text-xs">(ທ່ານເລືອກ)</span>}
              {isCorrect && <span className="text-xs text-green-700 dark:text-green-400">ຖືກຕ້ອງ</span>}
            </li>
          );
        })}
        {picked.size === 0 && <li className="text-muted-foreground px-3 italic">ບໍ່ໄດ້ຕອບ</li>}
      </ul>
    );
  }

  if (!hasAnswer(value)) {
    return <p className="text-muted-foreground text-sm italic">ບໍ່ໄດ້ຕອບ</p>;
  }
  const labelOf = (id: string) => q.options?.find((o) => o.id === id)?.label ?? id;

  if (q.type === "rating" && typeof value === "number") {
    return (
      <p className="text-foreground text-sm font-medium">
        {value}/{q.ratingMax ?? 5} ຄະແນນ
      </p>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ul className="text-foreground list-inside list-disc space-y-1 text-sm">
        {value.map((id) => (
          <li key={id}>{labelOf(id)}</li>
        ))}
      </ul>
    );
  }
  const text = q.type === "radio" || q.type === "dropdown" ? labelOf(String(value)) : String(value);
  return <p className="text-foreground bg-muted/50 rounded-md px-3 py-2 text-sm whitespace-pre-wrap">{text}</p>;
}

interface QuestionInputProps {
  question: FormQuestion;
  value: FormAnswer | undefined;
  labelledBy: string;
  describedBy?: string;
  invalid: boolean;
  onChange: (value: FormAnswer | undefined) => void;
}

// ຕົວເລືອກ radio / checkbox ແບບ choice card ຂອງ shadcn (FieldLabel > Field) —
// ກົດໄດ້ທັງແຖວ (touch target ໃຫຍ່) ແລະ FieldLabel ໄຮໄລທ໌ເອງເມື່ອເລືອກ
function OptionChoice({ htmlFor, label, children }: { htmlFor: string; label: string; children: ReactNode }) {
  return (
    <FieldLabel htmlFor={htmlFor} className="hover:bg-accent/50 cursor-pointer transition-colors">
      <Field orientation="horizontal">
        {children}
        <FieldContent>
          <FieldTitle className="font-normal">{label}</FieldTitle>
        </FieldContent>
      </Field>
    </FieldLabel>
  );
}

function ClearAnswerButton({ onClear }: { onClear: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground -ml-2 h-8 gap-1">
      <X className="h-3.5 w-3.5" />
      ລ້າງຄຳຕອບ
    </Button>
  );
}

function CharCounter({ length, max }: { length: number; max: number }) {
  // ສະແດງເມື່ອໃກ້ຮອດຂີດ (80%) — ບໍ່ດັ່ງນັ້ນພິມຕໍ່ບໍ່ໄດ້ໂດຍບໍ່ຮູ້ສາເຫດ
  if (length < max * 0.8) return null;
  return (
    <p className={cn("text-right text-xs tabular-nums", length >= max ? "text-destructive" : "text-muted-foreground")}>
      {length}/{max}
    </p>
  );
}

function QuestionInput({ question: q, value, labelledBy, describedBy, invalid, onChange }: QuestionInputProps) {
  const options = q.options ?? [];
  const aria = {
    "aria-labelledby": labelledBy,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    "aria-required": q.required || undefined,
  };
  const canClear = !q.required && hasAnswer(value);

  switch (q.type) {
    case "shortText": {
      const text = typeof value === "string" ? value : "";
      return (
        <div className="space-y-1">
          <Input
            {...aria}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            maxLength={SHORT_TEXT_MAX}
            placeholder="ຄຳຕອບຂອງທ່ານ"
          />
          <CharCounter length={text.length} max={SHORT_TEXT_MAX} />
        </div>
      );
    }
    case "longText": {
      const text = typeof value === "string" ? value : "";
      return (
        <div className="space-y-1">
          <Textarea
            {...aria}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            maxLength={LONG_TEXT_MAX}
            placeholder="ຄຳຕອບຂອງທ່ານ"
            rows={4}
          />
          <CharCounter length={text.length} max={LONG_TEXT_MAX} />
        </div>
      );
    }
    case "radio":
      return (
        <div className="space-y-2">
          <RadioGroup
            {...aria}
            value={typeof value === "string" ? value : ""}
            onValueChange={onChange}
            className="gap-2"
          >
            {options.map((o) => (
              <OptionChoice key={o.id} htmlFor={`${q.id}-${o.id}`} label={o.label}>
                <RadioGroupItem value={o.id} id={`${q.id}-${o.id}`} />
              </OptionChoice>
            ))}
          </RadioGroup>
          {canClear && <ClearAnswerButton onClear={() => onChange(undefined)} />}
        </div>
      );
    case "checkbox": {
      const picked = Array.isArray(value) ? value : [];
      return (
        // role="group" ບໍ່ຮອງຮັບ aria-required / aria-invalid — ໃຫ້ແຕ່ label + error
        <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="space-y-2">
          {options.map((o) => (
            <OptionChoice key={o.id} htmlFor={`${q.id}-${o.id}`} label={o.label}>
              <Checkbox
                id={`${q.id}-${o.id}`}
                checked={picked.includes(o.id)}
                onCheckedChange={(checked) =>
                  onChange(checked === true ? [...picked, o.id] : picked.filter((id) => id !== o.id))
                }
              />
            </OptionChoice>
          ))}
        </div>
      );
    }
    case "dropdown":
      return (
        <div className="space-y-2">
          <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
            <SelectTrigger {...aria} className="w-full sm:w-72">
              <SelectValue placeholder="ເລືອກ" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canClear && <ClearAnswerButton onClear={() => onChange(undefined)} />}
        </div>
      );
    case "rating":
      return (
        <div className="space-y-2">
          <RatingInput
            max={q.ratingMax ?? 5}
            value={typeof value === "number" ? value : 0}
            aria={aria}
            onChange={onChange}
          />
          {canClear && <ClearAnswerButton onClear={() => onChange(undefined)} />}
        </div>
      );
  }
}

// ຄະແນນ: <= 5 ໃຊ້ດາວ (shadcn ບໍ່ມີ — radiogroup ທີ່ຂຽນເອງ, ໃຊ້ປຸ່ມລູກສອນໄດ້),
// > 5 ໃຊ້ ToggleGroup ຂອງ shadcn ເປັນປຸ່ມຕົວເລກ (ດາວ 10 ດວງນ້ອຍເກີນກົດໃນມືຖື)
function RatingInput(props: {
  max: number;
  value: number;
  aria: Record<string, string | boolean | undefined>;
  onChange: (value: number) => void;
}) {
  if (props.max <= 5) return <StarRating {...props} />;
  const { max, value, aria, onChange } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="lg"
        value={value > 0 ? String(value) : ""}
        // ກົດອັນເກົ່າຊ້ຳ = Radix ສົ່ງ "" — ບໍ່ລ້າງ (ລ້າງດ້ວຍປຸ່ມ "ລ້າງຄຳຕອບ")
        onValueChange={(v) => v && onChange(Number(v))}
        className="w-full sm:w-auto"
        {...aria}
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <ToggleGroupItem
            key={n}
            value={String(n)}
            aria-label={`${n} ຄະແນນ`}
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 tabular-nums"
          >
            {n}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {value > 0 && (
        <span className="text-muted-foreground text-sm">
          {value}/{max}
        </span>
      )}
    </div>
  );
}

function StarRating({
  max,
  value,
  aria,
  onChange,
}: {
  max: number;
  value: number;
  aria: Record<string, string | boolean | undefined>;
  onChange: (value: number) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(max, Math.max(1, (value || 0) + step));
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" {...aria} onKeyDown={onKeyDown}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const checked = n === value;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${n} ຄະແນນ`}
            // roving tabindex: Tab ເຂົ້າມາທີ່ອັນທີ່ເລືອກ (ຫຼື ອັນທຳອິດ), ລູກສອນເລື່ອນໃນກຸ່ມ
            tabIndex={checked || (value === 0 && n === 1) ? 0 : -1}
            onClick={() => onChange(n)}
            className="focus-visible:ring-ring/50 flex min-h-11 min-w-11 items-center justify-center rounded-md outline-none focus-visible:ring-[3px]"
          >
            <Star
              className={cn("h-8 w-8", n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
            />
          </button>
        );
      })}
      {value > 0 && (
        <span className="text-muted-foreground ml-1 text-sm">
          {value}/{max}
        </span>
      )}
    </div>
  );
}
