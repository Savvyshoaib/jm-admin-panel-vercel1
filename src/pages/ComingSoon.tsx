import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { FormSection } from "@/components/admin/FormSection";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { MediaImage } from "@/components/admin/MediaImage";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { createClientId } from "@/lib/ids";
import type { ComingSoonCard, ComingSoonSection } from "@/models";
import { resolveContentMediaUrl } from "@/services/contentApi";
import {
  fetchComingSoon,
  saveComingSoon,
  uploadComingSoonImage,
} from "@/services/comingSoonApi";

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

type CardDraft = ComingSoonCard & { key: string };

type Draft = Omit<ComingSoonSection, "cards"> & { cards: CardDraft[] };

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

function revokePending(images: Record<string, PendingImage>) {
  for (const item of Object.values(images)) URL.revokeObjectURL(item.previewUrl);
}

function CardImagePreview({ src, alt }: { src: string; alt: string }) {
  return (
    <MediaImage
      src={src}
      alt={alt}
      wrapperClassName="aspect-[4/3] w-full"
      className="aspect-[4/3] w-full object-cover"
      emptyLabel="No image"
    />
  );
}

function blankCard(): CardDraft {
  return {
    key: nanoid(),
    name: "",
    city: "",
    region: "",
    description: "",
    expectedFrom: "",
    image: "",
    buttonLabel: "Register interest",
    status: "coming_soon",
  };
}

function toDraft(section: ComingSoonSection): Draft {
  return {
    title: section.title || "Coming soon",
    description: section.description,
    published: section.published,
    cards: section.cards.map((card) => ({ ...card, key: nanoid() })),
  };
}

