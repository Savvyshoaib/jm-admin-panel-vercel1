import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSection } from "@/components/admin/FormSection";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import type { PropertyUnit } from "@/models";
import { createInvitation, listProperties } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureAgents } from "@/store/slices/agentsSlice";
import { invalidateInvestors, upsertInvestor } from "@/store/slices/investorsSlice";

function SortableInviteRecommendedRow({
  property,
  index,
  disabled,
  onRemove,
}: {
  property: PropertyUnit;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: property.id, disabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-muted/40" : undefined}
    >
      <TableCell className="w-10 px-2">
        <button
          type="button"
          className="inline-flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:pointer-events-none disabled:opacity-40"
          aria-label={`Reorder ${property.name}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </TableCell>
      <TableCell className="w-14 tabular-nums text-muted-foreground">
        {index + 1}
      </TableCell>
      <TableCell className="min-w-0 font-medium">
        <Link
          href={`/properties/${property.id}`}
          className="truncate hover:underline"
          onClick={(e) => {
            if (isDragging) e.preventDefault();
          }}
        >
          {property.name}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {property.reference || "—"}
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        {property.city || "—"}
      </TableCell>
      <TableCell className="w-12 text-right">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${property.name}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function InviteInvestorPage() {
  const { canMutate } = useAuth();
  const dispatch = useAppDispatch();
  const [, setLocation] = useLocation();
  const agentsState = useAppSelector((s) => s.agents);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agentId, setAgentId] = useState<string>("none");
  const [properties, setProperties] = useState<PropertyUnit[]>([]);
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [recommendedProps, setRecommendedProps] = useState<string[]>([]);
  const [addValue, setAddValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [propsLoading, setPropsLoading] = useState(true);

  useEffect(() => {
    void dispatch(ensureAgents())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load agents.");
      });
    listProperties()
      .then(setProperties)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Unable to load properties.");
      })
      .finally(() => setPropsLoading(false));
  }, [dispatch]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const recommended = useMemo(
    () =>
      recommendedProps
        .map((id) => properties.find((p) => p.id === id))
        .filter((p): p is PropertyUnit => !!p),
    [recommendedProps, properties],
  );

  const addOptions = useMemo(
    () =>
      properties
        .filter((p) => !recommendedProps.includes(p.id))
        .map((p) => ({
          value: p.id,
          label: p.name,
          keywords: `${p.reference ?? ""} ${p.city ?? ""} ${p.address ?? ""}`,
        })),
    [properties, recommendedProps],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (saving) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = recommendedProps.indexOf(String(active.id));
    const newIndex = recommendedProps.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setRecommendedProps(arrayMove(recommendedProps, oldIndex, newIndex));
  };

  const addProperty = (id: string) => {
    if (!id || recommendedProps.includes(id)) return;
    setRecommendedProps((prev) => [...prev, id]);
    setAddValue("");
  };

  if (!canMutate("investors")) {
    return (
      <PageHeader
        title="Invite investor"
        description="You do not have permission to invite investors."
      />
    );
  }

  const agentsLoading =
    (agentsState.status === "loading" || agentsState.status === "idle") &&
    agentsState.items.length === 0;

  if (agentsLoading || propsLoading) return <LoadingBlock variant="form" />;

  const agents = agentsState.items;

  return (
    <div>
      <PageHeader
        title="Invite investor"
        description="Create an investor record, assign an agent, optionally attach properties, and send an invitation."
        breadcrumbs={[
          { label: "Investors", href: "/investors" },
          { label: "Invite" },
        ]}
      />

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            const { investor } = await createInvitation({
              name,
              email,
              assignedAgentId: agentId === "none" ? null : agentId,
              propertyIds: selectedProps,
              recommendedPropertyIds: recommendedProps,
            });
            dispatch(upsertInvestor(investor));
            dispatch(invalidateInvestors());
            toast.success("Invitation sent");
            setLocation(`/investors/${investor.id}`);
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Unable to send invitation.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <FormSection title="Investor details">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Assigned agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>

        <FormSection
          title="Recommended properties"
          description="Optional. Shown on the investor Explore page — drag rows to set display order."
        >
          <div className="space-y-3 md:col-span-2">
            {recommended.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommended properties.</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={recommended.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 px-2" />
                          <TableHead className="w-14">S.No</TableHead>
                          <TableHead>Property</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="hidden sm:table-cell">City</TableHead>
                          <TableHead className="w-12 text-right">
                            <span className="sr-only">Remove</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recommended.map((p, index) => (
                          <SortableInviteRecommendedRow
                            key={p.id}
                            property={p}
                            index={index}
                            disabled={saving}
                            onRemove={() =>
                              setRecommendedProps((prev) =>
                                prev.filter((id) => id !== p.id),
                              )
                            }
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-recommended-add">Add property</Label>
              <SearchableSelect
                id="invite-recommended-add"
                value={addValue}
                onValueChange={addProperty}
                options={addOptions}
                placeholder={
                  addOptions.length === 0
                    ? "All properties already selected"
                    : "Search and add a property…"
                }
                searchPlaceholder="Search properties…"
                emptyMessage="No properties found"
                disabled={saving || addOptions.length === 0}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Optional property assignment"
          description="Assign existing properties to the investor portfolio after acceptance."
        >
          <div className="md:col-span-2 space-y-3">
            {properties.slice(0, 8).map((p) => (
              <label key={p.id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={selectedProps.includes(p.id)}
                  onCheckedChange={(checked) => {
                    setSelectedProps((prev) =>
                      checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                    );
                  }}
                />
                <span>
                  {p.name} <span className="text-muted-foreground">· {p.reference}</span>
                </span>
              </label>
            ))}
          </div>
        </FormSection>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send invitation"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setLocation("/investors")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
