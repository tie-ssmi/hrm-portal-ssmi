"use client";

// ** core
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ** assets / icons
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Save,
  Plus,
  Trash2,
  User,
  MapPin,
  GraduationCap,
  Phone,
  Droplets,
  Image as ImageIcon,
  FilePlus,
  Upload,
} from "lucide-react";

// ** shared components
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import ProfileSkeleton from "@/components/skeletons/profileSkeleton";
import { uploadImageFile } from "@/components/cameraUpload";

// ** third party
import { toast } from "sonner";
import { format } from "date-fns";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import { updateEmployeeProfile } from "@/lib/employees";
import { cn } from "@/lib/utils";
import type { Employee, EducationEntry, DocEntry } from "@/lib/types";
import { LAO_PROVINCES } from "@/public/data/laos-provinces";

const GENDERS: ComboboxOption[] = [
  { value: "Male", label: "ຊາຍ" },
  { value: "Female", label: "ຍິງ" },
  { value: "Other", label: "ອື່ນໆ" },
];
const MARITAL_STATUSES: ComboboxOption[] = [
  { value: "Single", label: "ໂສດ" },
  { value: "Married", label: "ແຕ່ງງານແລ້ວ" },
  { value: "Divorced", label: "ຢ່າຮ້າງ" },
  { value: "Widowed", label: "ເປັນຫມ້າຍ" },
];
const RELIGIONS = ["ພຸດ", "ຜີ", "ຄຣິດ", "ອິສລາມ", "Other"];
const ETHNICITIES = ["ລາວ", "ກຸມມຸ", "ມົ້ງ"];
const BLOOD_TYPES = ["A", "B", "AB", "O", "ບໍ່ຮູ້"];
const EDUCATION_LEVELS = [
  "ມັດທະຍົມຕົ້ນ",
  "ມັດທະຍົມປາຍ",
  "ປະກາສະນີຍະບັດ",
  "ອະນຸປະລິນຍາ",
  "ປະລິນຍາຕີ",
  "ປະລິນຍາໂທ",
  "ປະລິນຍາເອກ",
];
const DRIVING_LICENSE_TYPES: ComboboxOption[] = [
  { value: "None", label: "ບໍ່ມີ" },
  { value: "A", label: "A" },
  { value: "AB", label: "AB" },
  { value: "ABC", label: "ABC" },
  { value: "ABCD", label: "ABCD" },
  { value: "E", label: "E" },
];

function toOptions(values: string[]): ComboboxOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

// keeps the currently-stored value selectable even if it falls outside the enumerated list
function withCurrentValue(
  options: ComboboxOption[],
  current: string,
): ComboboxOption[] {
  if (!current || options.some((o) => o.value === current)) return options;
  return [{ value: current, label: current }, ...options];
}

const createEmptyEducationEntry = (): EducationEntry => ({
  education: "",
  major: "",
  graduatedFrom: "",
});

type DocFormEntry = DocEntry & { id: string };

const createEmptyDocEntry = (): DocFormEntry => ({
  id: crypto.randomUUID(),
  name: "",
  url: "",
  addAt: new Date().toISOString(),
});

type EditableFields = {
  firstNameLo: string;
  lastNameLo: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  maritalStatus: string;
  religion: string;
  ethnicity: string;
  tel: string;
  provinceOfBirth: string;
  cityOfBirth: string;
  placeOfBirth: string;
  numberOfFamilyMembers: string;
  emergencyContactNumber: string;
  drivingLicenseType: string;
  idCardPhotoUrl: string;
  photo3x4Url: string;
  criminalRecordUrl: string;
  declarationUrl: string;
  educations: EducationEntry[];
  docs: DocFormEntry[];
};

type ScalarFieldKey = Exclude<keyof EditableFields, "educations" | "docs">;

const SCALAR_FIELD_KEYS: ScalarFieldKey[] = [
  "firstNameLo",
  "lastNameLo",
  "dateOfBirth",
  "gender",
  "bloodType",
  "maritalStatus",
  "religion",
  "ethnicity",
  "tel",
  "provinceOfBirth",
  "cityOfBirth",
  "placeOfBirth",
  "numberOfFamilyMembers",
  "emergencyContactNumber",
  "drivingLicenseType",
  "idCardPhotoUrl",
  "photo3x4Url",
  "criminalRecordUrl",
  "declarationUrl",
];