export function ComingSoonPage() {
  const { can } = useAuth();
  const canEdit = can("manage_content", "content");
  const canView = can("view", "content") || canEdit;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [publishPrompt, setPublishPrompt] = useState<boolean | null>(null);
  const [openAreaKey, setOpenAreaKey] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<Record<string, PendingImage>>({});
  const pendingRef = useRef(pendingImages);
  pendingRef.current = pendingImages;

  useEffect(() => () => revokePending(pendingRef.current), []);

  const load = () => {
    setStatus("loading");
    setError(null);
    void fetchComingSoon()
      .then((section) => {
        const next = toDraft(section);
        setDraft(next);
        setOpenAreaKey(next.cards[0]?.key ?? null);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setStatus("failed");
        setError(
          err instanceof ApiError ? err.message : "Unable to load Coming soon.",
        );
      });
  };

  useEffect(() => {
    if (!canView) return;
    load();
    // Load once when the operator can view the section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  if (!canView) {
    return (
      <PageHeader
        title="Coming soon"
        description="Explore content is restricted for this role."
      />
    );
  }

  if (status === "loading" || !draft) {
    if (status === "failed") {
      return (
        <div className="space-y-4">
          <PageHeader
            title="Coming soon"
            description="Upcoming areas shown in investor Explore, separate from live opportunities."
          />
          <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
            {error ?? "Unable to load Coming soon."}
            <div className="mt-3">
              <Button variant="outline" onClick={load}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return <LoadingBlock variant="form" />;
  }

  const updateCard = (key: string, patch: Partial<ComingSoonCard>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((card) =>
              card.key === key ? { ...card, ...patch } : card,
            ),
          }
        : current,
    );
    setFieldErrors((current) => {
      const next = { ...current };
      let changed = false;
      for (const errorKey of Object.keys(next)) {
        if (errorKey === key || errorKey.startsWith(`${key}:`)) {
          delete next[errorKey];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  };

  const moveCard = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.cards.length) return current;
      const cards = [...current.cards];
      const [item] = cards.splice(index, 1);
      cards.splice(nextIndex, 0, item);
      return { ...current, cards };
    });
  };

  const chooseImage = (key: string, list: File[]) => {
    const file = list[0];
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      toast.error("Only image files are allowed (PNG, JPG, WEBP, GIF).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Each image must be under 5 MB.");
      return;
    }
    setPendingImages((current) => {
      const previous = current[key];
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return {
        ...current,
        [key]: {
          id: createClientId(),
          file,
          previewUrl: URL.createObjectURL(file),
        },
      };
    });
    toast.success("Image ready to upload");
  };

  const clearImage = (key: string) => {
    if (pendingImages[key]) {
      setPendingImages((current) => {
        const target = current[key];
        if (target) URL.revokeObjectURL(target.previewUrl);
        if (!target) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    updateCard(key, { image: "" });
  };

  const requestRemove = (card: CardDraft) => {
    setRemoveKey(card.key);
  };

  const persistSection = async (
    published: boolean,
    options?: { cards?: CardDraft[]; successMessage?: string },
  ) => {
    if (!canEdit || saving || !draft) return "failed" as const;
    const sourceCards = options?.cards ?? draft.cards;

    const nextErrors: Record<string, string> = {};
    if (!draft.title.trim()) nextErrors.title = "Title is required.";
    for (const card of sourceCards) {
      if (!card.name.trim()) nextErrors[`${card.key}:name`] = "Name is required.";
      if (!card.city.trim()) nextErrors[`${card.key}:city`] = "City is required.";
      if (!card.description.trim()) {
        nextErrors[`${card.key}:description`] = "Description is required.";
      }
      if (!card.expectedFrom.trim()) {
        nextErrors[`${card.key}:expectedFrom`] = "Expected from is required.";
      }
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const invalid = sourceCards.find(
        (card) =>
          nextErrors[`${card.key}:name`] ||
          nextErrors[`${card.key}:city`] ||
          nextErrors[`${card.key}:description`] ||
          nextErrors[`${card.key}:expectedFrom`],
      );
      if (invalid) setOpenAreaKey(invalid.key);
      toast.error("Complete the required fields before saving.");
      return "invalid" as const;
    }

    setSaving(true);
    try {
      const cards: ComingSoonCard[] = [];
      for (const card of sourceCards) {
        const file = pendingImages[card.key]?.file;
        const image = file ? await uploadComingSoonImage(file) : card.image;
        const { key: _key, ...rest } = card;
        cards.push({ ...rest, image });
      }
      const saved = await saveComingSoon({
        title: draft.title,
        description: draft.description,
        published,
        cards,
      });
      setPendingImages((current) => {
        revokePending(current);
        return {};
      });
      const next = toDraft(saved.section);
      setDraft(next);
      setOpenAreaKey(next.cards[0]?.key ?? null);
      toast.success(
        options?.successMessage ??
          (published
            ? "Coming soon published for investors."
            : "Coming soon saved. Areas stay hidden until published."),
      );
      return "saved" as const;
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to save Coming soon.",
      );
      return "failed" as const;
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await persistSection(draft.published);
  };

  const pendingRemove = draft.cards.find((card) => card.key === removeKey);

  return (
    <div>
      <PageHeader
        title="Coming soon"
        description="Upcoming areas in investor Explore. Saving replaces the whole section, including every area."
        actions={
          canEdit ? (
            <Button type="submit" form="coming-soon-form" disabled={saving}>
              {saving ? "Saving…" : "Save section"}
            </Button>
          ) : null
        }
      />

      {!canEdit && (
        <p className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          View only. Super Admins can edit and publish this section.
        </p>
      )}

      <form id="coming-soon-form" className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <FormSection
          title="Section"
          description="Published areas appear in investor Explore. Unpublished areas stay in admin only."
        >
          <div className="space-y-2">
            <Label htmlFor="coming-soon-title">Title</Label>
            <Input
              id="coming-soon-title"
              required
              disabled={!canEdit}
              value={draft.title}
              aria-invalid={Boolean(fieldErrors.title)}
              onChange={(e) => {
                setDraft({ ...draft, title: e.target.value });
                if (fieldErrors.title) {
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.title;
                    return next;
                  });
                }
              }}
            />
            {fieldErrors.title && (
              <p className="text-xs text-error">{fieldErrors.title}</p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Label htmlFor="coming-soon-published">Published</Label>
              <p className="text-xs text-muted-foreground">
                Turn off to hide every area from investors.
              </p>
            </div>
            <Switch
              id="coming-soon-published"
              className="shrink-0"
              checked={draft.published}
              disabled={!canEdit || saving}
              onCheckedChange={(next) => {
                if (next === draft.published) return;
                setPublishPrompt(next);
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="coming-soon-description">Description</Label>
            <Textarea
              id="coming-soon-description"
              disabled={!canEdit}
              value={draft.description}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
        </FormSection>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Areas</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Order here is the order investors see. Button labels are display
              copy and do not register interest. Each area uses one image.
            </p>
          </div>
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const area = blankCard();
                setDraft({ ...draft, cards: [...draft.cards, area] });
                setOpenAreaKey((current) => current ?? draft.cards[0]?.key ?? area.key);
              }}
            >
              <Plus />
              Add area
            </Button>
          )}
        </div>

        {draft.cards.length === 0 ? (
          <EmptyState
            title="No areas yet"
            description="Add an upcoming area. It stays hidden from investors until this section is published."
            action={
              canEdit ? (
                <Button
                  type="button"
                  onClick={() => {
                    const area = blankCard();
                    setDraft({ ...draft, cards: [area] });
                    setOpenAreaKey(area.key);
                  }}
                >
                  <Plus />
                  Add area
                </Button>
              ) : undefined
            }
          />
        ) : (
          draft.cards.map((card, index) => {
            const pending = pendingImages[card.key];
            const imageSrc = pending?.previewUrl || resolveContentMediaUrl(card.image);
            return (
              <FormSection
                key={card.key}
                collapsible
                open={openAreaKey === card.key}
                onOpenChange={(next) => setOpenAreaKey(next ? card.key : null)}
                title={card.name.trim() || `Area ${index + 1}`}
                description={`${card.city || "City"}${card.region ? ` · ${card.region}` : ""}`}
                actions={
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <StatusBadge value={card.status || "coming_soon"} />
                    {canEdit && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === 0 || saving}
                          aria-label={`Move ${card.name || `area ${index + 1}`} up`}
                          onClick={() => moveCard(index, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === draft.cards.length - 1 || saving}
                          aria-label={`Move ${card.name || `area ${index + 1}`} down`}
                          onClick={() => moveCard(index, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          aria-label={`Remove ${card.name || `area ${index + 1}`}`}
                          onClick={() => requestRemove(card)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                }
              >
                <div className="space-y-2">
                  <Label htmlFor={`${card.key}-name`}>Name</Label>
                  <Input
                    id={`${card.key}-name`}
                    required
                    disabled={!canEdit}
                    value={card.name}
                    aria-invalid={Boolean(fieldErrors[`${card.key}:name`])}
                    onChange={(e) => updateCard(card.key, { name: e.target.value })}
                  />
                  {fieldErrors[`${card.key}:name`] && (
                    <p className="text-xs text-error">{fieldErrors[`${card.key}:name`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${card.key}-expected`}>Expected from</Label>
                  <Input
                    id={`${card.key}-expected`}
                    disabled={!canEdit}
                    placeholder="late 2027"
                    value={card.expectedFrom}
                    aria-invalid={Boolean(fieldErrors[`${card.key}:expectedFrom`])}
                    onChange={(e) =>
                      updateCard(card.key, { expectedFrom: e.target.value })
                    }
                  />
                  {fieldErrors[`${card.key}:expectedFrom`] && (
                    <p className="text-xs text-error">
                      {fieldErrors[`${card.key}:expectedFrom`]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${card.key}-city`}>City</Label>
                  <Input
                    id={`${card.key}-city`}
                    disabled={!canEdit}
                    value={card.city}
                    aria-invalid={Boolean(fieldErrors[`${card.key}:city`])}
                    onChange={(e) => updateCard(card.key, { city: e.target.value })}
                  />
                  {fieldErrors[`${card.key}:city`] && (
                    <p className="text-xs text-error">{fieldErrors[`${card.key}:city`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${card.key}-region`}>Region</Label>
                  <Input
                    id={`${card.key}-region`}
                    disabled={!canEdit}
                    value={card.region}
                    onChange={(e) => updateCard(card.key, { region: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`${card.key}-description`}>Description</Label>
                  <Textarea
                    id={`${card.key}-description`}
                    disabled={!canEdit}
                    value={card.description}
                    aria-invalid={Boolean(fieldErrors[`${card.key}:description`])}
                    onKeyDown={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateCard(card.key, { description: e.target.value })
                    }
                  />
                  {fieldErrors[`${card.key}:description`] && (
                    <p className="text-xs text-error">
                      {fieldErrors[`${card.key}:description`]}
                    </p>
                  )}
                </div>
                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor={`${card.key}-image`}>Image</Label>
                  <div className="max-w-xs overflow-hidden rounded-md border border-border bg-card/40">
                    <CardImagePreview
                      src={imageSrc}
                      alt={card.name.trim() || `Area ${index + 1}`}
                    />
                    {canEdit && (pending || card.image.trim()) && (
                      <div className="flex justify-end border-t border-border p-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => clearImage(card.key)}
                        >
                          <X />
                          Remove image
                        </Button>
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <Input
                      id={`${card.key}-image`}
                      type="file"
                      accept={IMAGE_ACCEPT}
                      disabled={saving}
                      onChange={(e) => {
                        const list = Array.from(e.target.files ?? []);
                        e.target.value = "";
                        chooseImage(card.key, list);
                      }}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WEBP, or GIF. Max 5 MB. The new file uploads when you save.
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`${card.key}-button`}>Button label</Label>
                  <Input
                    id={`${card.key}-button`}
                    disabled={!canEdit}
                    value={card.buttonLabel}
                    onChange={(e) =>
                      updateCard(card.key, { buttonLabel: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on the area. It does not register interest.
                  </p>
                </div>
              </FormSection>
            );
          })
        )}
      </form>

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        onOpenChange={(open) => {
          if (!open) setRemoveKey(null);
        }}
        title="Remove this area?"
        description={
          pendingRemove
            ? `${pendingRemove.name || "This area"} will be removed from the section.`
            : ""
        }
        confirmLabel="Remove area"
        destructive
        loading={saving && Boolean(pendingRemove)}
        onConfirm={() => {
          if (!pendingRemove) return;
          const remaining = draft.cards.filter((card) => card.key !== pendingRemove.key);
          void persistSection(draft.published, {
            cards: remaining,
            successMessage: "Area removed.",
          }).then((result) => {
            if (result !== "failed") setRemoveKey(null);
          });
        }}
      />
      <ConfirmDialog
        open={publishPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setPublishPrompt(null);
        }}
        title={publishPrompt ? "Publish these areas?" : "Hide these areas?"}
        description={
          publishPrompt
            ? "Investors will see this section in Explore."
            : "Investors will no longer see this section."
        }
        confirmLabel={publishPrompt ? "Publish" : "Unpublish"}
        destructive={publishPrompt === false}
        loading={saving && publishPrompt !== null}
        onConfirm={() => {
          if (publishPrompt === null) return;
          void persistSection(publishPrompt).then((result) => {
            if (result !== "failed") setPublishPrompt(null);
          });
        }}
      />
    </div>
  );
}
