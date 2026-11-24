"""Joseph Mews Admin Panel staff user guide — live screenshots only."""
from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots"
OUT = ROOT / "Joseph_Mews_Admin_Panel_User_Guide.pptx"

YELLOW = RGBColor(0xFC, 0xC1, 0x1D)
DARK = RGBColor(0x1D, 0x1D, 0x1F)
CREAM = RGBColor(0xFF, 0xF5, 0xE9)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
MUTED = RGBColor(0x5C, 0x5C, 0x62)
BODY = RGBColor(0x2A, 0x2A, 0x2E)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

prs = Presentation()
prs.slide_width = SLIDE_W
prs.slide_height = SLIDE_H
blank = prs.slide_layouts[6]
slides: list = []


def set_run(run, size=18, bold=False, color=DARK, font="Calibri"):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font


def add_text(shape, text, size=18, bold=False, color=DARK, align=PP_ALIGN.LEFT, font="Calibri"):
    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    set_run(run, size=size, bold=bold, color=color, font=font)
    return tf


def fill_solid(shape, color: RGBColor):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color


def no_line(shape):
    shape.line.fill.background()


def bg(slide):
    s = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    fill_solid(s, CREAM)
    no_line(s)


def footer(slide, page: int, total: int):
    bar = slide.shapes.add_shape(
        MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, Inches(7.18), SLIDE_W, Inches(0.32)
    )
    fill_solid(bar, DARK)
    no_line(bar)
    tb = slide.shapes.add_textbox(Inches(0.45), Inches(7.2), Inches(9.6), Inches(0.26))
    add_text(tb, "Joseph Mews  ·  Admin Panel user guide", size=10, color=RGBColor(0xB8, 0xB8, 0xBC))
    nb = slide.shapes.add_textbox(Inches(11.4), Inches(7.2), Inches(1.5), Inches(0.26))
    add_text(nb, f"{page}  /  {total}", size=10, color=YELLOW, align=PP_ALIGN.RIGHT)


def header(slide, title: str, subtitle: str | None = None):
    band = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, SLIDE_W, Inches(0.92))
    fill_solid(band, DARK)
    no_line(band)
    accent = slide.shapes.add_shape(
        MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, Inches(0.92), SLIDE_W, Inches(0.06)
    )
    fill_solid(accent, YELLOW)
    no_line(accent)
    tb = slide.shapes.add_textbox(Inches(0.45), Inches(0.16), Inches(12.4), Inches(0.4))
    add_text(tb, title, size=22, bold=True, color=WHITE, font="Georgia")
    if subtitle:
        sb = slide.shapes.add_textbox(Inches(0.45), Inches(0.54), Inches(12.4), Inches(0.3))
        add_text(sb, subtitle, size=13, color=RGBColor(0xC8, 0xC8, 0xCC))


def new_slide():
    slide = prs.slides.add_slide(blank)
    bg(slide)
    slides.append(slide)
    return slide


def bullets(slide, items: list[str], left=0.5, top=1.18, width=12.3, height=5.7, size=16):
    box = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = box.text_frame
    tf.word_wrap = True
    tf.clear()
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_before = Pt(0 if i == 0 else 8)
        run = p.add_run()
        run.text = "•  " + item
        set_run(run, size=size, color=BODY)
    return tf


def steps(slide, items: list[str], left=0.5, top=1.18, width=12.3, height=5.7, size=16):
    box = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = box.text_frame
    tf.word_wrap = True
    tf.clear()
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_before = Pt(0 if i == 0 else 9)
        run = p.add_run()
        run.text = f"{i + 1}.  {item}"
        set_run(run, size=size, color=BODY)


def shot(name: str) -> Path | None:
    path = SHOTS / name
    return path if path.exists() else None


def add_pic(slide, name: str, left, top, width, height):
    path = shot(name)
    if path is None:
        return
    pic = slide.shapes.add_picture(str(path), left, top, width=width)
    if pic.height > height:
        ratio = height / pic.height
        pic.width = int(pic.width * ratio)
        pic.height = height
        # centre in the box
        pic.left = int(left + (width - pic.width) / 2)


def shot_slide(title: str, subtitle: str, filename: str, caption: str):
    s = new_slide()
    header(s, title, subtitle)
    add_pic(s, filename, Inches(0.4), Inches(1.12), Inches(12.5), Inches(5.5))
    cap = s.shapes.add_textbox(Inches(0.45), Inches(6.68), Inches(12.4), Inches(0.4))
    add_text(cap, caption, size=12, color=MUTED)


