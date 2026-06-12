"use client";

import { useState, useMemo, useCallback, memo, type ElementType } from "react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ProfileSkeleton from "@/components/skeletons/profileSkeleton";
import { NumberFormatter } from "@/components/formatNumber";
import FileUpload from "@/components/cameraUpload";
import { formatDateLao } from "@/components/laoDate";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fetchEmployeeByUid } from "@/lib/employees";
import type { EducationEntry, Employee } from "@/lib/types";

// Firestore may store reference fields as objects { nameLo, uuid, code }
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
  masked?: boolean;
  revealed?: boolean;
  onToggle?: () => void;
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

function buildEducationFields(profileUser: Employee | null): InfoField[] {
  const educations = Array.isArray(profileUser?.educations)
    ? (profileUser?.educations as EducationEntry[])
    : [];

  if (educations.length === 0) {
    return [
      {
        label: "ລະດັບການສຶກສາ",
        value: toStr(profileUser?.education),
        icon: GraduationCap,
      },
      {
        label: "ສະຖາບັນທີ່ຈົບການສຶກສາ",
        value: toStr(profileUser?.graduatedFrom),
        icon: GraduationCap,
      },
      {
        label: "ສາຂາວິຊາ",
        value: toStr(profileUser?.major),
        icon: GraduationCap,
      },
      {
        label: "ໃບຂັບຂີ່",
        value: toStr(profileUser?.drivingLicenseType),
        icon: IdCard,
      },
    ];
  }

  const fields: InfoField[] = educations.flatMap((item, index) => [
    {
      label: `ລະດັບການສຶກສາ (${index + 1})`,
      value: toStr(item.education),
      icon: GraduationCap,
    },
    {
      label: `ສະຖາບັນທີ່ຈົບການສຶກສາ (${index + 1})`,
      value: toStr(item.graduatedFrom),
      icon: GraduationCap,
    },
    {
      label: `ສາຂາວິຊາ (${index + 1})`,
      value: toStr(item.major),
      icon: GraduationCap,
    },
  ]);

  fields.push({
    label: "ໃບຂັບຂີ່",
    value: toStr(profileUser?.drivingLicenseType),
    icon: IdCard,
  });
  return fields;
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
            <div className="flex items-center gap-2">
              <p className="text-foreground truncate text-sm font-medium">
                {f.masked && !f.revealed ? "••••••••" : f.value || "-"}
              </p>
              {f.masked && (
                <button
                  onClick={f.onToggle}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {f.revealed ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth();
  const [showSalary, setShowSalary] = useState(false);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(
    null,
  );
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  const { data: employeeData } = useQuery({
    queryKey: ["employee", firebaseUser?.uid],
    queryFn: () => fetchEmployeeByUid(firebaseUser!.uid),
    enabled: !!firebaseUser?.uid,
  });

  const profileUser = useMemo<Employee | null>(() => {
    if (!firebaseUser) return null;
    if (user) {
      return {
        ...user,
        ...(employeeData ?? {}),
        firstName: employeeData?.firstNameEn || user.firstName,
        lastName: employeeData?.lastNameEn || user.lastName,
        phone: employeeData?.tel || user.phone,
        position: employeeData?.jobTitle || user.position,
        department:
          employeeData?.department ||
          employeeData?.workLocation ||
          user.department,
      };
    }
    // Render immediately with Firebase auth data while Employee doc loads
    const nameParts = (firebaseUser.displayName || "").split(" ");
    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      avatar: firebaseUser.photoURL || undefined,
      department: "",
      position: "",
      employeeId: "",
      phone: "",
      joinDate: "",
    } as Employee;
  }, [firebaseUser, user, employeeData]);

  const initials = profileUser
    ? `${(profileUser.firstNameEn || profileUser.firstName)[0] ?? ""}${(profileUser.lastNameEn || profileUser.lastName)[0] ?? ""}`.toUpperCase()
    : "U";

  const avatarSrc = useMemo(
    () =>
      uploadedAvatarUrl ||
      resolveProfileImage(employeeData?.profileImage, firebaseUser?.uid) ||
      employeeData?.photo3x4Url ||
      profileUser?.avatar ||
      (toStr(profileUser?.gender).toLowerCase() === "male"
        ? "/info/man.jpg"
        : "/info/woman.jpg"),
    [uploadedAvatarUrl, employeeData, firebaseUser?.uid, profileUser],
  );

  const toggleSalary = useCallback(() => setShowSalary((v) => !v), []);

  const handleAvatarUploaded = useCallback((url: string) => {
    setUploadedAvatarUrl(url);
    toast.success("ຮູບໂປຣໄຟລ໌ຖືກອັບເດດແລ້ວ");
  }, []);

  const employmentFields = useMemo<InfoField[]>(
    () => [
      {
        label: "ລະຫັດພະນັກງານ",
        value: toStr(profileUser?.employeeId),
        icon: User,
      },
      { label: "ອີເມວ", value: toStr(profileUser?.email), icon: Mail },
      {
        label: "ເບີໂທ",
        value: toStr(profileUser?.tel || profileUser?.phone),
        icon: Phone,
      },
      {
        label: "ຕຳແໜ່ງວຽກ",
        value: toStr(profileUser?.jobTitle || profileUser?.position),
        icon: Briefcase,
      },
      {
        label: "ພະແນກ",
        value: formatDepartment(profileUser?.department),
        icon: Layers,
      },
      {
        label: "ສະຖານທີ່ທຳວຽກ",
        value: toStr(profileUser?.workLocation),
        icon: Building,
      },
      {
        label: "ປະເພດພະນັກງານ",
        value: toStr(profileUser?.employeeType),
        icon: IdCard,
      },
      {
        label: "ເງິນເດືອນ",
        value: toStr(NumberFormatter.NoZero(profileUser?.salary || 0)) + " ກີບ",
        icon: DollarSign,
        masked: true,
        revealed: showSalary,
        onToggle: toggleSalary,
      },
    ],
    [profileUser, showSalary, toggleSalary],
  );

  const personalFields = useMemo<InfoField[]>(
    () => [
      {
        label: "ຊື່ (ພາສາອັງກິດ)",
        value: `${profileUser?.firstNameEn || profileUser?.firstName} ${profileUser?.lastNameEn || profileUser?.lastName}`,
        icon: User,
      },
      {
        label: "ຊື່ (ພາສາລາວ)",
        value:
          profileUser?.firstNameLo && profileUser?.lastNameLo
            ? `${profileUser.firstNameLo} ${profileUser.lastNameLo}`
            : "-",
        icon: User,
      },
      {
        label: "ວັນເກີດ",
        value: profileUser?.dateOfBirth
          ? formatDateLao(new Date(profileUser.dateOfBirth))
          : "-",
        icon: Calendar,
      },
      { label: "ເພດ", value: toStr(profileUser?.gender), icon: User },
      { label: "ກຸ່ມເລືອດ", value: toStr(profileUser?.bloodType), icon: Heart },
      {
        label: "ສະຖານະ",
        value: toStr(profileUser?.maritalStatus),
        icon: Users,
      },
      { label: "ສາສະໜາ", value: toStr(profileUser?.religion), icon: User },
      { label: "ຊາດ", value: toStr(profileUser?.ethnicity), icon: User },
    ],
    [profileUser],
  );

  const originFields = useMemo<InfoField[]>(
    () => [
      {
        label: "ແຂວງເກີດ",
        value: toStr(profileUser?.provinceOfBirth),
        icon: MapPin,
      },
      {
        label: "ເມືອງເກີດ",
        value: toStr(profileUser?.cityOfBirth),
        icon: MapPin,
      },
      {
        label: "ສະຖານທີ່ເກີດ",
        value: toStr(profileUser?.placeOfBirth),
        icon: MapPin,
      },
      {
        label: "ຈຳນວນສະມາຊິກຄອບຄົວ",
        value: toStr(profileUser?.numberOfFamilyMembers),
        icon: Users,
      },
      {
        label: "ຕິດຕໍ່ສຸກເສີນ",
        value: toStr(profileUser?.emergencyContactNumber),
        icon: Phone,
      },
    ],
    [profileUser],
  );

  const educationFields = useMemo(
    () => buildEducationFields(profileUser),
    [profileUser],
  );

  if (!profileUser) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">ຂໍ້ມູນສ່ວນຕົວ</h1>
        <p className="text-muted-foreground">
          ເບິ່ງແລະຮ້ອງຂໍການອັບເດດຂໍ້ມູນສ່ວນຕົວຂອງທ່ານ
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24">
              <Dialog
                open={isImageDialogOpen}
                onOpenChange={setIsImageDialogOpen}
              >
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none"
                    aria-label="View profile image"
                  >
                    <Avatar className="h-24 w-24 cursor-zoom-in">
                      <AvatarImage
                        src={avatarSrc}
                        alt={`${profileUser?.firstNameEn || profileUser?.firstName} ${profileUser?.lastNameEn || profileUser?.lastName}`}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] max-w-md p-2">
                  <DialogTitle className="sr-only">ຮູບໂປຣໄຟລ໌</DialogTitle>
                  <img
                    src={avatarSrc}
                    alt={`${profileUser?.firstNameEn || profileUser?.firstName} ${profileUser?.lastNameEn || profileUser?.lastName}`}
                    className="h-auto w-full rounded-md object-contain"
                  />
                </DialogContent>
              </Dialog>
              <div className="absolute -right-1 -bottom-1 z-20">
                <FileUpload
                  uid={firebaseUser?.uid || profileUser.id || ""}
                  className="border-background h-9 w-9 border-2 bg-black/70"
                  onUploaded={handleAvatarUploaded}
                />
              </div>
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-foreground text-xl font-semibold">
                {profileUser?.firstNameEn || profileUser?.firstName}{" "}
                {profileUser?.lastNameEn || profileUser?.lastName}
              </h2>
              {profileUser?.firstNameLo && profileUser?.lastNameLo && (
                <p className="text-foreground/80 text-lg">
                  {profileUser.firstNameLo} {profileUser.lastNameLo}
                </p>
              )}
              <p className="text-muted-foreground">
                {toStr(profileUser?.jobTitle || profileUser?.position)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {toStr(profileUser?.workLocation || profileUser?.department)}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge variant="secondary">
                  {toStr(profileUser?.employeeId)}
                </Badge>
                {profileUser?.employeeType && (
                  <Badge variant="outline">
                    {toStr(profileUser.employeeType)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ຂໍ້ມູນການຈ້າງງານ</CardTitle>
          <CardDescription>
            ບາງຟິວລິດຈຳເປັນຕ້ອງຮັບການອະນຸມັດຈາກ HR ເພື່ອອັບເດດ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {employmentFields.map((f, i) => (
              <div key={i}>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                      <f.icon className="text-muted-foreground h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{f.label}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-foreground text-sm font-medium">
                          {f.masked && !f.revealed
                            ? "••••••••"
                            : f.value || "-"}
                        </p>
                        {f.masked && (
                          <button
                            onClick={f.onToggle}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {f.revealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {i < employmentFields.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ຂໍ້ມູນສ່ວນຕົວ</CardTitle>
          <CardDescription>ລາຍລະອຽດສ່ວນຕົວຂອງທ່ານ</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid fields={personalFields} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ຕົ້ນກຳເນີດ & ຄອບຄົວ</CardTitle>
          <CardDescription>ຂໍ້ມູນທີ່ຢູ່ເກີດ ແລະ ຄອບຄົວ</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid fields={originFields} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ການສຶກສາ & ວິຊາການ</CardTitle>
          <CardDescription>
            ພາບພື້ນຖານການສຶກສາແລະໃບຮັບຮອງວິຊາການຂອງທ່ານ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InfoGrid fields={educationFields} />
        </CardContent>
      </Card>

    </div>
  );
}
