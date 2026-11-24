import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  FileText,
  Film,
  ImageIcon,
  X,
} from "lucide-react";
import { useLocation, useParams, useSearch } from "wouter";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { FormSection } from "@/components/admin/FormSection";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ContentInvestorPreview } from "@/components/admin/ContentInvestorPreview";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import {
  MultiFileDropzone,
  revokePendingUploads,
  type PendingUploadFile,
} from "@/components/admin/MultiFileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { VIDEO_UPLOAD_LIMIT_BYTES } from "@/lib/compressVideo";
import type { ContentBlock, ContentMediaAsset } from "@/models";
import { deleteContent, getContent, saveContent } from "@/services/api";
import { resolveContentMediaUrl } from "@/services/contentApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  ensureContent,
  invalidateContent,
  removeContent,
  upsertContent,
} from "@/store/slices/contentSlice";
import { ensureProperties } from "@/store/slices/propertiesSlice";


const emptyDraft = (): ContentBlock => ({
  id: "",
  key: "",
  title: "",
  area: "general",
  body: "",
  status: "draft",
  propertyId: null,
  documents: [],
  images: [],
  videos: [],
  updatedAt: new Date().toISOString(),
  updatedBy: "",
});

function mediaSrc(asset: ContentMediaAsset): string {
  return asset.url || resolveContentMediaUrl(asset.path) || asset.path;
}

/** Display name without extension (API `name` → "sample"). */
function mediaDisplayName(asset: ContentMediaAsset | { name: string }): string {
  const raw = asset.name.trim();
  if (!raw) return "Untitled";
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return raw;
  return raw.slice(0, dot);
}