def split_slide(title: str, subtitle: str, items: list[str], filename: str, numbered=False):
    s = new_slide()
    header(s, title, subtitle)
    if numbered:
        steps(s, items, left=0.45, top=1.16, width=5.5, height=5.7, size=14)
    else:
        bullets(s, items, left=0.45, top=1.16, width=5.5, height=5.7, size=14)
    add_pic(s, filename, Inches(6.1), Inches(1.16), Inches(6.8), Inches(5.7))


# --- slides ---

s = new_slide()
band = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
fill_solid(band, DARK)
no_line(band)
gold = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, Inches(5.5), SLIDE_W, Inches(0.1))
fill_solid(gold, YELLOW)
no_line(gold)
tb = s.shapes.add_textbox(Inches(0.8), Inches(2.15), Inches(11.7), Inches(0.4))
add_text(tb, "JOSEPH MEWS", size=16, bold=True, color=YELLOW, font="Georgia")
tb = s.shapes.add_textbox(Inches(0.8), Inches(2.6), Inches(11.7), Inches(1.1))
add_text(tb, "Admin Panel user guide", size=40, bold=True, color=WHITE, font="Georgia")
tb = s.shapes.add_textbox(Inches(0.8), Inches(3.85), Inches(11.7), Inches(0.9))
add_text(
    tb,
    "A practical guide for staff. Every screenshot is from the live admin panel.\n"
    "Gold buttons are the main action on a page.",
    size=18,
    color=RGBColor(0xD0, 0xD0, 0xD4),
)
tb = s.shapes.add_textbox(Inches(0.8), Inches(5.9), Inches(11.7), Inches(0.5))
add_text(tb, "For Super Admins, Agents, and Viewers", size=14, color=RGBColor(0xB0, 0xB0, 0xB4))

s = new_slide()
header(s, "How to use this guide", "Follow the screens in the same order you would work in the panel.")
bullets(
    s,
    [
        "This is the staff Admin Panel — not the investor app.",
        "The left menu is always there. The gold button is the main job on that page.",
        "Click a table row to open the record. Click a Dashboard card to jump to that list.",
        "If a button is missing, your role may not allow it. Ask a Super Admin.",
        "Suggested order for a new scheme: Development → Property (units and plans) → Publish → Invite investor → Assign units.",
    ],
)

s = new_slide()
header(s, "Who can do what", "The screens look the same. The buttons change by role.")
bullets(
    s,
    [
        "Super Admin — full access: create properties and developments, publish, assumptions, invite staff.",
        "Agent — investors, enquiries, signals, documents, notes, and assigning units. View-only on properties and developments.",
        "Viewer — look only. No invite, save, assign, or delete.",
        "Your name and role are at the bottom of the left menu and in the top-right.",
        "Always use Sign out when you finish.",
    ],
)

split_slide(
    "Sign in",
    "Open the admin web address your team gave you.",
    [
        "Enter your work email.",
        "Enter your password. Use the eye icon to check it.",
        "Select Sign in. You land on the Dashboard.",
        "Forgot password? is next to the Password label.",
        "If sign-in fails, check spelling and Caps Lock, then ask a Super Admin to confirm your account is Active.",
    ],
    "user-guide-01-login.png",
    numbered=True,
)

split_slide(
    "Dashboard — the home screen",
    "Start here each morning. Every number is a shortcut.",
    [
        "Total investors — all investor records.",
        "Invited users — people who have been sent an invite.",
        "Pending invitations — invites still waiting to be accepted.",
        "Active properties — listings that are not archived.",
        "Open enquiries — messages still being worked.",
        "Click a card to open that list.",
    ],
    "user-guide-02-dashboard.png",
)

split_slide(
    "Dashboard lists",
    "These tell you who to call and what changed.",
    [
        "High-priority signals — strong interest in the investor app.",
        "New enquiries — latest inbound messages.",
        "Recent HPI updates — UK house-price index changes on listings (name, region, %).",
        "Recent activity — last screens investors opened.",
        "Recently invited users — latest invites and status.",
        "Recent documents — new files (for example passports).",
        "Recently added properties — newest listings and status.",
        "View all opens the full page.",
    ],
    "user-guide-02b-dashboard-lower.png",
)

