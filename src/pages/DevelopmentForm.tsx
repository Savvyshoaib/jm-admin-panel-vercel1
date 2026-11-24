import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSection } from "@/components/admin/FormSection";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { titleCase } from "@/lib/format";
import { createClientId } from "@/lib/ids";
import { formatCsvList, parseCsvList } from "@/lib/utils";
import { MediaImage } from "@/components/admin/MediaImage";
import { X } from "lucide-react";
import type { Development, DevelopmentStatus } from "@/models";
import { getDevelopment, saveDevelopment } from "@/services/api";
import { useAppDispatch } from "@/store/hooks";
import { upsertDevelopment } from "@/store/slices/developmentsSlice";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

function isAllowedImageFile(file: File): boolean {
  if (IMAGE_MIME.has(file.type)) return true;
  if (!file.type && IMAGE_EXT.test(file.name)) return true;
  return false;
}

function revokePending(images: PendingImage[]) {
  for (const item of images) URL.revokeObjectURL(item.previewUrl);
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function DevelopmentImageThumb({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <MediaImage
      src={src}
      alt={alt}
      wrapperClassName="aspect-[4/3] w-full"
      className="aspect-[4/3] w-full object-cover"
    />
  );
}

export function DevelopmentFormPage() {
  const params = useParams<{ id: string }>();
  const isNew = !params.id || params.id === "new";
  const { can } = useAuth();
  const canEdit = can("create", "developments") || can("edit", "developments");
  const dispatch = useAppDispatch();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<Partial<Development>>({
    name: "",
    status: "draft",
    visibleInExplore: false,
    featured: false,
    startingPrice: 0,
    expectedRentalYield: 0,
    expectedCapitalGrowth: 0,
    availableUnits: 0,
    totalUnits: 0,
    propertyTypes: [],
    amenities: [],
    highlights: [],
    tenure: "Leasehold",
    image: "",
    images: [],
  });
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [highlightsText, setHighlightsText] = useState("");
  const [amenitiesText, setAmenitiesText] = useState("");

  useEffect(() => {
    if (!isNew && params.id) {
      setLoading(true);
      setLoadError(null);
      getDevelopment(params.id)
        .then((d) => {
          if (d) {
            const gallery =
              d.images?.length > 0 ? d.images : d.image ? [d.image] : [];
            setForm({ ...d, images: gallery, image: gallery[0] ?? "" });
            setHighlightsText(formatCsvList(d.highlights));
            setAmenitiesText(formatCsvList(d.amenities));
            setExistingImages(gallery);
            setOriginalImages(gallery);
            setPendingImages((prev) => {
              revokePending(prev);
              return [];
            });
          } else setLoadError("Development not found.");
        })
        .catch((err) => {
          setLoadError(
            err instanceof ApiError ? err.message : "Unable to load development.",
          );
        })
        .finally(() => setLoading(false));
    }
  }, [isNew, params.id]);

  if (loading) return <LoadingBlock variant="form" />;

  if (loadError && !isNew) {
    return (
      <div className="space-y-4">
        <PageHeader title="Development" description={loadError} />
        <Button variant="outline" onClick={() => setLocation("/developments")}>
          Back to developments
        </Button>
      </div>
    );
  }

  const set = <K extends keyof Development>(
    key: K,
    value: Development[K] | undefined,
  ) =>
    setForm((f) => ({ ...f, [key]: value }));

  const persistDevelopment = async (): Promise<Development | null> => {
    if (!canEdit) return null;
    const name = form.name?.trim();
    if (!name || name.length < 2) {
      toast.error("Development name is required (at least 2 characters).");
      return null;
    }
    setSaving(true);
    try {
      const keep = existingImages.filter((u) => u && !u.startsWith("blob:"));
      const removeImages = originalImages.filter((u) => !keep.includes(u));
      const saved = await saveDevelopment({
        ...form,
        id: isNew ? form.id : (form.id ?? params.id),
        name,
        reference: form.reference?.trim() || "",
        highlights: parseCsvList(highlightsText),
        amenities: parseCsvList(amenitiesText),
        image: keep[0] ?? "",
        images: keep,
        existingImages: keep,
        removeImages,
        imageFiles: pendingImages.map((p) => p.file),
      });
      setPendingImages((prev) => {
        revokePending(prev);
        return [];
      });
      setForm(saved);
      setHighlightsText(formatCsvList(saved.highlights));
      setAmenitiesText(formatCsvList(saved.amenities));
      const gallery =
        saved.images?.length > 0 ? saved.images : saved.image ? [saved.image] : [];
      setExistingImages(gallery);
      setOriginalImages(gallery);
      dispatch(upsertDevelopment(saved));
      return saved;
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Unable to save development.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const gallery = [
    ...existingImages.map((url) => ({
      key: `ex-${url}`,
      url,
      kind: "existing" as const,
    })),
    ...pendingImages.map((p) => ({
      key: p.id,
      url: p.previewUrl,
      kind: "pending" as const,
      id: p.id,
    })),
  ];

  return (
    <div>
      <PageHeader
        title={isNew ? "Add development" : form.name || "Edit development"}
        breadcrumbs={[
          { label: "Developments", href: "/developments" },
          { label: isNew ? "New" : form.reference || "Edit" },
        ]}
      />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = await persistDevelopment();
          if (!saved) return;
          toast.success(isNew ? "Development created" : "Development updated");
          if (isNew || String(params.id) !== String(saved.id)) {
            setLocation(`/developments/${saved.id}`);
          }
        }}
      >
        <FormSection title="Basics">
          <div className="space-y-2"><Label>Name</Label><Input required disabled={!canEdit} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-2"><Label>Reference</Label><Input disabled={!canEdit} value={form.reference ?? ""} onChange={(e) => set("reference", e.target.value)} placeholder="Optional — defaults to name" /></div>
          <div className="space-y-2"><Label>Developer</Label><Input disabled={!canEdit} value={form.developer ?? ""} onChange={(e) => set("developer", e.target.value)} /></div>
          <div className="space-y-2"><Label>Address</Label><Input disabled={!canEdit} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
          <div className="space-y-2"><Label>City</Label><Input disabled={!canEdit} value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
          <div className="space-y-2"><Label>Region</Label><Input disabled={!canEdit} value={form.region ?? ""} onChange={(e) => set("region", e.target.value)} /></div>
          <div className="space-y-2"><Label>Postcode</Label><Input disabled={!canEdit} value={form.postcode ?? ""} onChange={(e) => set("postcode", e.target.value)} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea disabled={!canEdit} value={form.description ?? ""} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => set("description", e.target.value)} /></div>
        </FormSection>
        <FormSection title="Commercial">
          <div className="space-y-2"><Label>Starting price</Label><Input type="number" disabled={!canEdit} value={form.startingPrice ?? ""} onChange={(e) => set("startingPrice", numberOrUndefined(e.target.value))} /></div>
          <div className="space-y-2"><Label>Expected rental yield %</Label><Input type="number" step="0.1" disabled={!canEdit} value={form.expectedRentalYield ?? ""} onChange={(e) => set("expectedRentalYield", numberOrUndefined(e.target.value))} /></div>
          <div className="space-y-2"><Label>Expected capital growth %</Label><Input type="number" step="0.1" disabled={!canEdit} value={form.expectedCapitalGrowth ?? ""} onChange={(e) => set("expectedCapitalGrowth", numberOrUndefined(e.target.value))} /></div>
          <div className="space-y-2">
            <Label>Completion date</Label>
            <DatePicker
              disabled={!canEdit}
              value={form.completionDate}
              onChange={(v) => set("completionDate", v)}
              placeholder="Select completion date"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status ?? "draft"} onValueChange={(v) => set("status", v as DevelopmentStatus)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft", "coming_soon", "available", "sold_out", "completed", "archived"].map((s) => (
                  <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>
        <FormSection
          title="Content"
          description="Marketing copy and development imagery (PNG, JPG, WEBP, GIF — max 5 MB each)."
        >
          <div className="space-y-2 md:col-span-2">
            <Label>Highlights (comma-separated)</Label>
            <Textarea
              disabled={!canEdit}
              value={highlightsText}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => setHighlightsText(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Amenities (comma-separated)</Label>
            <Textarea
              disabled={!canEdit}
              value={amenitiesText}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => setAmenitiesText(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Location information</Label>
            <Textarea
              disabled={!canEdit}
              value={form.locationInfo ?? ""}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => set("locationInfo", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-4">
            {gallery.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border bg-card/20 text-sm text-muted-foreground">
                No images selected
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {gallery.map((item) => (
                  <div
                    key={item.key}
                    className="group relative overflow-hidden rounded-xl border border-white/12 bg-white/4"
                  >
                    <DevelopmentImageThumb
                      src={item.url}
                      alt={form.name || "Development"}
                    />
                    {canEdit && (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="absolute right-2 top-2 size-8 bg-background/90"
                        aria-label="Remove image"
                        onClick={() => {
                          if (item.kind === "existing") {
                            setExistingImages((prev) => {
                              const next = prev.filter((u) => u !== item.url);
                              setForm((f) => ({
                                ...f,
                                image: next[0] ?? "",
                                images: next,
                              }));
                              return next;
                            });
                            toast.message("Image removed");
                            return;
                          }
                          setPendingImages((prev) => {
                            const target = prev.find((p) => p.id === item.id);
                            if (target) URL.revokeObjectURL(target.previewUrl);
                            return prev.filter((p) => p.id !== item.id);
                          });
                          toast.message("Image removed");
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="development-image-upload">Upload images</Label>
              <Input
                id="development-image-upload"
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                disabled={!canEdit}
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (!list.length) return;

                  const accepted: PendingImage[] = [];
                  let rejected = 0;
                  let oversized = 0;

                  for (const file of list) {
                    if (!isAllowedImageFile(file)) {
                      rejected += 1;
                      continue;
                    }
                    if (file.size > MAX_IMAGE_BYTES) {
                      oversized += 1;
                      continue;
                    }
                    accepted.push({
                      id: createClientId(),
                      file,
                      previewUrl: URL.createObjectURL(file),
                    });
                  }

                  if (rejected) {
                    toast.error(
                      "Only image files are allowed (PNG, JPG, WEBP, GIF).",
                    );
                  }
                  if (oversized) {
                    toast.error("Each image must be under 5 MB.");
                  }
                  if (accepted.length) {
                    setPendingImages((prev) => [...prev, ...accepted]);
                    toast.success(
                      accepted.length === 1
                        ? "Image ready to upload"
                        : `${accepted.length} images ready to upload`,
                    );
                  }
                }}
              />
            </div>
          </div>
        </FormSection>
        <FormSection title="Visibility">
          <div className="flex items-center gap-3"><Switch id="feat" disabled={!canEdit} checked={!!form.featured} onCheckedChange={(v) => set("featured", v)} /><Label htmlFor="feat">Featured</Label></div>
          <div className="flex items-center gap-3"><Switch id="vis" disabled={!canEdit} checked={!!form.visibleInExplore} onCheckedChange={(v) => set("visibleInExplore", v)} /><Label htmlFor="vis">Visible in Explore</Label></div>
        </FormSection>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save development"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={async () => {
                const saved = await persistDevelopment();
                if (!saved) return;
                toast.success(
                  isNew
                    ? "Development created — continue with property"
                    : "Development updated — continue with property",
                );
                setLocation(
                  `/properties/new?developmentId=${encodeURIComponent(saved.id)}`,
                );
              }}
            >
              {saving ? "Saving…" : "Save Development & Add Property"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setLocation("/developments")}
            >
              Cancel
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