function toFormValue(profileUser: Employee | null): EditableFields {
  const educations =
    profileUser?.educations && profileUser.educations.length > 0
      ? profileUser.educations
      : profileUser?.education ||
          profileUser?.major ||
          profileUser?.graduatedFrom
        ? [
            {
              education: profileUser?.education || "",
              major: profileUser?.major || "",
              graduatedFrom: profileUser?.graduatedFrom || "",
            },
          ]
        : [createEmptyEducationEntry()];

  const docs: DocFormEntry[] = (profileUser?.docs || []).map((d) => ({
    id: crypto.randomUUID(),
    name: d.name || "",
    url: d.url || "",
    addAt: d.addAt || new Date().toISOString(),
  }));

  return {
    firstNameLo: profileUser?.firstNameLo || "",
    lastNameLo: profileUser?.lastNameLo || "",
    dateOfBirth: profileUser?.dateOfBirth || "",
    gender: profileUser?.gender || "",
    bloodType: profileUser?.bloodType || "",
    maritalStatus: profileUser?.maritalStatus || "",
    religion: profileUser?.religion || "",
    ethnicity: profileUser?.ethnicity || "",
    tel: profileUser?.tel || "",
    provinceOfBirth: profileUser?.provinceOfBirth || "",
    cityOfBirth: profileUser?.cityOfBirth || "",
    placeOfBirth: profileUser?.placeOfBirth || "",
    numberOfFamilyMembers: profileUser?.numberOfFamilyMembers || "",
    emergencyContactNumber: profileUser?.emergencyContactNumber || "",
    drivingLicenseType: profileUser?.drivingLicenseType || "",
    idCardPhotoUrl: profileUser?.idCardPhotoUrl || "",
    photo3x4Url: profileUser?.photo3x4Url || "",
    criminalRecordUrl: profileUser?.criminalRecordUrl || "",
    declarationUrl: profileUser?.declarationUrl || "",
    educations,
    docs,
  };
}

const LAO_PHONE_REGEX =
  /^(020|030|021|031|032|033|034|041|042|050|054|055|056|058|071|072)\d{7,8}$/;