split_slide(
    "Investors",
    "Your CRM. Click a name to open the full record.",
    [
        "Search by name, email, or nationality.",
        "Filter by agent or account status.",
        "Invite investor (gold) sends an email and creates the record — use this for new people.",
        "Add investor creates a record without sending email.",
        "Add property on a row opens that person’s Portfolio tab.",
        "Account and Invitation badges show whether they can use the app yet.",
    ],
    "user-guide-03-investors.png",
)

split_slide(
    "Invite an investor",
    "This is the usual way to bring someone onto the platform.",
    [
        "Open Investors → Invite investor.",
        "Enter full name and email (the invite goes here).",
        "Optionally choose an assigned agent.",
        "Optionally tick properties to attach later — you can also assign after they accept.",
        "Select Send invitation.",
        "You are taken to their profile. Status starts as Sent.",
        "Ask them to check spam if the email does not arrive.",
    ],
    "user-guide-04-invite-investor.png",
    numbered=True,
)

split_slide(
    "Add an investor without inviting",
    "Use this when you only need a record for now.",
    [
        "Open Investors → Add investor.",
        "Fill contact details, country, nationality, and residency.",
        "Set agent, account status (often Pending), and invitation status (often None).",
        "Save, then invite later from their profile when you are ready.",
    ],
    "user-guide-05-add-investor.png",
    numbered=True,
)

split_slide(
    "Investor profile",
    "One person, six tabs. Work from Overview across to Notes.",
    [
        "Overview — identity, buying power, risk appetite, assigned agent.",
        "Portfolio — units they own, and Assign to portfolio.",
        "Activity — what they did in the investor app.",
        "Intent Signals — how interested they look.",
        "Documents — ID and proof-of-funds uploads.",
        "Notes — short internal comments for the next colleague.",
        "Use Edit on Overview to change profile fields.",
    ],
    "user-guide-20-investor-overview.png",
)

split_slide(
    "Portfolio — what they own",
    "Assign units from here — not from the Properties list.",
    [
        "Each row is a holding: property, plan, units, values, rent.",
        "Select Assign to portfolio when you have agreed terms.",
        "If the button is disabled, no remaining units are available.",
        "Remove takes a holding off this investor (confirm first).",
        "The same property can be shared until stock runs out.",
    ],
    "user-guide-21-investor-portfolio.png",
)

split_slide(
    "Assign units — step 1 of 3",
    "Choose the property and how many units.",
    [
        "Select Assign to portfolio.",
        "Open Property and pick a listing. Availability is shown (for example 97 available).",
        "Select the unit type and set Quantity. You cannot exceed remaining stock.",
        "The investor is already filled in.",
        "Select Continue. Use Cancel if you started by mistake — nothing is saved yet.",
    ],
    "user-guide-23-assign-units.png",
    numbered=True,
)

split_slide(
    "Assign units — step 2 of 3",
    "Choose how they pay.",
    [
        "Payment schedule — staged cash (reservation, exchange, completion).",
        "Mortgage plan — loan, monthly payment, LTV.",
        "Continue without any plan — treat as cash.",
        "Keep it same uses the property’s default plan × quantity.",
        "Custom changes figures for this investor only. The listing itself is unchanged.",
        "Select Continue.",
    ],
    "user-guide-24-assign-plan.png",
)

split_slide(
    "Assign units — step 3 of 3",
    "Read the summary once. Confirm writes the holding.",
    [
        "Check investor, property, units, and plan.",
        "Select Confirm & assign only when this matches what you agreed.",
        "Back returns to the previous step. Cancel discards the flow.",
        "After confirm, the holding appears in the table under the form.",
    ],
    "user-guide-25-assign-review.png",
    numbered=True,
)

split_slide(
    "Documents",
    "Keep ID and proof of funds on the investor record.",
    [
        "Open the investor → Documents.",
        "Choose a file, give a display name, pick a category and visibility.",
        "Select Upload.",
        "Dashboard → Recent documents is a shortcut to new files.",
        "Treat these files as confidential.",
    ],
    "user-guide-26-investor-documents.png",
    numbered=True,
)

split_slide(
    "Properties",
    "A property is a listing. Units inside it are what you assign.",
    [
        "Open Properties. Super Admins can Add property.",
        "Search and use Filters for status, development, and Explore visibility.",
        "Click a row to edit.",
        "The ⋯ Actions menu can Publish, Unpublish, Duplicate, Archive, or Unarchive.",
        "Draft = still editing. Available + Visible in Explore = investors can browse it.",
        "Create the Development first, then the Property.",
    ],
    "user-guide-06-properties.png",
)

