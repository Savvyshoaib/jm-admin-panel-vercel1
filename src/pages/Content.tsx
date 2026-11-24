import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Redirect, useLocation, useSearch } from "wouter";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import type { ContentBlock } from "@/models";
import { deleteContent } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  ensureContent,
  invalidateContent,
  removeContent,
} from "@/store/slices/contentSlice";
import { ensureProperties } from "@/store/slices/propertiesSlice";

export function ContentPage() {
  const { can } = useAuth();
  const canPublish =
    can("manage_content", "content") || can("publish", "content");
  const canView = can("view", "content") || canPublish;
  const dispatch = useAppDispatch();
  const contentState = useAppSelector((s) => s.content);
  const propertiesState = useAppSelector((s) => s.properties);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const propertyId =
    new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get(
      "propertyId",
    ) ?? null;

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentBlock | null>(null);

  useEffect(() => {
    void dispatch(ensureContent())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load content.");
      });
    void dispatch(ensureProperties()).unwrap().catch(() => undefined);
  }, [dispatch, contentState.invalidated]);

  const property = useMemo(() => {
    if (!propertyId) return null;
    return (
      propertiesState.items.find((p) => String(p.id) === String(propertyId)) ??
      null
    );
  }, [propertiesState.items, propertyId]);

  const rows = useMemo(() => {
    if (!propertyId) return [];
    return contentState.items.filter(
      (c) => c.propertyId && String(c.propertyId) === String(propertyId),
    );
  }, [contentState.items, propertyId]);

  // Content is entered from a property — require propertyId.
  if (!propertyId) {
    return <Redirect to="/properties" />;
  }

  if (!canView) {
    return <Redirect to={`/properties/${propertyId}`} />;
  }

  const openEditor = (block: ContentBlock) => {
    if (!block.id) {
      setLocation(`/content/new?propertyId=${encodeURIComponent(propertyId)}`);
      return;
    }
    setLocation(`/content/${block.id}`);
  };

  const requestDelete = (block: ContentBlock) => {
    if (!block.id) return;
    setDeleteTarget(block);
    setConfirmDelete(true);
  };

  const handleDelete = async () => {
    const id = deleteTarget?.id;
    if (!id) return;
    setDeleting(true);
    try {
      await deleteContent(id);
      dispatch(removeContent(id));
      dispatch(invalidateContent());
      toast.success("Content deleted");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to delete content.",
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
      setDeleteTarget(null);
    }
  };

  const columns: Column<ContentBlock>[] = [
    { key: "title", header: "Title", cell: (r) => r.title || "—" },
    {
      key: "property",
      header: "Property",
      mobileHidden: true,
      cell: (r) => {
        if (!r.propertyId) return "—";
        const match = propertiesState.items.find(
          (p) => String(p.id) === String(r.propertyId),
        );
        return (
          match?.name ||
          match?.reference ||
          property?.name ||
          property?.reference ||
          String(r.propertyId)
        );
      },
    },
    {
      key: "key",
      header: "Key",
      cell: (r) => <span className="font-mono text-xs">{r.key}</span>,
    },
    { key: "area", header: "Area", cell: (r) => r.area || "—" },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "updated",
      header: "Updated",
      cell: (r) => formatDateTime(r.updatedAt),
      mobileHidden: true,
    },
    {
      key: "preview",
      header: "Preview",
      className: "w-[1%] whitespace-nowrap",
      cell: (r) =>
        r.id ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-auto px-0 text-primary underline-offset-4 hover:bg-transparent hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/content/${r.id}/preview`);
            }}
          >
            View
          </Button>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[1%] whitespace-nowrap",
      cell: (r) =>
        canPublish ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 w-full gap-2 sm:min-h-8 sm:w-auto"
                disabled={deleting}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
                Manage
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={6}
              className="w-44 bg-background"
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openEditor(r);
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!r.id || deleting}
                onClick={(e) => {
                  e.stopPropagation();
                  requestDelete(r);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          "—"
        ),
    },
  ];

  const loading =
    (contentState.status === "loading" || contentState.status === "idle") &&
    contentState.items.length === 0;

  if (loading) return <LoadingBlock variant="table" />;

  if (contentState.status === "failed" && contentState.items.length === 0) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <PageHeader
          title="Content"
          description="Investor-facing content for this property."
          breadcrumbs={[
            { label: "Properties", href: "/properties" },
            {
              label: property?.name || property?.reference || "Property",
              href: `/properties/${propertyId}`,
            },
            { label: "Content" },
          ]}
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {contentState.error ?? "Unable to load content."}
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => void dispatch(ensureContent({ force: true }))}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const propertyLabel =
    property?.name || property?.reference || `Property ${propertyId}`;

  return (
    <div className="w-full min-w-0">
      <PageHeader
        title="Content"
        description={`All content blocks linked to ${propertyLabel}. A property can have multiple content blocks.`}
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          {
            label: propertyLabel,
            href: `/properties/${propertyId}`,
          },
          { label: "Content" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation(`/properties/${propertyId}`)}
            >
              Back to property
            </Button>
            {canPublish ? (
              <Button
                type="button"
                onClick={() =>
                  setLocation(
                    `/content/new?propertyId=${encodeURIComponent(propertyId)}`,
                  )
                }
              >
                Add content
              </Button>
            ) : null}
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id || r.key}
        onRowClick={(r) => openEditor(r)}
        emptyTitle="No content yet"
        emptyDescription="Add a content block for this property."
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open);
          if (!open) setDeleteTarget(null);
        }}
        title="Delete content block?"
        description={
          deleteTarget
            ? `“${deleteTarget.title || deleteTarget.key}” will be soft-deleted. Media files remain on disk.`
            : "This soft-deletes the content block. Media files remain on disk."
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
