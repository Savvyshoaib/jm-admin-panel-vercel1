import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSection } from "@/components/admin/FormSection";
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
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { createInvestor } from "@/services/api";
import { COUNTRIES, NATIONALITIES } from "@/lib/locations";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureAgents } from "@/store/slices/agentsSlice";
import { invalidateInvestors, upsertInvestor } from "@/store/slices/investorsSlice";

const createInvestorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .max(40, "Phone is too long")
    .refine(
      (v) => v === "" || /^[+]?[\d\s().-]{7,}$/.test(v),
      "Enter a valid phone number",
    ),
  country: z.string().min(1, "Country is required"),
  nationality: z.string().min(1, "Nationality is required"),
  residencyStatus: z.enum(["uk_resident", "non_uk_resident", "unknown"]),
  assignedAgentId: z.string(),
  accountStatus: z.enum(["active", "inactive", "pending"]),
  invitationStatus: z.enum([
    "none",
    "created",
    "sent",
    "delivered",
    "opened",
    "accepted",
    "expired",
    "revoked",
  ]),
  propertiesOwned: z
    .number({ error: "Enter a valid number" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(9999, "Value is too large"),
  buyingPower: z
    .number({ error: "Enter a valid amount" })
    .min(0, "Cannot be negative")
    .max(1_000_000_000, "Value is too large"),
  riskAppetite: z.enum(["cautious", "balanced", "growth"]),
});

type CreateInvestorValues = z.infer<typeof createInvestorSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-error" role="alert">
      {message}
    </p>
  );
}

export function InvestorNewPage() {
  const { canMutate } = useAuth();
  const dispatch = useAppDispatch();
  const [, setLocation] = useLocation();
  const agentsState = useAppSelector((s) => s.agents);

  const form = useForm<CreateInvestorValues>({
    resolver: zodResolver(createInvestorSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      country: "United Kingdom",
      nationality: "British",
      residencyStatus: "uk_resident",
      assignedAgentId: "none",
      accountStatus: "pending",
      invitationStatus: "none",
      propertiesOwned: 0,
      buyingPower: 0,
      riskAppetite: "balanced",
    },
  });

  useEffect(() => {
    void dispatch(ensureAgents())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load agents.");
      });
  }, [dispatch]);

  if (!canMutate("investors")) {
    return <PageHeader title="Add investor" description="Permission denied." />;
  }

  const agentsLoading =
    (agentsState.status === "loading" || agentsState.status === "idle") &&
    agentsState.items.length === 0;

  if (agentsLoading) return <LoadingBlock variant="form" />;

  const agents = agentsState.items;
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const investor = await createInvestor({
        name: values.name,
        email: values.email,
        phone: values.phone,
        country: values.country,
        nationality: values.nationality,
        residencyStatus: values.residencyStatus,
        assignedAgentId:
          values.assignedAgentId === "none" ? null : values.assignedAgentId,
        accountStatus: values.accountStatus,
        invitationStatus:
          values.invitationStatus === "none" ? null : values.invitationStatus,
        propertiesOwned: values.propertiesOwned,
        buyingPower: values.buyingPower,
        riskAppetite: values.riskAppetite,
      });
      dispatch(upsertInvestor(investor));
      dispatch(invalidateInvestors());
      toast.success("Investor created");
      setLocation(`/investors/${investor.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create investor.");
    }
  });

  return (
    <div>
      <PageHeader
        title="Add investor"
        description="Creates an investor record and standard document folders. Use Invite to send access."
        breadcrumbs={[
          { label: "Investors", href: "/investors" },
          { label: "New" },
        ]}
      />
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormSection title="Contact">
          <div className="space-y-2">
            <Label htmlFor="name">Investor name</Label>
            <Input
              id="name"
              aria-invalid={!!errors.name}
              disabled={isSubmitting}
              {...form.register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              disabled={isSubmitting}
              {...form.register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+441234567890"
              aria-invalid={!!errors.phone}
              disabled={isSubmitting}
              {...form.register("phone")}
            />
            <FieldError message={errors.phone?.message} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Controller
              control={form.control}
              name="country"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.country}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.country?.message} />
          </div>
          <div className="space-y-2">
            <Label>Nationality</Label>
            <Controller
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.nationality}>
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONALITIES.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.nationality?.message} />
          </div>
          <div className="space-y-2">
            <Label>Residency</Label>
            <Controller
              control={form.control}
              name="residencyStatus"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.residencyStatus}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uk_resident">UK resident</SelectItem>
                    <SelectItem value="non_uk_resident">Non-UK resident</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.residencyStatus?.message} />
          </div>
        </FormSection>

        <FormSection title="Account & assignment">
          <div className="space-y-2">
            <Label>Assigned agent</Label>
            <Controller
              control={form.control}
              name="assignedAgentId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.assignedAgentId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.assignedAgentId?.message} />
          </div>
          <div className="space-y-2">
            <Label>Account status</Label>
            <Controller
              control={form.control}
              name="accountStatus"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.accountStatus}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.accountStatus?.message} />
          </div>
          <div className="space-y-2">
            <Label>Invitation status</Label>
            <Controller
              control={form.control}
              name="invitationStatus"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.invitationStatus}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.invitationStatus?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertiesOwned">Properties owned</Label>
            <Input
              id="propertiesOwned"
              type="number"
              min={0}
              step={1}
              aria-invalid={!!errors.propertiesOwned}
              disabled={isSubmitting}
              {...form.register("propertiesOwned", { valueAsNumber: true })}
            />
            <FieldError message={errors.propertiesOwned?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyingPower">Buying power</Label>
            <Input
              id="buyingPower"
              type="number"
              min={0}
              step={1000}
              aria-invalid={!!errors.buyingPower}
              disabled={isSubmitting}
              {...form.register("buyingPower", { valueAsNumber: true })}
            />
            <FieldError message={errors.buyingPower?.message} />
          </div>
          <div className="space-y-2">
            <Label>Risk appetite</Label>
            <Controller
              control={form.control}
              name="riskAppetite"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.riskAppetite}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cautious">Cautious</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.riskAppetite?.message} />
          </div>
        </FormSection>

        <p className="text-xs text-muted-foreground">
          Last active and date added are set automatically when the investor is created.
        </p>

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create investor"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => setLocation("/investors")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