split_slide(
    "Create or edit a property",
    "Work top to bottom, then Save.",
    [
        "Identity — name, reference, development, status, completion date.",
        "Linking a development fills location so you do not retype the address.",
        "Location — city, address, postcode, region.",
        "Add at least one unit (next slide).",
        "Turn on Visible in Explore when it should appear in the investor marketplace.",
        "Contents opens investor-facing copy and media for this listing.",
    ],
    "user-guide-07-property-form.png",
    numbered=True,
)

split_slide(
    "Units on a property",
    "Each unit type is stock you can assign.",
    [
        "Type, bedrooms, bathrooms, size, floor.",
        "No. of units = how many of this type you can still assign.",
        "Upload photos (PNG or JPG, under 5 MB each).",
        "Fill financials: price, rent, charges, yield, growth.",
        "Add another unit type if the scheme has 1-bed and 2-bed, for example.",
        "New properties can copy defaults from Calculations & Assumptions. You can still edit.",
    ],
    "user-guide-08-property-units.png",
)

split_slide(
    "Payment plans on a unit",
    "Turn at least one plan Active (gold switch) before you assign investors.",
    [
        "Payment schedule — named stages with amount and date. Total cash required should match the offer.",
        "Mortgage plan — deposit, loan, rate, monthly payment, term, LTV, repayment or interest-only.",
        "These defaults appear in Assign to portfolio as Keep it same.",
        "Inactive plans are hidden during assignment.",
    ],
    "user-guide-09-property-plans.png",
)

split_slide(
    "Property content",
    "Not in the main menu. Open a saved property → Contents.",
    [
        "Each row is a content block (hero, gallery, copy, video).",
        "Add content to create a new block. View opens a preview.",
        "Published blocks are what investors can see in Explore.",
        "A published property with no content can look empty in the app.",
        "Keep copy factual. Do not promise returns assumptions do not support.",
    ],
    "user-guide-27-content.png",
)

split_slide(
    "Price history (HPI)",
    "UK House Price Index updates applied to listings.",
    [
        "Open from Dashboard → Recent HPI updates → View all, or from a property.",
        "Each row: property, region, month, % change, previous and new value, status.",
        "You do not type these by hand. Use this screen to check what was applied.",
        "If a % looks wrong, note the property and tell a Super Admin before you speak to investors.",
    ],
    "user-guide-10-price-history.png",
)

split_slide(
    "Developments",
    "A development is the scheme. Properties sit underneath it.",
    [
        "Open Developments. Super Admins can Add development.",
        "Search and filter by city, status, developer, featured, Explore.",
        "Click a row to edit name, address, prices, yield, images, and visibility.",
        "Statuses include Draft, Coming soon, Available, Sold out, Completed, Archived.",
        "Do not archive a scheme while its properties are still being sold.",
    ],
    "user-guide-11-developments.png",
)

split_slide(
    "Create or edit a development",
    "Save the scheme, then add properties linked to it.",
    [
        "Basics — name, reference, developer, address, city, region, postcode, description.",
        "Commercial — starting price, yield, completion, unit counts, highlights.",
        "Upload images, then set status, featured, and Visible in Explore.",
        "Save. Then Properties → Add property and choose this development.",
    ],
    "user-guide-12-development-form.png",
    numbered=True,
)

split_slide(
    "Enquiries",
    "People who asked a question or submitted a form.",
    [
        "Open Enquiries. Search by name, message, or type.",
        "Work New and High priority first.",
        "Update Status as you go: New → Contacted → Qualified → Viewing arranged → Converted (or Closed / Not interested).",
        "After a good call, invite them under Investors if they are not already in the CRM.",
        "Dashboard → Open enquiries jumps here.",
    ],
    "user-guide-13-enquiries.png",
)

split_slide(
    "Intent Signals",
    "Automatic clues from the investor app. You do not type these.",
    [
        "Open Intent Signals. Search, or filter by strength.",
        "Each row is who, what they did, and the evidence (screens visited, calculator use).",
        "A High signal is a reason to call. Log the outcome in Notes or Enquiries.",
        "Agents only see signals for their assigned investors.",
        "Signals do not assign a property. You still use Portfolio → Assign.",
    ],
    "user-guide-14-signals.png",
)

