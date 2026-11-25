# Qiko Scope — WhatsApp Sales Worker

**Audience:** Qiko team  
**Related contract:** `docs/whatsapp-worker-api.md`  
**UI references:**
- [Lead detail](https://jm-admin-panel-vercel1.vercel.app/whatsapp/leads/lead-sarah)
- [Webinar detail](https://jm-admin-panel-vercel1.vercel.app/whatsapp/webinars/web-bham)

---

## 1. Purpose of this document

This document lists **what Qiko must build and own**.

JM Backend will call Qiko APIs.  
Admin Panel will call only JM Backend.

```
Admin Panel  →  JM Backend  →  Qiko
```

Qiko is responsible for:

1. Storing WhatsApp leads  
2. Running the WhatsApp worker (“Joe”)  
3. Storing conversation messages  
4. Matching webinars to leads  
5. Sending WhatsApp webinar templates to matched leads  
6. Exposing APIs so JM Backend can land leads, read/update data, and trigger outreach  

---

## 2. What Qiko must deliver

### A. Lead intake + worker processing

| # | Deliverable |
|---|-------------|
| 1 | API to **land / upsert a lead** when JM Backend posts it |
| 2 | Start WhatsApp worker processing after lead lands |
| 3 | Qualify the lead (market, budget, funding, timeline, locations, interest, readiness) |
| 4 | Keep lead status / stage / qualification % up to date |
| 5 | Store conversation summary + profile notes for admin |
| 6 | Store WhatsApp message history (inbound / outbound) |
| 7 | Support handoff, consent, and opt-out flags |
| 8 | APIs so JM Backend can **update**, **append messages**, **get one lead**, **list leads** |

### B. Webinar matching + template send

| # | Deliverable |
|---|-------------|
| 9 | API to **create / store a webinar** when JM Backend posts it |
| 10 | **Match webinar → leads** using webinar criteria |
| 11 | Return matched lead ids + audience preview to JM Backend |
| 12 | Optional API to **re-run matching** |
| 13 | API to **trigger webinar WhatsApp template** to matched leads when admin launches |
| 14 | Track engagement (invited / opened / replied / registered / attended) |
| 15 | Skip opted-out / no-consent leads on send |

---

## 3. APIs Qiko must expose

JM Backend will call these Qiko endpoints.

### Leads

| API | Method / path | Qiko must do |
|-----|---------------|--------------|
| **A** | `POST /v1/whatsapp/leads` | Land lead; start worker |
| **B** | `PUT /v1/whatsapp/leads/{id}` | Accept / apply lead updates |
| **C** | `POST /v1/whatsapp/leads/{id}/messages` | Store conversation messages |
| **D** | `GET /v1/whatsapp/leads/{id}` | Return full lead + messages (admin detail) |
| **E** | `GET /v1/whatsapp/leads` | Return lead pool (filters + pagination) |

### Webinars

| API | Method / path | Qiko must do |
|-----|---------------|--------------|
| **F** | `POST /v1/whatsapp/webinars` | Create webinar; match leads; return matches |
| **G** | `GET /v1/whatsapp/webinars/{id}` | Return webinar + matched leads + audience + engagement |
| **H** | `GET /v1/whatsapp/webinars` | Return webinar list |
| **I** | `POST /v1/whatsapp/webinars/{id}/match` | Re-run lead matching |
| **J** | `POST /v1/whatsapp/webinars/{id}/send-template` | Send WhatsApp template to matched leads |

Full request/response field lists are in `whatsapp-worker-api.md`.

---

## 4. Lead landing flow (Qiko side)

```
1. JM Backend calls POST /v1/whatsapp/leads
2. Qiko creates or upserts the lead
3. Qiko starts WhatsApp worker (“Joe”)
4. Worker chats / qualifies on WhatsApp
5. Qiko stores:
   - lead fields (status, interest, readiness, budget, …)
   - conversationSummary / profileNotes
   - messages[]
   - lastContactedAt / lastResponseAt
   - handoffRequested / whatsappConsent / optedOut
6. JM Backend can GET / PUT / append messages at any time
```

### Lead fields Qiko must support

Identity: `id`, `name`, `email`, `phone`, `source`, `assignedRep`, `assignedRepId`  

Pipeline: `status`, `interest`, `readiness`, `stage`, `qualificationPct`, `outreachNote`, `handoffRequested`, `whatsappConsent`, `optedOut`  

Qualification: `market`, `budget`, `funding`, `timeline`, `preferredLocations`  

Evidence: `conversationSummary`, `profileNotes`, `lastContactedAt`, `lastResponseAt`, `recommendedAction`  

Messages:

- `id`, `direction` (`inbound` / `outbound`)
- `sender` (`lead` / `worker` / `human` / `system`)
- `body`, `sentAt`, `channel`, `providerMessageId`, `status`

### Status values Qiko must support

`New`, `Not Contacted`, `Contacted`, `Active Conversation`, `Qualified`, `Nurture`, `High Intent`, `Human Handoff`, `No Response`, `Closed`, `Opted Out`

---

## 5. Webinar flow (Qiko side)

```
1. JM Backend calls POST /v1/whatsapp/webinars
2. Qiko stores the webinar
3. Qiko agent matches leads using webinar criteria / market / locations / budget / readiness
4. Qiko returns:
   - relevantLeadIds
   - matchedLeads (summary)
   - audience preview (total, matching, eligible, opted out, final)
5. Admin reviews matches in Admin Panel
6. Admin clicks Launch
7. JM Backend calls POST /v1/whatsapp/webinars/{id}/send-template
8. Qiko sends WhatsApp webinar template to final eligible matched leads
9. Qiko updates engagement counters
```

### Webinar fields Qiko must support

Campaign: `id`, `title`, `description`, `market`, `scheduledAt`, `timezone`, `status`, `outreachMode`  

Matching: `suggestedCriteria`, `relevantLeadIds`, `matchedLeads`  

Audience: `total`, `matching`, `whatsappEligible`, `excludedNoConsent`, `optedOut`, `finalAudience`  

Engagement: `invited`, `opened`, `replied`, `registered`, `attended`  

Template: `templateId`, `templateName`, `templateLanguage`, `templateVariables`

### Campaign status values

`Draft` → `Scheduled` → `Active` → `Completed` / `Cancelled`

### Matching rules (minimum)

When a webinar is created (or match is re-run), Qiko should score / filter leads using things like:

- Market focus vs webinar market  
- Preferred locations vs webinar location theme  
- Budget thresholds from criteria  
- Readiness / interest  
- Exclude `optedOut = true` from final sendable audience  
- Exclude `whatsappConsent = false` from WhatsApp-eligible count  

Exact scoring can improve over time; API must always return the matched set + audience counts.

### Send-template rules (minimum)

On `send-template`:

- Use provided `leadIds`, or fall back to current matched / final audience  
- If `onlyWhatsappEligible` / `excludeOptedOut` are true, skip those leads  
- Queue WhatsApp template send via Interakt / provider  
- Return `requested`, `queued`, `skipped`, `skippedReasons`, `leadIds`  
- Move campaign status toward `Active` when outreach starts  
- Increment `engagement.invited` for successfully queued sends  

---

## 6. What Qiko does NOT own

| Item | Owner |
|------|--------|
| Admin Panel UI | JM Admin |
| Admin-facing `/admin/whatsapp/*` routes | JM Backend |
| Calling Qiko from the browser | Not allowed — only JM Backend |

Qiko only needs to expose the `/v1/whatsapp/*` APIs and run the worker + matching + template send.

---

## 7. Suggested build order for Qiko

| Phase | Work |
|-------|------|
| **1** | Lead land API (`POST /leads`) + store lead model |
| **2** | Worker processing + update lead fields |
| **3** | Messages API + GET lead detail / list |
| **4** | Webinar create + lead matching + return matches |
| **5** | Send-template API + engagement tracking |
| **6** | Re-match + list webinars polish |

---

## 8. Done criteria (Qiko)

### Leads

- [ ] JM Backend can land a lead with `POST /v1/whatsapp/leads`  
- [ ] Worker starts after land  
- [ ] Lead detail fields needed by Sarah screen are stored and returned  
- [ ] Conversation messages can be appended and returned  
- [ ] Handoff / consent / opt-out work  
- [ ] List + filters work for the lead pool  

### Webinars

- [ ] JM Backend can create a webinar with `POST /v1/whatsapp/webinars`  
- [ ] Qiko returns matched leads + audience on create  
- [ ] GET webinar returns Birmingham-screen data  
- [ ] Admin launch → `send-template` sends WhatsApp template to matched eligible leads  
- [ ] Skipped leads reported  
- [ ] Engagement counters update  

---

## 9. Reference

For full JSON examples and field tables, use:

- `docs/whatsapp-worker-api.md`  
- `docs/whatsapp-worker-api.docx`  
