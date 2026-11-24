import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { ContentInvestorPreview } from "@/components/admin/ContentInvestorPreview";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import type { ContentBlock } from "@/models";
import { getContent } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { ensureProperties } from "@/store/slices/propertiesSlice";

export function ContentPreviewPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const dispatch = useAppDispatch();
  const properties = useAppSelector((s) => s.properties.items);
  const contentId = params.id?.trim() ?? "";
  const [block, setBlock] = useState<ContentBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(ensureProperties()).unwrap().catch(() => undefined);
  }, [dispatch]);

  useEffect(() => {
    if (!contentId) {
      setLoading(false);
      setError("Content not found.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getContent(contentId)
      .then((item) => {
        if (cancelled) return;
        if (!item) {
          setBlock(null);
          setError("Content not found.");
          return;
        }
        setBlock(item);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Unable to load preview.";
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentId]);

  const propertyName = useMemo(() => {
    if (!block?.propertyId) return null;
    const match = properties.find(
      (p) => String(p.id) === String(block.propertyId),
    );
    return match?.name || match?.reference || null;
  }, [block?.propertyId, properties]);

  const goBack = () => {
    if (block?.propertyId) {
      setLocation(
        `/content?propertyId=${encodeURIComponent(String(block.propertyId))}`,
      );
      return;
    }
    if (contentId) {
      setLocation(`/content/${contentId}`);
      return;
    }
    setLocation("/properties");
  };

  if (loading) return <LoadingBlock variant="detail" />;

  if (error || !block) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <PageHeader
          title="Content preview"
          breadcrumbs={[
            { label: "Properties", href: "/properties" },
            { label: "Preview" },
          ]}
          actions={
            <Button type="button" variant="outline" onClick={goBack}>
              Back
            </Button>
          }
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {error ?? "Content not found."}
          <div className="mt-3">
            <Button variant="outline" onClick={() => setLocation("/properties")}>
              Back to properties
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <PageHeader
        title={block.title || "Content preview"}
        description="Investor-facing preview of this content block."
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          ...(block.propertyId
            ? [
                {
                  label: propertyName || "Property",
                  href: `/properties/${block.propertyId}`,
                },
                {
                  label: "Content",
                  href: `/content?propertyId=${encodeURIComponent(
                    String(block.propertyId),
                  )}`,
                },
              ]
            : []),
          {
            label: block.title || block.key || "Edit",
            href: contentId ? `/content/${contentId}` : undefined,
          },
          { label: "Preview" },
        ]}
        actions={
          <Button type="button" variant="outline" onClick={goBack}>
            Back
          </Button>
        }
      />

      <ContentInvestorPreview
        title={block.title}
        body={block.body}
        contentKey={block.key}
        area={block.area}
        status={block.status}
        propertyName={propertyName}
        documents={block.documents ?? []}
        images={block.images ?? []}
        videos={block.videos ?? []}
        pendingDocs={[]}
        pendingImages={[]}
        pendingVideos={[]}
      />
    </div>
  );
}