split_slide(
    "Assumptions — Property insights",
    "Presets copied into new properties and extra units. Super Admins edit; others may view.",
    [
        "Open Calculations & Assumptions.",
        "Property insights is a model unit: type, beds, prices, rent, yield, payment and mortgage plans.",
        "There is no image upload here — photos belong on the property.",
        "Select Save at the bottom.",
        "Changing presets does not rewrite properties you already created.",
    ],
    "user-guide-15-assumptions-insights.png",
)

split_slide(
    "Assumptions — Calculations",
    "Default percentages for the investor calculator.",
    [
        "Open the Calculations tab.",
        "Set UK and non-UK mortgage rates, rental and capital growth, yield, fees, term.",
        "Affordability includes income multiple and stamp duty (SDLT).",
        "LTV by risk and calculator chips (LTV % and horizon years) control what investors can pick.",
        "Select Save.",
    ],
    "user-guide-16-assumptions-calc.png",
)

split_slide(
    "Users & Roles",
    "Staff accounts only. Investors are managed under Investors.",
    [
        "Super Admins only.",
        "Invite internal user: name, email, role (Super Admin, Agent, or Viewer), then Send invite.",
        "They set a password from the email and sign in here.",
        "Use the row menu to change role or set Inactive when someone leaves.",
        "Do not make everyone a Super Admin.",
    ],
    "user-guide-17-users.png",
    numbered=True,
)

split_slide(
    "Activity Log — investor behaviour",
    "What people did in the investor app.",
    [
        "Open Activity Log → Investor activity.",
        "Search and filter by category (screen, calculator step, and so on).",
        "Use this if someone says they never saw a property — the log shows visits.",
        "Agents see their assigned investors.",
        "Put decisions in Notes. This log is history, not a task list.",
    ],
    "user-guide-18-activity.png",
)

split_slide(
    "Activity Log — admin audit",
    "Who on the staff side changed what.",
    [
        "Open the Admin audit tab.",
        "Each row: user, action, entity, previous value, new value, time.",
        "Use this for support and compliance (for example who assigned a holding).",
        "Do not share audit rows outside the team.",
    ],
    "user-guide-19-audit.png",
)

s = new_slide()
header(s, "A simple daily routine", "Fifteen to thirty minutes each morning is enough if you stay consistent.")
steps(
    s,
    [
        "Sign in and read the Dashboard. Click anything that jumped.",
        "Work High-priority signals and New enquiries. Call or email, then update status and notes.",
        "Check Recent documents for new ID files.",
        "Invite qualified new people. Assign units only when commercial terms are agreed.",
        "Super Admins: check Draft properties that should be published, and empty Contents.",
        "Sign out.",
    ],
)

s = new_slide()
header(s, "If something looks wrong", "Short checks before you escalate.")
bullets(
    s,
    [
        "I cannot see Add property — you are not a Super Admin.",
        "Assign to portfolio is disabled — no remaining units.",
        "Investor did not get the email — check the address, spam, and invitation status.",
        "Property missing in Explore — check status, Visible in Explore, Publish, and Contents.",
        "Dashboard looks old — refresh the page, then use View all.",
        "Wrong plan assigned — stop and tell a Super Admin before you assign more units.",
        "HPI list empty — no updates have been applied yet. That is not an error.",
    ],
)

s = new_slide()
band = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
fill_solid(band, DARK)
no_line(band)
gold = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, Inches(5.5), SLIDE_W, Inches(0.1))
fill_solid(gold, YELLOW)
no_line(gold)
tb = s.shapes.add_textbox(Inches(0.8), Inches(2.4), Inches(11.7), Inches(1.0))
add_text(tb, "You are ready to use the Admin Panel", size=30, bold=True, color=WHITE, font="Georgia")
tb = s.shapes.add_textbox(Inches(0.8), Inches(3.55), Inches(11.7), Inches(1.2))
add_text(
    tb,
    "Start on the Dashboard. Invite from Investors.\n"
    "Build Developments before Properties. Assign units only from Portfolio.\n"
    "When unsure, read the status badge and ask a Super Admin before you publish or assign.",
    size=18,
    color=RGBColor(0xD0, 0xD0, 0xD4),
)

total = len(slides)
for i, slide in enumerate(slides, start=1):
    if i not in (1, total):
        footer(slide, i, total)

prs.save(OUT)
print(f"Wrote {total} slides -> {OUT}")
print("Shots folder:", SHOTS)
missing = [p.name for p in SHOTS.glob("*.png")]
print(f"{len(missing)} screenshot files")