function DocUploadSlot({
  uid,
  folder,
  value,
  label,
  onUploaded,
}: {
  uid: string;
  folder: string;
  value: string;
  label: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSelect = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ");
      return;
    }
    try {
      setUploading(true);
      setProgress(0);
      const url = await uploadImageFile({
        file,
        uid,
        folder,
        onProgress: setProgress,
      });
      onUploaded(url);
      toast.success("ອັບໂຫຼດສໍາເລັດ");
    } catch (err) {
      toast.error("ອັບໂຫຼດບໍ່ສໍາເລັດ");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="h-32 w-full rounded-md border object-cover"
          />
        </a>
      ) : (
        <div className="text-muted-foreground flex h-32 w-full items-center justify-center rounded-md border border-dashed text-xs">
          ຍັງບໍ່ມີຮູບ
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          `${progress}%`
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {value ? "ອັບໂຫຼດໃໝ່" : "ອັບໂຫຼດ"}
          </>
        )}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0])}
      />
    </div>
  );
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user, firebaseUser, updateProfile } = useAuth();
  const profileUser: Employee | null = user;

  const [form, setForm] = useState<EditableFields>(() => toFormValue(null));
  const [originalForm, setOriginalForm] = useState<EditableFields>(() =>
    toFormValue(null),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [telError, setTelError] = useState("");

  useEffect(() => {
    if (profileUser) {
      const initial = toFormValue(profileUser);
      setForm(initial);
      setOriginalForm(initial);
    }
  }, [profileUser]);

  const setField = <K extends keyof EditableFields>(
    key: K,
    value: EditableFields[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const districtOptions = useMemo<ComboboxOption[]>(() => {
    const province = LAO_PROVINCES.find((p) => p.name === form.provinceOfBirth);
    return toOptions(province?.districts.map((d) => d.name) || []);
  }, [form.provinceOfBirth]);

  const setEducationField = (
    index: number,
    key: keyof EducationEntry,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      educations: prev.educations.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const addEducationEntry = () =>
    setForm((prev) => ({
      ...prev,
      educations: [...prev.educations, createEmptyEducationEntry()],
    }));

  const removeEducationEntry = (index: number) =>
    setForm((prev) => ({
      ...prev,
      educations:
        prev.educations.length === 1
          ? [createEmptyEducationEntry()]
          : prev.educations.filter((_, i) => i !== index),
    }));

  const setDocField = (
    index: number,
    key: keyof Omit<DocFormEntry, "id">,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      docs: prev.docs.map((d, i) => (i === index ? { ...d, [key]: value } : d)),
    }));
  };

  const addExtraDoc = () =>
    setForm((prev) => ({
      ...prev,
      docs: [...prev.docs, createEmptyDocEntry()],
    }));

  const removeExtraDoc = (index: number) =>
    setForm((prev) => ({
      ...prev,
      docs: prev.docs.filter((_, i) => i !== index),
    }));

  if (!profileUser) {
    return <ProfileSkeleton />;
  }

  const uid = firebaseUser?.uid || profileUser.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) {
      toast.error("ບໍ່ພົບຂໍ້ມູນຜູ້ໃຊ້");
      return;
    }
    if (form.tel.trim() && !LAO_PHONE_REGEX.test(form.tel.replace(/\s/g, ""))) {
      setTelError("ຮູບແບບເບີໂທບໍ່ຖືກຕ້ອງ (ຕົວຢ່າງ: 02012345678)");
      return;
    }
    setTelError("");

    // only submit fields that actually changed, so stale form state never clobbers untouched data
    const updates: Partial<Employee> = {};
    for (const key of SCALAR_FIELD_KEYS) {
      if (form[key] !== originalForm[key]) {
        updates[key] = form[key];
      }
    }

    const normalizedEducations = form.educations.filter(
      (item) => item.education || item.major || item.graduatedFrom,
    );
    const originalEducations = originalForm.educations.filter(
      (item) => item.education || item.major || item.graduatedFrom,
    );
    if (
      JSON.stringify(normalizedEducations) !==
      JSON.stringify(originalEducations)
    ) {
      const primaryEducation =
        normalizedEducations[0] || createEmptyEducationEntry();
      updates.educations = normalizedEducations;
      updates.education = primaryEducation.education;
      updates.major = primaryEducation.major;
      updates.graduatedFrom = primaryEducation.graduatedFrom;
    }

    const normalizedDocs: DocEntry[] = form.docs
      .filter((d) => d.name || d.url)
      .map(({ name, url, addAt }) => ({ name, url, addAt }));
    const originalDocs: DocEntry[] = originalForm.docs
      .filter((d) => d.name || d.url)
      .map(({ name, url, addAt }) => ({ name, url, addAt }));
    if (JSON.stringify(normalizedDocs) !== JSON.stringify(originalDocs)) {
      updates.docs = normalizedDocs;
    }

    if (Object.keys(updates).length === 0) {
      toast.info("ບໍ່ມີການປ່ຽນແປງ");
      router.back();
      return;
    }

    setIsSubmitting(true);
    try {
      await updateEmployeeProfile(uid, updates, {
        name:
          [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
            .filter(Boolean)
            .join(" ") || undefined,
        roleUuid: user?.rolesUid,
        roleName: user?.rolesName,
        workLocation: user?.workLocation,
      });
      updateProfile(updates);
      toast.success("ອັບເດດຂໍ້ມູນສ່ວນຕົວສໍາເລັດ");
      router.back();
    } catch (err) {
      toast.error("ບໍ່ສາມາດອັບເດດຂໍ້ມູນໄດ້");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dobDate = form.dateOfBirth ? new Date(form.dateOfBirth) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="border-input hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-transparent shadow-sm transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            ແກ້ໄຂຂໍ້ມູນສ່ວນຕົວ
          </h1>
          <p className="text-muted-foreground text-sm">
            ອັບເດດຂໍ້ມູນສ່ວນຕົວຂອງທ່ານ
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            ຍົກເລີກ
          </Button>
          <Button type="submit" className="gap-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <Spinner className="mr-2" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            ບັນທຶກຂໍ້ມູນ
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Personal information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="text-primary h-4 w-4" />
                ຂໍ້ມູນສ່ວນຕົວ
              </CardTitle>
              <CardDescription>ຊື່, ເພດ ແລະ ວັນເດືອນປີເກີດ</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>ຊື່ (ພາສາລາວ)</FieldLabel>
                    <Input
                      value={form.firstNameLo}
                      onChange={(e) => setField("firstNameLo", e.target.value)}
                      placeholder="ຊື່"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>ນາມສະກຸນ (ພາສາລາວ)</FieldLabel>
                    <Input
                      value={form.lastNameLo}
                      onChange={(e) => setField("lastNameLo", e.target.value)}
                      placeholder="ນາມສະກຸນ"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>ເພດ</FieldLabel>
                    <Combobox
                      value={form.gender}
                      onValueChange={(v) => setField("gender", v)}
                      options={withCurrentValue(GENDERS, form.gender)}
                      placeholder="ເລືອກ ເພດ"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>ວັນເກີດ</FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dobDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dobDate
                            ? format(dobDate, "dd/MM/yyyy")
                            : "ເລືອກວັນທີ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dobDate}
                          captionLayout="dropdown"
                          onSelect={(date) =>
                            setField(
                              "dateOfBirth",
                              date ? format(date, "yyyy-MM-dd") : "",
                            )
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                  <Field>
                    <FieldLabel>ຊົນເຜົ່າ</FieldLabel>
                    <Combobox
                      value={form.ethnicity}
                      onValueChange={(v) => setField("ethnicity", v)}
                      options={withCurrentValue(
                        toOptions(ETHNICITIES),
                        form.ethnicity,
                      )}
                      placeholder="ເລືອກ ຊົນເຜົ່າ"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>ສາສະໜາ</FieldLabel>
                    <Combobox
                      value={form.religion}
                      onValueChange={(v) => setField("religion", v)}
                      options={withCurrentValue(
                        toOptions(RELIGIONS),
                        form.religion,
                      )}
                      placeholder="ເລືອກ ສາສະໜາ"
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="text-primary h-4 w-4" />
                ຂໍ້ມູນຕິດຕໍ່
              </CardTitle>
              <CardDescription>ເບີໂທ ແລະ ອີເມວ</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>ເບີໂທ</FieldLabel>
                    <Input
                      value={form.tel}
                      inputMode="numeric"
                      onChange={(e) => {
                        setField("tel", e.target.value.replace(/\D/g, ""));
                        setTelError("");
                      }}
                      placeholder="02012345678"
                      className={telError ? "border-destructive" : ""}
                    />
                    {telError && (
                      <p className="text-destructive text-xs">{telError}</p>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel>ຕິດຕໍ່ສຸກເສີນ</FieldLabel>
                    <Input
                      value={form.emergencyContactNumber}
                      onChange={(e) =>
                        setField("emergencyContactNumber", e.target.value)
                      }
                      placeholder="ເບີໂທຕິດຕໍ່ສຸກເສີນ"
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>ອີເມວ</FieldLabel>
                    <Input value={profileUser.email} disabled />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Birth & family */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="text-primary h-4 w-4" />
                ທີ່ຢູ່ ແລະ ຄອບຄົວ
              </CardTitle>
              <CardDescription>ບ້ານເກີດ ແລະ ຂໍ້ມູນຄອບຄົວ</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>ແຂວງເກີດ</FieldLabel>
                    <Combobox
                      value={form.provinceOfBirth}
                      onValueChange={(v) => {
                        setField("provinceOfBirth", v);
                        setField("cityOfBirth", "");
                      }}
                      options={withCurrentValue(
                        toOptions(LAO_PROVINCES.map((p) => p.name)),
                        form.provinceOfBirth,
                      )}
                      placeholder="ເລືອກ ແຂວງ"
                      searchPlaceholder="ຄົ້ນຫາແຂວງ..."
                    />
                  </Field>
                  <Field>
                    <FieldLabel>ເມືອງເກີດ</FieldLabel>
                    <Combobox
                      value={form.cityOfBirth}
                      onValueChange={(v) => {
                        setField("cityOfBirth", v);
                        setField("placeOfBirth", "");
                      }}
                      options={withCurrentValue(
                        districtOptions,
                        form.cityOfBirth,
                      )}
                      placeholder={
                        form.provinceOfBirth
                          ? "ເລືອກ ເມືອງ"
                          : "ກະລຸນາເລືອກແຂວງກ່ອນ"
                      }
                      searchPlaceholder="ຄົ້ນຫາເມືອງ..."
                      disabled={!form.provinceOfBirth}
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>ສະຖານທີ່ເກີດ / ບ້ານເກີດ</FieldLabel>
                    <Input
                      value={form.placeOfBirth}
                      onChange={(e) => setField("placeOfBirth", e.target.value)}
                      placeholder="ບ້ານເກີດ"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>ສະຖານະ</FieldLabel>
                    <Combobox
                      value={form.maritalStatus}
                      onValueChange={(v) => setField("maritalStatus", v)}
                      options={withCurrentValue(
                        MARITAL_STATUSES,
                        form.maritalStatus,
                      )}
                      placeholder="ເລືອກ ສະຖານະ"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>ຈຳນວນສະມາຊິກຄອບຄົວ</FieldLabel>
                    <Input
                      value={form.numberOfFamilyMembers}
                      onChange={(e) =>
                        setField("numberOfFamilyMembers", e.target.value)
                      }
                      placeholder="ຈຳນວນສະມາຊິກຄອບຄົວ"
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Health & other */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Droplets className="text-primary h-4 w-4" />
                ຂໍ້ມູນອື່ນໆ
              </CardTitle>
              <CardDescription>ປະເພດເລືອດ ແລະ ໃບຂັບລົດ</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>ກຸ່ມເລືອດ</FieldLabel>
                    <Combobox
                      value={form.bloodType}
                      onValueChange={(v) => setField("bloodType", v)}
                      options={withCurrentValue(
                        toOptions(BLOOD_TYPES),
                        form.bloodType,
                      )}
                      placeholder="ເລືອກ ກຸ່ມເລືອດ"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>ໃບຂັບຂີ່</FieldLabel>
                    <Combobox
                      value={form.drivingLicenseType}
                      onValueChange={(v) => setField("drivingLicenseType", v)}
                      options={withCurrentValue(
                        DRIVING_LICENSE_TYPES,
                        form.drivingLicenseType,
                      )}
                      placeholder="ເລືອກ ໃບຂັບຂີ່"
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          {/* Education */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="text-primary h-4 w-4" />
                  ການສຶກສາ
                </CardTitle>
                <CardDescription>ລະດັບການສຶກສາ ແລະ ສາຂາວິຊາ</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addEducationEntry}
              >
                <Plus className="h-4 w-4" />
                ເພີ່ມການສຶກສາ
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.educations.map((item, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel>ລະດັບການສຶກສາ</FieldLabel>
                      <Combobox
                        value={item.education || ""}
                        onValueChange={(v) =>
                          setEducationField(index, "education", v)
                        }
                        options={withCurrentValue(
                          toOptions(EDUCATION_LEVELS),
                          item.education || "",
                        )}
                        placeholder="ເລືອກ ລະດັບການສຶກສາ"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>ສາຂາວິຊາ</FieldLabel>
                      <Input
                        value={item.major || ""}
                        onChange={(e) =>
                          setEducationField(index, "major", e.target.value)
                        }
                        placeholder="ສາຂາວິຊາ"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>ຈາກສະຖາບັນ</FieldLabel>
                      <Input
                        value={item.graduatedFrom || ""}
                        onChange={(e) =>
                          setEducationField(
                            index,
                            "graduatedFrom",
                            e.target.value,
                          )
                        }
                        placeholder="ຊື່ສະຖາບັນການສຶກສາ"
                      />
                    </Field>
                  </div>
                  {form.educations.length > 1 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/40 hover:bg-destructive hover:text-white"
                        onClick={() => removeEducationEntry(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                        ລຶບ
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="text-primary h-4 w-4" />
                ເອກະສານ
              </CardTitle>
              <CardDescription>ຮູບບັດປະຈຳຕົວ ແລະ ຮູບ 3x4</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <DocUploadSlot
                  uid={uid}
                  folder="images/idCards"
                  value={form.idCardPhotoUrl}
                  label="ຮູບບັດປະຈຳຕົວ"
                  onUploaded={(url) => setField("idCardPhotoUrl", url)}
                />
                <DocUploadSlot
                  uid={uid}
                  folder="images/photo3x4"
                  value={form.photo3x4Url}
                  label="ຮູບ 3x4"
                  onUploaded={(url) => setField("photo3x4Url", url)}
                />
                <DocUploadSlot
                  uid={uid}
                  folder="images/criminalRecords"
                  value={form.criminalRecordUrl}
                  label="ໃບແຈ້ງໂທດ"
                  onUploaded={(url) => setField("criminalRecordUrl", url)}
                />
                <DocUploadSlot
                  uid={uid}
                  folder="images/declarations"
                  value={form.declarationUrl}
                  label="ໃບປະກາດ"
                  onUploaded={(url) => setField("declarationUrl", url)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Extra documents */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="text-primary h-4 w-4" />
                  ເອກະສານອື່ນໆ
                </CardTitle>
                <CardDescription>ເອກະສານອື່ນໆ ຖ້າມີ</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addExtraDoc}
              >
                <FilePlus className="h-4 w-4" />
                ເພີ່ມເອກະສານ
              </Button>
            </CardHeader>
            <CardContent>
              {form.docs.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  ກົດ &quot;ເພີ່ມເອກະສານ&quot; ເພື່ອເພີ່ມເອກະສານ
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {form.docs.map((doc, index) => (
                    <div
                      key={doc.id}
                      className="relative space-y-3 rounded-lg border p-4"
                    >
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive absolute top-2 right-2"
                        onClick={() => removeExtraDoc(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Input
                        value={doc.name}
                        onChange={(e) =>
                          setDocField(index, "name", e.target.value)
                        }
                        placeholder="ຊື່ເອກະສານ"
                      />
                      <DocUploadSlot
                        uid={uid}
                        folder="images/docs"
                        value={doc.url}
                        label="ໄຟລ໌"
                        onUploaded={(url) => setDocField(index, "url", url)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