function mediaFileType(
  asset: ContentMediaAsset | { name: string; fileType?: string },
): string {
  if ("fileType" in asset && asset.fileType) return asset.fileType.toLowerCase();
  const name = asset.name;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function formatBytes(size: number): string {
  if (!size || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DocTypeIcon({ fileType }: { fileType: string }) {
  const t = fileType.toLowerCase();
  if (t === "pdf") {
    return (
      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded border border-red-500/40 bg-red-500/10 text-[10px] font-semibold tracking-wide text-red-400">
        <FileText className="mb-0.5 size-3.5" />
        PDF
      </div>
    );
  }
  if (t === "doc" || t === "docx" || t === "rtf") {
    return (
      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded border border-sky-500/40 bg-sky-500/10 text-[10px] font-semibold tracking-wide text-sky-400">
        <FileText className="mb-0.5 size-3.5" />
        DOC
      </div>
    );
  }
  if (t === "xls" || t === "xlsx" || t === "csv") {
    return (
      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-semibold tracking-wide text-emerald-400">
        <FileSpreadsheet className="mb-0.5 size-3.5" />
        XLS
      </div>
    );
  }
  if (t === "ppt" || t === "pptx") {
    return (
      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded border border-orange-500/40 bg-orange-500/10 text-[10px] font-semibold tracking-wide text-orange-400">
        <FileText className="mb-0.5 size-3.5" />
        PPT
      </div>
    );
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-background/50 text-muted-foreground">
      <FileText className="size-4" />
    </div>
  );
}

function VideoTypeIcon() {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-background/50 text-muted-foreground">
      <Film className="size-4" />
    </div>
  );
}

function ExistingMediaList({
  kind,
  items,
  disabled,
  onRemove,
}: {
  kind: "docs" | "images" | "videos";
  items: ContentMediaAsset[];
  disabled?: boolean;
  onRemove: (path: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((asset) => {
        const src = mediaSrc(asset);
        const type = mediaFileType(asset);
        const label = mediaDisplayName(asset);
        const sizeLabel = formatBytes(asset.size);
        return (
          <li
            key={asset.path}
            className="glass flex items-center gap-3 rounded-xl px-3 py-2"
          >
            {kind === "images" ? (
              <img
                src={src}
                alt=""
                className="size-10 shrink-0 rounded object-cover"
              />
            ) : kind === "videos" ? (
              <VideoTypeIcon />
            ) : (
              <DocTypeIcon fileType={type} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground" title={asset.name}>
                {label}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[type ? type.toUpperCase() : null, sizeLabel || null, "Saved"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {!disabled ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                aria-label={`Remove ${asset.name}`}
                onClick={() => onRemove(asset.path)}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function PendingFileIcon({
  kind,
  fileName,
}: {
  kind: "docs" | "images" | "videos";
  fileName: string;
}) {
  if (kind === "videos") return <VideoTypeIcon />;
  if (kind === "images") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-background/50 text-muted-foreground">
        <ImageIcon className="size-4" />
      </div>
    );
  }
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".") + 1)
    : "";
  return <DocTypeIcon fileType={ext} />;
}

export function ContentFormPage() {
  const params = useParams<{ id?: string }>();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const isNew =
    location.endsWith("/content/new") ||
    location.includes("/content/new?") ||
    params.id === "new";
  const contentId = isNew ? null : (params.id ?? null);
  const propertyIdFromQuery =
    new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get(
      "propertyId",
    ) ?? null;

  const { can } = useAuth();
  const canPublish =
    can("manage_content", "content") || can("publish", "content");
  const dispatch = useAppDispatch();
  const propertiesState = useAppSelector((s) => s.properties);

  const [selected, setSelected] = useState<ContentBlock | null>(
    isNew ? emptyDraft() : null,
  );
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [area, setArea] = useState("general");
  const [propertyId, setPropertyId] = useState<string>(
    propertyIdFromQuery ?? "",
  );
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingLoad, setLoadingLoad] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docFiles, setDocFiles] = useState<PendingUploadFile[]>([]);
  const [imageFiles, setImageFiles] = useState<PendingUploadFile[]>([]);
  const [videoFiles, setVideoFiles] = useState<PendingUploadFile[]>([]);
  const [keepDocuments, setKeepDocuments] = useState<ContentMediaAsset[]>([]);
  const [keepImages, setKeepImages] = useState<ContentMediaAsset[]>([]);
  const [keepVideos, setKeepVideos] = useState<ContentMediaAsset[]>([]);
  /** True after GET-one (or create) so ExistingMediaList can show server files. */
  const [mediaSynced, setMediaSynced] = useState(isNew);
  /**
   * Postman: omitting keep* preserves all existing media.
   * Only send keep* after the user removes an existing file — otherwise
   * empty keep* on re-save wipes uploads (API treats [] as delete-all).
   */
  const [mediaTouched, setMediaTouched] = useState(false);

  useEffect(() => {
    return () => {
      revokePendingUploads(docFiles);
      revokePendingUploads(imageFiles);
      revokePendingUploads(videoFiles);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  useEffect(() => {
    void dispatch(ensureProperties()).unwrap().catch(() => undefined);
    void dispatch(ensureContent()).unwrap().catch(() => undefined);
  }, [dispatch]);

  const clearUploads = () => {
    revokePendingUploads(docFiles);
    revokePendingUploads(imageFiles);
    revokePendingUploads(videoFiles);
    setDocFiles([]);
    setImageFiles([]);
    setVideoFiles([]);
    setKeepDocuments([]);
    setKeepImages([]);
    setKeepVideos([]);
  };

  const applyBlockToForm = (block: ContentBlock) => {
    setSelected(block);
    setTitle(block.title);
    setBody(block.body);
    setKey(block.key);
    setArea(block.area || "general");
    setPropertyId(block.propertyId ? String(block.propertyId) : "");
    setKeepDocuments([...(block.documents ?? [])]);
    setKeepImages([...(block.images ?? [])]);
    setKeepVideos([...(block.videos ?? [])]);
  };

  useEffect(() => {
    if (isNew) {
      clearUploads();
      applyBlockToForm({
        ...emptyDraft(),
        propertyId: propertyIdFromQuery,
      });
      setPropertyId(propertyIdFromQuery ?? "");
      setPropertyError(null);
      setPreview(false);
      setMediaSynced(true);
      setMediaTouched(false);
      setLoadError(null);
      setLoadingLoad(false);
      return;
    }

    if (!contentId) return;

    let cancelled = false;
    setLoadingLoad(true);
    setLoadError(null);
    setSelected(null);
    setMediaSynced(false);
    setMediaTouched(false);
    setPreview(false);
    clearUploads();

    void getContent(contentId)
      .then((full) => {
        if (cancelled) return;
        if (!full) {
          setLoadError("Content not found.");
          setSelected(null);
          return;
        }
        applyBlockToForm(full);
        dispatch(upsertContent(full));
        setMediaSynced(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError ? err.message : "Unable to load content.",
        );
        setSelected(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingLoad(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on route id only
  }, [contentId, isNew, dispatch, propertyIdFromQuery]);

  const propertyOptions = useMemo(() => {
    return propertiesState.items.map((p) => ({
      value: String(p.id),
      label: p.name || p.reference || String(p.id),
      keywords: `${p.reference ?? ""} ${p.city ?? ""} ${p.address ?? ""}`,
    }));
  }, [propertiesState.items]);

  const linkedProperty = useMemo(() => {
    if (!propertyId) return null;
    return (
      propertiesState.items.find((p) => String(p.id) === String(propertyId)) ??
      null
    );
  }, [propertiesState.items, propertyId]);

  const contentListHref = propertyId
    ? `/content?propertyId=${encodeURIComponent(propertyId)}`
    : "/properties";

  const backToProperty = () => {
    clearUploads();
    if (propertyId) {
      setLocation(contentListHref);
      return;
    }
    setLocation("/properties");
  };

  const closeEditor = () => {
    backToProperty();
  };

  const removeKeptDocument = (path: string) => {
    setMediaTouched(true);
    setKeepDocuments((prev) => prev.filter((a) => a.path !== path));
  };
  const removeKeptImage = (path: string) => {
    setMediaTouched(true);
    setKeepImages((prev) => prev.filter((a) => a.path !== path));
  };
  const removeKeptVideo = (path: string) => {
    setMediaTouched(true);
    setKeepVideos((prev) => prev.filter((a) => a.path !== path));
  };

  const handleDelete = async () => {
    const id = selected?.id;
    if (!id) return;
    setDeleting(true);
    try {
      await deleteContent(id);
      dispatch(removeContent(id));
      dispatch(invalidateContent());
      toast.success("Content deleted");
      backToProperty();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to delete content.",
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const persist = async (status: ContentBlock["status"]) => {
    if (!selected) return;
    const trimmedTitle = title.trim();
    const trimmedKey = key.trim();
    const trimmedPropertyId = propertyId.trim();
    if (!trimmedPropertyId) {
      setPropertyError("Property is required.");
      toast.error("Select a property.");
      return;
    }
    setPropertyError(null);
    if (trimmedTitle.length < 2) {
      toast.error("Title is required.");
      return;
    }
    if (trimmedKey.length < 2) {
      toast.error("Key is required.");
      return;
    }
    if (videoFiles.some((file) => file.status === "compressing")) {
      toast.error("Wait for the video to finish preparing.");
      return;
    }
    if (videoFiles.some((file) => file.status === "error")) {
      toast.error("Remove the video that could not be prepared, then save again.");
      return;
    }
    const newUploadBytes = [...docFiles, ...imageFiles, ...videoFiles].reduce(
      (sum, file) => sum + file.file.size,
      0,
    );
    if (newUploadBytes > VIDEO_UPLOAD_LIMIT_BYTES) {
      toast.error(
        "These new files are still over 100 MB together. Upload one large video at a time.",
      );
      return;
    }
    const wasCreate = !selected.id;
    const isUpdate = Boolean(selected.id);
    if (isUpdate && mediaTouched && !mediaSynced) {
      toast.error("Still loading media. Wait a moment, then save again.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveContent({
        id: selected.id || undefined,
        key: trimmedKey,
        title: trimmedTitle,
        area: area.trim() || "general",
        body,
        status,
        propertyId: trimmedPropertyId,
        documentFiles: docFiles.map((f) => f.file),
        imageFiles: imageFiles.map((f) => f.file),
        videoFiles: videoFiles.map((f) => f.file),
        // Omit keep* unless user removed existing media — empty keep* = wipe-all on API.
        ...(isUpdate && mediaTouched
          ? {
              keepDocuments: keepDocuments.map((a) => a.path),
              keepImages: keepImages.map((a) => a.path),
              keepVideos: keepVideos.map((a) => a.path),
            }
          : {}),
      });
      dispatch(upsertContent(saved));
      dispatch(invalidateContent());
      try {
        await dispatch(ensureContent({ force: true })).unwrap();
      } catch (err: unknown) {
        if (!isThunkConditionError(err)) {
          /* list refresh failed; upsert still holds saved row */
        }
      }

      let next = saved;
      if (saved.id) {
        try {
          const fresh = await getContent(saved.id);
          if (fresh) {
            next = fresh;
            dispatch(upsertContent(fresh));
          }
        } catch {
          /* keep write response */
        }
      }

      clearUploads();
      applyBlockToForm(next);
      setMediaSynced(true);
      setMediaTouched(false);
      setPreview(false);
      toast.success(status === "published" ? "Published" : "Saved as draft");

      if (wasCreate && next.id) {
        setLocation(`/content/${next.id}`);
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to save content.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingLoad || (!isNew && selected === null && !loadError)) {
    return <LoadingBlock />;
  }

  if (loadError && !isNew) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Edit content"
          description="Editable investor-facing copy. Save as draft and publish when ready."
          breadcrumbs={[
            { label: "Properties", href: "/properties" },
            { label: "Content" },
          ]}
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {loadError}
          <div className="mt-3">
            <Button variant="outline" onClick={() => setLocation("/properties")}>
              Back to properties
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!selected) return <LoadingBlock />;

  const videosCompressing = videoFiles.some((file) => file.status === "compressing");
  const fieldsDisabled = !canPublish || saving || loadingLoad || deleting;
  const propertyLocked =
    Boolean(selected.id) || Boolean(propertyIdFromQuery && isNew);

  return (
    <div className="w-full min-w-0 space-y-4">
      <PageHeader
        title={isNew ? "New content" : "Edit content"}
        description="Editable investor-facing copy. Save as draft and publish when ready."
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          ...(propertyId
            ? [
                {
                  label:
                    linkedProperty?.name ||
                    linkedProperty?.reference ||
                    "Property",
                  href: `/properties/${propertyId}`,
                },
                {
                  label: "Content",
                  href: `/content?propertyId=${encodeURIComponent(propertyId)}`,
                },
              ]
            : []),
          { label: isNew ? "New" : title.trim() || "Edit" },
        ]}
      />

      <FormSection title={isNew ? "New content block" : "Edit content block"}>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="content-property">
            Add Property <span className="text-error">*</span>
          </Label>
          <SearchableSelect
            id="content-property"
            value={propertyId || undefined}
            onValueChange={(value) => {
              setPropertyId(value);
              setPropertyError(null);
            }}
            options={propertyOptions}
            disabled={fieldsDisabled || propertyLocked}
            placeholder={
              propertiesState.status === "loading"
                ? "Loading properties…"
                : "Select property…"
            }
            searchPlaceholder="Search properties…"
            emptyMessage="No available properties"
          />
          {propertyError ? (
            <p className="text-xs text-error" role="alert">
              {propertyError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              A property can have multiple content blocks.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="content-key">Key</Label>
          <Input
            id="content-key"
            disabled={!canPublish || (!isNew && Boolean(selected.id))}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="home-hero"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="content-area">Area</Label>
          <Input
            id="content-area"
            disabled={!canPublish}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="marketing"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="content-title">Title</Label>
          <Input
            id="content-title"
            disabled={!canPublish}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="content-body">Body</Label>
          <Textarea
            id="content-body"
            disabled={!canPublish}
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="space-y-3 md:col-span-2">
          <MultiFileDropzone
            kind="docs"
            label="Upload PDFs, Docs"
            files={docFiles}
            onChange={setDocFiles}
            disabled={fieldsDisabled}
          />
          <ExistingMediaList
            kind="docs"
            items={keepDocuments}
            disabled={fieldsDisabled}
            onRemove={removeKeptDocument}
          />
        </div>

        <div className="space-y-3 md:col-span-2">
          <MultiFileDropzone
            kind="images"
            label="Upload Images"
            files={imageFiles}
            onChange={setImageFiles}
            disabled={fieldsDisabled}
          />
          <ExistingMediaList
            kind="images"
            items={keepImages}
            disabled={fieldsDisabled}
            onRemove={removeKeptImage}
          />
        </div>

        <div className="space-y-3 md:col-span-2">
          <MultiFileDropzone
            kind="videos"
            label="Upload Videos"
            files={videoFiles}
            onChange={setVideoFiles}
            disabled={fieldsDisabled}
          />
          <ExistingMediaList
            kind="videos"
            items={keepVideos}
            disabled={fieldsDisabled}
            onRemove={removeKeptVideo}
          />
        </div>

        {canPublish ? (
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              variant="outline"
              disabled={saving || loadingLoad || deleting || videosCompressing}
              onClick={() => void persist("draft")}
            >
              {videosCompressing ? "Preparing…" : saving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={saving || deleting}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "Hide preview" : "Preview"}
            </Button>
            <Button
              disabled={saving || loadingLoad || deleting || videosCompressing}
              onClick={() => void persist("published")}
            >
              {videosCompressing ? "Preparing…" : saving ? "Saving…" : "Publish"}
            </Button>
            {!isNew && selected.id ? (
              <Button
                type="button"
                variant="outline"
                className="border-error/50 text-error hover:bg-error/10 hover:text-error"
                disabled={saving || deleting}
                onClick={() => setConfirmDelete(true)}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              type="button"
              disabled={saving || deleting}
              onClick={closeEditor}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="md:col-span-2">
            <Button
              variant="ghost"
              type="button"
              onClick={closeEditor}
            >
              Back
            </Button>
          </div>
        )}
      </FormSection>

      {preview && selected ? (
        <ContentInvestorPreview
          title={title}
          body={body}
          contentKey={key}
          area={area}
          status={selected.status}
          propertyName={
            linkedProperty?.name || linkedProperty?.reference || null
          }
          documents={keepDocuments}
          images={keepImages}
          videos={keepVideos}
          pendingDocs={docFiles}
          pendingImages={imageFiles}
          pendingVideos={videoFiles}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open);
        }}
        title="Delete content block?"
        description={
          selected
            ? `“${selected.title || selected.key}” will be soft-deleted. Media files remain on disk.`
            : "This soft-deletes the content block. Media files remain on disk."
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}