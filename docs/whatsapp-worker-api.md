# WhatsApp Sales Worker — Lead APIs

**UI reference:** [Lead detail (Sarah Jones)](https://jm-admin-panel-vercel1.vercel.app/whatsapp/leads/lead-sarah)

---

## 1. Rule

**All API calls go through JM Backend.**  
The Admin Panel never calls Qiko directly. JM Backend calls Qiko.

```
Admin Panel  →  JM Backend  →  Qiko
```

---

## 2. Steps — land a lead on Qiko

| Step | Who | Action |
|------|-----|--------|
| **1** | Source (upload / form / campaign / system) | Lead data reaches JM Backend |
| **2** | **JM Backend** | Calls **`POST`** on Qiko — lead is landed on Qiko |
| **3** | Qiko | Creates / upserts the lead; WhatsApp worker (“Joe”) starts processing |
| **4** | Qiko worker | Runs qualification and the WhatsApp conversation |
| **5** | **JM Backend** | Calls Qiko with **GET / PUT / POST** for updates and messages |
| **6** | Admin Panel | Reads data only from JM Backend (`/admin/whatsapp/*`) |

### Land lead (main step)

```
JM Backend  →  POST  {QIKO_BASE}/v1/whatsapp/leads
```

This POST lands the lead on Qiko. The worker then starts processing.

---

## 3. API list (JM Backend → Qiko)

| # | JM Backend (Admin calls this) | JM Backend → Qiko | Purpose |
|---|-------------------------------|-------------------|---------|
| **A** | `POST /admin/whatsapp/leads` | `POST /v1/whatsapp/leads` | **Land lead on Qiko** |
| **B** | `PUT /admin/whatsapp/leads/{id}` | `PUT /v1/whatsapp/leads/{id}` | Sync worker / profile updates |
| **C** | `POST /admin/whatsapp/leads/{id}/messages` | `POST /v1/whatsapp/leads/{id}/messages` | WhatsApp conversation messages |
| **D** | `GET /admin/whatsapp/leads/{id}` | `GET /v1/whatsapp/leads/{id}` | Lead detail (Sarah screen) |
| **E** | `GET /admin/whatsapp/leads` | `GET /v1/whatsapp/leads` | Lead pool list |

---

## 4. Lead parameters (Sarah detail screen)

Everything shown on [lead detail](https://jm-admin-panel-vercel1.vercel.app/whatsapp/leads/lead-sarah) must be available in the APIs.

### Identity & contact

| Field | Type | UI |
|-------|------|-----|
| `id` | string | `/whatsapp/leads/{id}` |
| `name` | string | Title |
| `email` | string | Contact → Email |
| `phone` | string | Contact → WhatsApp / mobile |
| `source` | string | Source |
| `assignedRep` | string | Assigned rep |
| `assignedRepId` | string \| null | Optional |

### Pipeline & status

| Field | Type | Values |
|-------|------|--------|
| `status` | string | `New`, `Not Contacted`, `Contacted`, `Active Conversation`, `Qualified`, `Nurture`, `High Intent`, `Human Handoff`, `No Response`, `Closed`, `Opted Out` |
| `interest` | string | `High`, `Medium`, `Low`, `Unknown` |
| `readiness` | string | `Ready Now`, `Near Term`, `Exploring`, `Unknown` |
| `stage` | string | e.g. `Qualification - budget & location` |
| `qualificationPct` | number | `0`–`100` |
| `outreachNote` | string | Outreach note |
| `handoffRequested` | boolean | Human handoff |
| `whatsappConsent` | boolean | WhatsApp eligible |
| `optedOut` | boolean | Opted out |

### Qualification

| Field | Type |
|-------|------|
| `market` | `UK` \| `UAE` \| `UK + UAE` \| `Undecided` |
| `budget` | number \| null |
| `funding` | string |
| `timeline` | string |
| `preferredLocations` | string[] |

### Conversation / evidence

| Field | Type |
|-------|------|
| `conversationSummary` | string |
| `profileNotes` | string |
| `lastContactedAt` | ISO string \| null |
| `lastResponseAt` | ISO string \| null |
| `recommendedAction` | object \| null |

```json
{
  "title": "Continue qualification",
  "detail": "Discussing Birmingham stock…",
  "cta": "Follow up"
}
```

### WhatsApp messages

| Field | Type |
|-------|------|
| `messages[].id` | string |
| `messages[].direction` | `inbound` \| `outbound` |
| `messages[].sender` | `lead` \| `worker` \| `human` \| `system` |
| `messages[].body` | string |
| `messages[].sentAt` | ISO string |
| `messages[].channel` | string (`whatsapp`) |
| `messages[].providerMessageId` | string \| null |
| `messages[].status` | `sent` \| `delivered` \| `read` \| `failed` \| null |

Timestamps use ISO 8601 UTC.

---

## 5. API A — Land lead on Qiko

**Step:** JM Backend calls Qiko with `POST`.

- Admin / system → `POST /admin/whatsapp/leads`
- JM Backend → `POST {QIKO}/v1/whatsapp/leads`

### Body

```json
{
  "id": "lead-sarah",
  "name": "Sarah Jones",
  "email": "sarah.jones@example.com",
  "phone": "+447700900123",
  "market": "UK",
  "budget": 250000,
  "interest": "Unknown",
  "readiness": "Unknown",
  "status": "New",
  "source": "How to Invest in UK Property",
  "assignedRep": "Johnny Conran",
  "assignedRepId": null,
  "conversationSummary": "",
  "profileNotes": "",
  "stage": "New",
  "qualificationPct": 0,
  "outreachNote": "Awaiting first touch",
  "lastContactedAt": null,
  "lastResponseAt": null,
  "handoffRequested": false,
  "whatsappConsent": true,
  "optedOut": false,
  "funding": "Unknown",
  "timeline": "Unknown",
  "preferredLocations": [],
  "externalRefs": {
    "qikoLeadId": "lead-sarah",
    "interaktContactId": null,
    "campaignId": "web-uk-invest"
  }
}
```

### Minimum on create

`id` (or phone), `name`, `phone`, `whatsappConsent`, `status`, `source`

### Response

```json
{
  "message": "Lead landed on Qiko.",
  "data": { "...full lead..." }
}
```

---

## 6. API B — Update lead (after worker processing)

- Admin → `PUT /admin/whatsapp/leads/{id}`
- JM Backend → `PUT {QIKO}/v1/whatsapp/leads/{id}`

### Body (Sarah screen example)

```json
{
  "name": "Sarah Jones",
  "email": "sarah.jones@example.com",
  "phone": "+447700900123",
  "market": "UK",
  "budget": 250000,
  "interest": "High",
  "readiness": "Near Term",
  "status": "Active Conversation",
  "source": "How to Invest in UK Property",
  "assignedRep": "Johnny Conran",
  "conversationSummary": "Discussing Birmingham stock and mortgage eligibility ahead of the next UK webinar.",
  "profileNotes": "Interested in Birmingham property. Mortgage-funded. Budget around £250k and expects to invest within four months.",
  "stage": "Qualification - budget & location",
  "qualificationPct": 65,
  "outreachNote": "Entered qualification",
  "lastContactedAt": "2026-11-25T19:30:00.000Z",
  "lastResponseAt": "2026-11-25T20:01:00.000Z",
  "handoffRequested": false,
  "whatsappConsent": true,
  "optedOut": false,
  "funding": "Mortgage",
  "timeline": "Within 4 months",
  "preferredLocations": ["Birmingham", "Midlands"],
  "recommendedAction": {
    "title": "Continue qualification",
    "detail": "Discussing Birmingham stock and mortgage eligibility ahead of the next UK webinar.",
    "cta": "Follow up"
  },
  "worker": {
    "name": "Joe - WhatsApp Sales",
    "channelConnected": true,
    "provider": "interakt"
  }
}
```

---

## 7. API C — Conversation messages

- Admin → `POST /admin/whatsapp/leads/{id}/messages`
- JM Backend → `POST {QIKO}/v1/whatsapp/leads/{id}/messages`

```json
{
  "messages": [
    {
      "id": "msg-1001",
      "direction": "outbound",
      "sender": "worker",
      "body": "Hi Sarah — thanks for joining How to Invest in UK Property. Are you focusing on Birmingham or the wider Midlands?",
      "sentAt": "2026-11-25T19:30:00.000Z",
      "channel": "whatsapp",
      "providerMessageId": "intakt-abc",
      "status": "read"
    },
    {
      "id": "msg-1002",
      "direction": "inbound",
      "sender": "lead",
      "body": "Birmingham mainly. Looking at around £250k with a mortgage.",
      "sentAt": "2026-11-25T20:01:00.000Z",
      "channel": "whatsapp",
      "providerMessageId": "intakt-def",
      "status": "delivered"
    }
  ]
}
```

Also update the lead when messages arrive:

- outbound → `lastContactedAt`
- inbound → `lastResponseAt`
- summary refresh → `conversationSummary`

---

## 8. API D — Get lead detail

- Admin → `GET /admin/whatsapp/leads/{id}`
- JM Backend → `GET {QIKO}/v1/whatsapp/leads/{id}`

### Response `data`

```json
{
  "id": "lead-sarah",
  "name": "Sarah Jones",
  "email": "sarah.jones@example.com",
  "phone": "+447700900123",
  "market": "UK",
  "budget": 250000,
  "interest": "High",
  "readiness": "Near Term",
  "status": "Active Conversation",
  "source": "How to Invest in UK Property",
  "assignedRep": "Johnny Conran",
  "conversationSummary": "Discussing Birmingham stock and mortgage eligibility ahead of the next UK webinar.",
  "profileNotes": "Interested in Birmingham property. Mortgage-funded. Budget around £250k and expects to invest within four months.",
  "stage": "Qualification - budget & location",
  "qualificationPct": 65,
  "outreachNote": "Entered qualification",
  "lastContactedAt": "2026-11-25T19:30:00.000Z",
  "lastResponseAt": "2026-11-25T20:01:00.000Z",
  "handoffRequested": false,
  "whatsappConsent": true,
  "optedOut": false,
  "funding": "Mortgage",
  "timeline": "Within 4 months",
  "preferredLocations": ["Birmingham", "Midlands"],
  "recommendedAction": {
    "title": "Continue qualification",
    "detail": "Discussing Birmingham stock and mortgage eligibility ahead of the next UK webinar.",
    "cta": "Follow up"
  },
  "worker": {
    "name": "Joe - WhatsApp Sales",
    "channelConnected": true,
    "provider": "interakt"
  },
  "messages": [
    {
      "id": "msg-1001",
      "direction": "outbound",
      "sender": "worker",
      "body": "Hi Sarah — thanks for joining…",
      "sentAt": "2026-11-25T19:30:00.000Z",
      "channel": "whatsapp",
      "providerMessageId": "intakt-abc",
      "status": "read"
    },
    {
      "id": "msg-1002",
      "direction": "inbound",
      "sender": "lead",
      "body": "Birmingham mainly. Looking at around £250k with a mortgage.",
      "sentAt": "2026-11-25T20:01:00.000Z",
      "channel": "whatsapp",
      "providerMessageId": "intakt-def",
      "status": "delivered"
    }
  ]
}
```

---

## 9. API E — List leads

- Admin → `GET /admin/whatsapp/leads`
- JM Backend → `GET {QIKO}/v1/whatsapp/leads`

### Query

| Param | Example |
|-------|---------|
| `q` | search name / email / phone |
| `status` | `High Intent` |
| `interest` | `High` |
| `assignedRep` | rep name |
| `handoff` | `true` |
| `limit` | `50` |
| `offset` | `0` |

### Response

```json
{
  "message": "Success.",
  "data": {
    "items": [{ "...lead summary..." }],
    "total": 12
  }
}
```

List responses can omit `messages`; the detail endpoint returns the full payload.

---

## 10. Full flow (short)

```
1. Lead data reaches JM Backend
2. JM Backend  POST  Qiko /v1/whatsapp/leads     ← land lead
3. Qiko worker starts WhatsApp processing
4. JM Backend  PUT   Qiko /v1/whatsapp/leads/{id}            ← updates
5. JM Backend  POST  Qiko /v1/whatsapp/leads/{id}/messages   ← chat
6. Admin Panel GET   JM Backend /admin/whatsapp/leads/{id}   ← detail UI
```

---

## 11. Who does what

| Layer | Responsibility |
|-------|----------------|
| **Admin Panel** | Calls only JM Backend `/admin/whatsapp/*` |
| **JM Backend** | Calls Qiko `POST` (land lead) plus `GET` / `PUT` / `POST` (read / update / messages) |
| **Qiko** | Stores the lead, runs the worker, handles the WhatsApp conversation |

---

## 12. Checklist (Sarah detail)

- [ ] JM Backend `POST` lands the lead on Qiko  
- [ ] Status, interest, readiness, market, budget, funding, timeline, locations update  
- [ ] Qualification `%` + stage + outreach note  
- [ ] `conversationSummary` + `profileNotes`  
- [ ] `lastContactedAt` / `lastResponseAt`  
- [ ] Handoff / consent / opt-out  
- [ ] Messages for the conversation thread  
- [ ] Assigned rep + source  

---

# Part B — Webinars

**UI reference:** [Webinar detail (Birmingham)](https://jm-admin-panel-vercel1.vercel.app/whatsapp/webinars/web-bham)

Same rule: Admin Panel → JM Backend → Qiko.

---

## 13. Webinar goal

When a webinar is added:

1. **JM Backend** posts the webinar to **Qiko**.
2. **Qiko** matches the webinar to leads and **returns the matched leads**.
3. Admin reviews matched leads on the webinar detail screen.
4. Admin triggers outreach; **JM Backend** calls Qiko to **send the webinar WhatsApp template** to those matched leads.

```
Admin adds webinar
        │
        ▼
 JM Backend  POST  webinar → Qiko
        │
        ▼
 Qiko matches leads  →  returns matched leads + audience
        │
        ▼
 Admin clicks Launch / send template
        │
        ▼
 JM Backend  POST  trigger template → Qiko
        │
        ▼
 Qiko sends WhatsApp webinar template to matched leads
```

---

## 14. Steps — webinar match + template send

| Step | Who | Action |
|------|-----|--------|
| **1** | Admin Panel | Creates / saves webinar via JM Backend |
| **2** | **JM Backend** | `POST` webinar to Qiko |
| **3** | **Qiko** | Stores webinar; agent matches leads using webinar criteria |
| **4** | **Qiko → JM Backend** | Returns matched lead ids + audience preview |
| **5** | Admin Panel | Shows relevant leads / audience (Birmingham screen) |
| **6** | Admin | Clicks Launch / send template |
| **7** | **JM Backend** | `POST` trigger template API to Qiko |
| **8** | **Qiko** | Sends webinar WhatsApp template to matched (eligible) leads |

---

## 15. Webinar API list (JM Backend → Qiko)

| # | JM Backend (Admin calls this) | JM Backend → Qiko | Purpose |
|---|-------------------------------|-------------------|---------|
| **F** | `POST /admin/whatsapp/webinars` | `POST /v1/whatsapp/webinars` | **Add webinar** (Qiko then matches leads) |
| **G** | `GET /admin/whatsapp/webinars/{id}` | `GET /v1/whatsapp/webinars/{id}` | Webinar detail + matched leads |
| **H** | `GET /admin/whatsapp/webinars` | `GET /v1/whatsapp/webinars` | Webinar list |
| **I** | `POST /admin/whatsapp/webinars/{id}/match` | `POST /v1/whatsapp/webinars/{id}/match` | Re-run lead matching (optional) |
| **J** | `POST /admin/whatsapp/webinars/{id}/send-template` | `POST /v1/whatsapp/webinars/{id}/send-template` | **Trigger webinar template to matched leads** |

---

## 16. Webinar parameters (Birmingham screen)

Fields shown on [webinar detail](https://jm-admin-panel-vercel1.vercel.app/whatsapp/webinars/web-bham):

### Campaign

| Field | Type | UI |
|-------|------|-----|
| `id` | string | `/whatsapp/webinars/{id}` |
| `title` | string | Page title |
| `description` | string | Subtitle |
| `market` | string | Meta row (`UK`, `UAE`, `UK + UAE`, …) |
| `scheduledAt` | ISO string | Date/time |
| `timezone` | string | e.g. `GMT` |
| `status` | string | `Draft`, `Scheduled`, `Active`, `Completed`, `Cancelled` |
| `outreachMode` | string | `Manual` \| `Automatic` |

### Smart audience matching

| Field | Type | UI |
|-------|------|-----|
| `suggestedCriteria` | string[] | Criteria chips/list |
| `relevantLeadIds` | string[] | Matched lead ids |
| `matchedLeads` | lead summary[] | Relevant leads list (optional embed) |

### Audience preview

| Field | Type | UI |
|-------|------|-----|
| `audience.total` | number | Total in pool |
| `audience.matching` | number | Matched by criteria |
| `audience.whatsappEligible` | number | Consent + not opted out |
| `audience.excludedNoConsent` | number | No consent |
| `audience.optedOut` | number | Opted out |
| `audience.finalAudience` | number | Final sendable count |

### Engagement

| Field | Type | UI metric |
|-------|------|-----------|
| `engagement.invited` | number | Invited |
| `engagement.opened` | number | Opened |
| `engagement.replied` | number | Replied |
| `engagement.registered` | number | Registered |
| `engagement.attended` | number | Attended |

### Template (for send)

| Field | Type | Notes |
|-------|------|--------|
| `templateId` | string | WhatsApp / Interakt template id |
| `templateName` | string | Display name |
| `templateLanguage` | string | e.g. `en` |
| `templateVariables` | object | Placeholders for title, date, link, etc. |

---

## 17. API F — Add webinar (Qiko matches leads)

**Step:** JM Backend posts the webinar to Qiko. Qiko runs matching and returns matched leads.

- Admin → `POST /admin/whatsapp/webinars`
- JM Backend → `POST {QIKO}/v1/whatsapp/webinars`

### Body

```json
{
  "id": "web-bham",
  "title": "Birmingham Investment Opportunities",
  "description": "Deep dive into Birmingham regeneration schemes and Joseph Mews stock.",
  "market": "UK",
  "scheduledAt": "2026-12-03T17:30:00.000Z",
  "timezone": "GMT",
  "status": "Draft",
  "outreachMode": "Automatic",
  "suggestedCriteria": [
    "Preferred locations include Birmingham",
    "Budget ≥ £200k",
    "Readiness: Near Term or Ready Now"
  ],
  "templateId": "webinar_birmingham_invite_v1",
  "templateName": "Birmingham webinar invite",
  "templateLanguage": "en",
  "templateVariables": {
    "webinar_title": "Birmingham Investment Opportunities",
    "webinar_date": "3 Dec 2026",
    "webinar_time": "17:30 GMT",
    "join_link": "https://example.com/webinar/birmingham"
  }
}
```

### Response (Qiko returns matched leads)

```json
{
  "message": "Webinar created. Leads matched.",
  "data": {
    "id": "web-bham",
    "title": "Birmingham Investment Opportunities",
    "description": "Deep dive into Birmingham regeneration schemes and Joseph Mews stock.",
    "market": "UK",
    "scheduledAt": "2026-12-03T17:30:00.000Z",
    "timezone": "GMT",
    "status": "Draft",
    "outreachMode": "Automatic",
    "suggestedCriteria": [
      "Preferred locations include Birmingham",
      "Budget ≥ £200k",
      "Readiness: Near Term or Ready Now"
    ],
    "relevantLeadIds": ["lead-sarah", "lead-fatima", "lead-maya"],
    "matchedLeads": [
      {
        "id": "lead-sarah",
        "name": "Sarah Jones",
        "status": "Active Conversation",
        "conversationSummary": "Discussing Birmingham stock and mortgage eligibility…",
        "whatsappConsent": true,
        "optedOut": false
      },
      {
        "id": "lead-fatima",
        "name": "Fatima Al-Sayed",
        "status": "Qualified",
        "conversationSummary": "Qualified cash buyer for Birmingham — consultation booked.",
        "whatsappConsent": true,
        "optedOut": false
      }
    ],
    "audience": {
      "total": 12,
      "matching": 3,
      "whatsappEligible": 3,
      "excludedNoConsent": 0,
      "optedOut": 0,
      "finalAudience": 3
    },
    "engagement": {
      "invited": 0,
      "opened": 0,
      "replied": 0,
      "registered": 0,
      "attended": 0
    },
    "templateId": "webinar_birmingham_invite_v1",
    "templateName": "Birmingham webinar invite",
    "templateLanguage": "en",
    "templateVariables": {
      "webinar_title": "Birmingham Investment Opportunities",
      "webinar_date": "3 Dec 2026",
      "webinar_time": "17:30 GMT",
      "join_link": "https://example.com/webinar/birmingham"
    }
  }
}
```

---

## 18. API G — Get webinar detail

- Admin → `GET /admin/whatsapp/webinars/{id}`
- JM Backend → `GET {QIKO}/v1/whatsapp/webinars/{id}`

Returns the same shape as API F `data` (campaign + audience + matched leads + engagement). Powers the Birmingham detail screen.

---

## 19. API H — List webinars

- Admin → `GET /admin/whatsapp/webinars`
- JM Backend → `GET {QIKO}/v1/whatsapp/webinars`

### Query

| Param | Example |
|-------|---------|
| `status` | `Draft` / `Scheduled` / `Active` |
| `market` | `UK` |
| `q` | search title |
| `limit` | `50` |
| `offset` | `0` |

### Response

```json
{
  "message": "Success.",
  "data": {
    "items": [{ "...webinar summary..." }],
    "total": 10
  }
}
```

---

## 20. API I — Re-run lead matching (optional)

Use when leads changed and admin wants a fresh match without recreating the webinar.

- Admin → `POST /admin/whatsapp/webinars/{id}/match`
- JM Backend → `POST {QIKO}/v1/whatsapp/webinars/{id}/match`

### Body (optional overrides)

```json
{
  "suggestedCriteria": [
    "Preferred locations include Birmingham",
    "Budget ≥ £200k",
    "Readiness: Near Term or Ready Now"
  ]
}
```

### Response

Same as create: updated `relevantLeadIds`, `matchedLeads`, `audience`.

---

## 21. API J — Trigger webinar template to matched leads

**Step:** Admin launches outreach. JM Backend tells Qiko to send the WhatsApp webinar template to the matched (final) audience.

- Admin → `POST /admin/whatsapp/webinars/{id}/send-template`
- JM Backend → `POST {QIKO}/v1/whatsapp/webinars/{id}/send-template`

### Body

```json
{
  "leadIds": ["lead-sarah", "lead-fatima", "lead-maya"],
  "templateId": "webinar_birmingham_invite_v1",
  "templateLanguage": "en",
  "templateVariables": {
    "webinar_title": "Birmingham Investment Opportunities",
    "webinar_date": "3 Dec 2026",
    "webinar_time": "17:30 GMT",
    "join_link": "https://example.com/webinar/birmingham"
  },
  "onlyWhatsappEligible": true,
  "excludeOptedOut": true
}
```

Notes:

- If `leadIds` is omitted, Qiko uses current `relevantLeadIds` / `audience.finalAudience`.
- Qiko should skip leads with `whatsappConsent: false` or `optedOut: true` when those flags are true.
- Maps to the **Launch** action on the webinar detail screen.

### Response

```json
{
  "message": "Webinar template triggered.",
  "data": {
    "webinarId": "web-bham",
    "templateId": "webinar_birmingham_invite_v1",
    "requested": 3,
    "queued": 3,
    "skipped": 0,
    "skippedReasons": [],
    "leadIds": ["lead-sarah", "lead-fatima", "lead-maya"],
    "status": "Active",
    "engagement": {
      "invited": 3,
      "opened": 0,
      "replied": 0,
      "registered": 0,
      "attended": 0
    }
  }
}
```

---

## 22. Webinar full flow (short)

```
1. Admin creates webinar in Admin Panel
2. JM Backend  POST  Qiko /v1/whatsapp/webinars
3. Qiko matches leads and returns matched leads + audience
4. Admin reviews Relevant leads on webinar detail
5. Admin clicks Launch
6. JM Backend  POST  Qiko /v1/whatsapp/webinars/{id}/send-template
7. Qiko sends WhatsApp webinar template to matched leads
8. Engagement (invited / opened / replied / …) updates over time
```

---

## 23. Who does what (webinars)

| Layer | Responsibility |
|-------|----------------|
| **Admin Panel** | Create webinar, view matched leads, call Launch via JM Backend |
| **JM Backend** | Forwards create / match / send-template / get to Qiko |
| **Qiko** | Matches leads to webinar; sends WhatsApp template; tracks engagement |

---

## 24. Checklist (Birmingham webinar)

- [ ] JM Backend `POST` creates webinar on Qiko  
- [ ] Qiko returns `relevantLeadIds` + `matchedLeads` + `audience`  
- [ ] Detail screen shows criteria, audience preview, relevant leads  
- [ ] Engagement metrics available (invited → attended)  
- [ ] Admin Launch calls send-template through JM Backend  
- [ ] Qiko sends template only to eligible matched leads  
- [ ] Skipped opted-out / no-consent leads reported in response  
