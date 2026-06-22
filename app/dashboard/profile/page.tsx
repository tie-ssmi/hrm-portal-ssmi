"use client";

// ** core
import { useState, useMemo, useCallback, memo, lazy, Suspense } from "react";
import type { ElementType } from "react";

// ** assets / icons
import {
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Calendar,
  MapPin,
  Heart,
  GraduationCap,
  Users,
  IdCard,
  DollarSign,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";

// ** shared components
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ProfileSkeleton from "@/components/skeletons/profileSkeleton";
import { NumberFormatter } from "@/components/formatNumber";
import { formatDateLao } from "@/components/laoDate";

// ** lazy — Dialog + FileUpload ບໍ່ຕ້ອງ load ທັນທີ (1 chunk ແທນ 5)
const FileUpload = lazy(() => import("@/components/cameraUpload"));
const ImageDialog = lazy(() =>
  import("@/components/ui/dialog").then((m) => {
    function ImageDialogWrapper({ open, onOpenChange, trigger, src, alt }: {
      open: boolean;
      onOpenChange: (v: boolean) => void;
      trigger: React.ReactNode;
      src: string;
      alt: string;
    }) {
      return (
        <m.Dialog open={open} onOpenChange={onOpenChange}>
          <m.DialogTrigger asChild>{trigger}</m.DialogTrigger>
          <m.DialogContent className="max-h-[80vh] max-w-md p-2">
            <m.DialogTitle className="sr-only">ຮູບໂປຣໄຟລ໌</m.DialogTitle>
            <img src={src} alt={alt} className="h-auto w-full rounded-md object-contain" />
          </m.DialogContent>
        </m.Dialog>
      );
    }
    return { default: ImageDialogWrapper };
  }),
);

// ** third party
import { toast } from "sonner";

// ** config / utils / types / hooks
import { useAuth } from "@/lib/auth-context";
import type { EducationEntry, Employee } from "@/lib/types";

function toStr(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(
      obj.nameLo || obj.name || obj.code || obj.uuid || JSON.stringify(value),
    );
  }
  return String(value);
}

type InfoField = {
  label: string;
  value: string;
  icon: ElementType;
};

function formatDepartment(value: unknown): string {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const name = toStr(obj.department);
    const title = toStr(obj.title);
    if (name !== "-" && title !== "-") return `${name} (${title})`;
    return name !== "-" ? name : title;
  }
  return toStr(value);
}

function resolveProfileImage(value: unknown, uid?: string): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const byUid = uid
      ? (obj[uid] as Record<string, unknown> | undefined)
      : undefined;
    const nested = byUid?.profileImage;
    if (typeof nested === "string") return nested;
  }
  return "";
}

const InfoGrid = memo(function InfoGrid({ fields }: { fields: InfoField[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {fields.map((f, i) => (
        <div
          key={i}
          className="bg-muted/30 flex items-start gap-3 rounded-lg p-3"
        >
          <div className="bg-background flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <f.icon className="text-muted-foreground h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">{f.label}</p>
            <p className="text-foreground truncate text-sm font-medium">
              {f.value || "-"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});

function buildEducationFields(profileUser: Employee | null): InfoField[] {
  const educations = Array.isArray(profileUser?.educations)
    ? (profileUser?.educations as EducationEntry[])
    : [];

  if (educations.length === 0) {
    return [
      { label: "ລະດັບການສຶກສາ", value: toStr(profileUser?.education), icon: GraduationCap },
      { label: "ສະຖາບັນທີ່ຈົບການສຶກສາ", value: toStr(profileUser?.graduatedFrom), icon: GraduationCap },
      { label: "ສາຂາວິຊາ", value: toStr(profileUser?.major), icon: GraduationCap },
      { label: "ໃບຂັບຂີ່", value: toStr(profileUser?.drivingLicenseType), icon: IdCard },
    ];
  }

  const fields: InfoField[] = educations.flatMap((item, index) => [
    { label: `ລະດັບການສຶກສາ (${index + 1})`, value: toStr(item.education), icon: GraduationCap },
    { label: `ສະຖາບັນທີ່ຈົບການສຶກສາ (${index + 1})`, value: toStr(item.graduatedFrom), icon: GraduationCap },
    { label: `ສາຂາວິຊາ (${index + 1})`, value: toStr(item.major), icon: GraduationCap },
  ]);

  fields.push({ label: "ໃບຂັບຂີ່", value: toStr(profileUser?.drivingLicenseType), icon: IdCard });
  return fields;
}

const EmploymentRow = memo(function EmploymentRow({ field }: { field: InfoField }) {
  return (
    <div>
      <div className="flex items-center gap-3 py-2">
        <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <field.icon className="text-muted-foreground h-4 w-4" />
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{field.label}</p>
          <p className="text-foreground text-sm font-medium">{field.value || "-"}</p>
        </div>
      </div>
      <div className="border-border border-t" />
    </div>
  );
});

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth();
  const [showSalary, setShowSalary] = useState(false);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  const profileUser: Employee | null = user;

  const initials = useMemo(() =>
    profileUser
      ? `${(profileUser.firstNameEn || profileUser.firstName)[0] ?? ""}${(profileUser.lastNameEn || profileUser.lastName)[0] ?? ""}`.toUpperCase()
      : "U",
  [profileUser]);

  const avatarSrc = useMemo(() =>
    uploadedAvatarUrl ||
    resolveProfileImage(profileUser?.profileImage, firebaseUser?.uid) ||
    profileUser?.photo3x4Url ||
    profileUser?.avatar ||
    (toStr(profileUser?.gender).toLowerCase() === "male" ? "/info/man.jpg" : "/info/woman.jpg"),
  [uploadedAvatarUrl, profileUser, firebaseUser?.uid]);

  const handleAvatarUploaded = useCallback((url: string) => {
    setUploadedAvatarUrl(url);
    toast.success("ຮູບໂປຣໄຟລ໌ຖືກອັບເດດແລ້ວ");
  }, []);

  const toggleSalary = useCallback(() => setShowSalary((v) => !v), []);

  const employmentFields = useMemo<InfoField[]>(() => [
    { label: "ລະຫັດພະນັກງານ", value: toStr(profileUser?.employeeId), icon: User },
    { label: "ອີເມວ", value: toStr(profileUser?.email), icon: Mail },
    { label: "ເບີໂທ", value: toStr(profileUser?.tel || profileUser?.phone), icon: Phone },
    { label: "ຕຳແໜ່ງວຽກ", value: toStr(profileUser?.jobTitle || profileUser?.position), icon: Briefcase },
    { label: "ພະແນກ", value: formatDepartment(profileUser?.department), icon: Layers },
    { label: "ສະຖານທີ່ທຳວຽກ", value: toStr(profileUser?.workLocation), icon: Building },
    { label: "ປະເພດພະນັກງານ", value: toStr(profileUser?.employeeType), icon: IdCard },
  ], [profileUser]);

  const salaryDisplay = useMemo(() =>
    profileUser?.salary ? toStr(NumberFormatter.NoZero(profileUser.salary)) + " ກີບ" : "-",
  [profileUser?.salary]);

  const personalFields = useMemo<InfoField[]>(() => [
    { label: "ຊື່ (ພາສາອັງກິດ)", value: `${profileUser?.firstNameEn || profileUser?.firstName} ${profileUser?.lastNameEn || profileUser?.lastName}`, icon: User },
    { label: "ຊື່ (ພາສາລາວ)", value: profileUser?.firstNameLo && profileUser?.lastNameLo ? `${profileUser.firstNameLo} ${profileUser.lastNameLo}` : "-", icon: User },
    { label: "ວັນເກີດ", value: profileUser?.dateOfBirth ? formatDateLao(new Date(profileUser.dateOfBirth)) : "-", icon: Calendar },
    { label: "ເພດ", value: toStr(profileUser?.gender), icon: User },
    { label: "ກຸ່ມເລືອດ", value: toStr(profileUser?.bloodType), icon: Heart },
    { label: "ສະຖານະ", value: toStr(profileUser?.maritalStatus), icon: Users },
    { label: "ສາສະໜາ", value: toStr(profileUser?.religion), icon: User },
    { label: "ຊາດ", value: toStr(profileUser?.ethnicity), icon: User },
  ], [profileUser]);

  const originFields = useMemo<InfoField[]>(() => [
    { label: "ແຂວງເກີດ", value: toStr(profileUser?.provinceOfBirth), icon: MapPin },
    { label: "ເມືອງເກີດ", value: toStr(profileUser?.cityOfBirth), icon: MapPin },
    { label: "ສະຖານທີ່ເກີດ", value: toStr(profileUser?.placeOfBirth), icon: MapPin },
    { label: "ຈຳນວນສະມາຊິກຄອບຄົວ", value: toStr(profileUser?.numberOfFamilyMembers), icon: Users },
    { label: "ຕິດຕໍ່ສຸກເສີນ", value: toStr(profileUser?.emergencyContactNumber), icon: Phone },
  ], [profileUser]);

  const educationFields = useMemo(() => buildEducationFields(profileUser), [profileUser]);

  if (!profileUser) {
    return <ProfileSkeleton />;
  }

  const fullNameEn = `${profileUser.firstNameEn || profileUser.firstName} ${profileUser.lastNameEn || profileUser.lastName}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">ຂໍ້ມູນສ່ວນຕົວ</h1>
        <p className="text-muted-foreground">ເບິ່ງແລະຮ້ອງຂໍການອັບເດດຂໍ້ມູນສ່ວນຕົວຂອງທ່ານ</p>
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24">
              <Suspense fallback={
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarSrc} alt={fullNameEn} className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
                </Avatar>
              }>
                <ImageDialog
                  open={isImageDialogOpen}
                  onOpenChange={setIsImageDialogOpen}
                  src={avatarSrc}
                  alt={fullNameEn}
                  trigger={
                    <button
                      type="button"
                      className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none"
                      aria-label="View profile image"
                    >
                      <Avatar className="h-24 w-24 cursor-zoom-in">
                        <AvatarImage src={avatarSrc} alt={fullNameEn} className="object-cover" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
                      </Avatar>
                    </button>
                  }
                />
              </Suspense>
              <div className="absolute -right-1 -bottom-1 z-20">
                <Suspense fallback={<div className="h-9 w-9" />}>
                  <FileUpload
                    uid={firebaseUser?.uid || profileUser.id || ""}
                    className="border-background h-9 w-9 border-2 bg-black/70"
                    onUploaded={handleAvatarUploaded}
                  />
                </Suspense>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-foreground text-xl font-semibold">{fullNameEn}</h2>
              {profileUser.firstNameLo && profileUser.lastNameLo && (
                <p className="text-foreground/80 text-lg">
                  {profileUser.firstNameLo} {profileUser.lastNameLo}
                </p>
              )}
              <p className="text-muted-foreground">
                {toStr(profileUser.jobTitle || profileUser.position)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {toStr(profileUser.workLocation || profileUser.department)}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge variant="secondary">{toStr(profileUser.employeeId)}</Badge>
                {profileUser.employeeType && (
                  <Badge variant="outline">{toStr(profileUser.employeeType)}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ຂໍ້ມູນການຈ້າງງານ</CardTitle>
          <CardDescription>ບາງຟິວລິດຈຳເປັນຕ້ອງຮັບການອະນຸມັດຈາກ HR ເພື່ອອັບເດດ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {employmentFields.map((f, i) => (
              <EmploymentRow key={i} field={f} />
            ))}
            <div>
              <div className="flex items-center gap-3 py-2">
                <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <DollarSign className="text-muted-foreground h-4 w-4" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">ເງິນເດືອນ</p>
                  <div className="flex items-center gap-2">
                    <p className="text-foreground text-sm font-medium">
                      {showSalary ? salaryDisplay : "••••••••"}
                    </p>
                    <button
                      onClick={toggleSalary}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSalary ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ຂໍ້ມູນສ່ວນຕົວ</CardTitle>
          <CardDescription>ລາຍລະອຽດສ່ວນຕົວຂອງທ່ານ</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid fields={personalFields} />
        </CardContent>
      </Card>

      {/* Origin & family */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ຕົ້ນກຳເນີດ & ຄອບຄົວ</CardTitle>
          <CardDescription>ຂໍ້ມູນທີ່ຢູ່ເກີດ ແລະ ຄອບຄົວ</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid fields={originFields} />
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ການສຶກສາ & ວິຊາການ</CardTitle>
          <CardDescription>ພາບພື້ນຖານການສຶກສາແລະໃບຮັບຮອງວິຊາການຂອງທ່ານ</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid fields={educationFields} />
        </CardContent>
      </Card>
    </div>
  );
}
