"""Focused Jake deck: Development → Property → Units → Plans → Investor assignment."""
from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots-v2"
OUT = ROOT / "Joseph_Mews_Recent_Screens_Flow_Update.pptx"

YELLOW = RGBColor(0xFC, 0xC1, 0x1D)
DARK = RGBColor(0x1D, 0x1D, 0x1F)
CREAM = RGBColor(0xFF, 0xF5, 0xE9)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
MUTED = RGBColor(0x6B, 0x6B, 0x70)
LINE = RGBColor(0xD8, 0xD0, 0xC4)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)
TOTAL = 7


def set_run(run, size=18, bold=False, color=DARK, font="Calibri"):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font


def add_text(shape, text, size=18, bold=False, color=DARK, align=PP_ALIGN.LEFT, font="Calibri"):
    tf = shape.text_frame
    tf.clear()
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    set_run(run, size=size, bold=bold, color=color, font=font)
    return tf


def add_para(tf, text, size=14, bold=False, color=DARK, space_before=6, align=PP_ALIGN.LEFT):
    p = tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(space_before)
    run = p.add_run()
    run.text = text
    set_run(run, size=size, bold=bold, color=color)
    return p


def fill_solid(shape, color: RGBColor):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color


def no_line(shape):
    shape.line.fill.background()


def bg_cream(slide):
    s = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    fill_solid(s, CREAM)
    no_line(s)


def rect(slide, left, top, width, height, fill=None, line=None):
    s = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, left, top, width, height)
    s.adjustments[0] = 0.08
    if fill is not None:
        fill_solid(s, fill)
    else:
        s.fill.background()
    if line is None:
        no_line(s)
    else:
        s.line.color.rgb = line
        s.line.width = Pt(1)
    return s


def arrow_right(slide, left, top, width=Inches(0.35), height=Inches(0.22), color=YELLOW):
    s = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RIGHT_ARROW, left, top, width, height)
    fill_solid(s, color)
    no_line(s)
    return s


def footer(slide, page: int):
    bar = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, Inches(7.15), SLIDE_W, Inches(0.35))
    fill_solid(bar, DARK)
    no_line(bar)
    tb = slide.shapes.add_textbox(Inches(0.5), Inches(7.18), Inches(9), Inches(0.28))
    add_text(tb, "Joseph Mews  ·  Flow update for Jake", size=10, color=RGBColor(0xB8, 0xB8, 0xBC))
    nb = slide.shapes.add_textbox(Inches(11.6), Inches(7.18), Inches(1.3), Inches(0.28))
    add_text(nb, f"{page} / {TOTAL}", size=10, color=YELLOW, align=PP_ALIGN.RIGHT)


def header_band(slide, title: str, subtitle: str | None = None):
    band = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, SLIDE_W, Inches(1.0))
    fill_solid(band, DARK)
    no_line(band)
    accent = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, Inches(1.0), SLIDE_W, Inches(0.06))
    fill_solid(accent, YELLOW)
    no_line(accent)
    tb = slide.shapes.add_textbox(Inches(0.5), Inches(0.22), Inches(12.2), Inches(0.4))
    add_text(tb, title, size=24, bold=True, color=WHITE, font="Georgia")
    if subtitle:
        sb = slide.shapes.add_textbox(Inches(0.5), Inches(0.62), Inches(12.2), Inches(0.28))
        add_text(sb, subtitle, size=12, color=RGBColor(0xC8, 0xC8, 0xCC))


def caption(slide, left, top, width, text):
    tb = slide.shapes.add_textbox(left, top, width, Inches(0.4))
    tf = add_text(tb, text, size=11, color=MUTED, align=PP_ALIGN.CENTER)
    tf.word_wrap = True


def add_shot(slide, path: Path, left, top, width, height):
    if path.exists() and path.stat().st_size > 20000:
        slide.shapes.add_picture(str(path), left, top, width=width, height=height)
        return True
    card = rect(slide, left, top, width, height, fill=WHITE, line=LINE)
    add_text(card, f"[Screenshot]\n{path.stem}", size=12, color=MUTED, align=PP_ALIGN.CENTER)
    return False


def step_chip(slide, left, top, num: str, title: str, body: str, width=Inches(2.9)):
    card = rect(slide, left, top, width, Inches(1.55), fill=WHITE, line=LINE)
    badge = slide.shapes.add_shape(
        MSO_AUTO_SHAPE_TYPE.OVAL, left + Inches(0.15), top + Inches(0.18), Inches(0.36), Inches(0.36)
    )
    fill_solid(badge, YELLOW)
    no_line(badge)
    add_text(badge, num, size=12, bold=True, color=DARK, align=PP_ALIGN.CENTER)
    tb = slide.shapes.add_textbox(left + Inches(0.15), top + Inches(0.65), width - Inches(0.3), Inches(0.8))
    tf = add_text(tb, title, size=13, bold=True, color=DARK)
    tf.word_wrap = True
    add_para(tf, body, size=11, color=MUTED, space_before=4)


def slide_title(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    fill_solid(bg, DARK)
    no_line(bg)
    panel = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(7.5), 0, Inches(5.833), SLIDE_H)
    fill_solid(panel, CREAM)
    no_line(panel)
    strip = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(7.5), 0, Inches(0.12), SLIDE_H)
    fill_solid(strip, YELLOW)
    no_line(strip)

    brand = slide.shapes.add_textbox(Inches(0.7), Inches(2.0), Inches(6.2), Inches(0.35))
    add_text(brand, "JOSEPH MEWS", size=14, bold=True, color=YELLOW)

    title = slide.shapes.add_textbox(Inches(0.7), Inches(2.5), Inches(6.3), Inches(1.5))
    tf = add_text(title, "Core Inventory &\nAssignment Flows", size=34, bold=True, color=WHITE, font="Georgia")
    tf.word_wrap = True

    sub = slide.shapes.add_textbox(Inches(0.7), Inches(4.3), Inches(6.2), Inches(0.9))
    tf = add_text(
        sub,
        "Development → Property → Units → Financial plans → Investor assignment",
        size=15,
        color=RGBColor(0xC8, 0xC8, 0xCC),
    )
    tf.word_wrap = True

    meta = slide.shapes.add_textbox(Inches(8.0), Inches(2.6), Inches(4.8), Inches(3.2))
    tf = add_text(meta, "Prepared for Jake", size=20, bold=True, color=DARK, font="Georgia")
    add_para(tf, "Focused update — new flows only", size=13, color=MUTED, space_before=14)
    for item in [
        "1. Development creation",
        "2. Property link / inheritance",
        "3. Units under Property",
        "4. Mortgage vs payment plan",
        "5. Investor assignment",
    ]:
        add_para(tf, item, size=13, color=DARK, space_before=10)
    add_para(tf, "August 2026", size=12, color=MUTED, space_before=20)


def slide_development(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg_cream(slide)
    header_band(
        slide,
        "1. Development creation flow",
        "Add a Development — it becomes the parent structure for linked Properties",
    )

    steps = [
        ("1", "Open Developments", "List view → Add development"),
        ("2", "Capture fields", "Basics, commercial, content, visibility"),
        ("3", "Save as parent", "Save, or Save & Add Property"),
    ]
    x = Inches(0.5)
    for i, (n, t, b) in enumerate(steps):
        step_chip(slide, x, Inches(1.25), n, t, b, width=Inches(3.8))
        if i < 2:
            arrow_right(slide, x + Inches(3.9), Inches(1.85))
        x += Inches(4.2)

    bullets = slide.shapes.add_textbox(Inches(0.55), Inches(3.0), Inches(5.3), Inches(3.5))
    tf = add_text(bullets, "Fields captured", size=14, bold=True, color=DARK)
    for line in [
        "Basics — name, reference, developer, address, city, region, postcode, description",
        "Commercial — starting price, rental yield %, capital growth %, completion, status",
        "Content — highlights, amenities, location info, images",
        "Visibility — Featured, Visible in Explore",
        "Parent role — linked Properties inherit location/content via developmentId",
    ]:
        add_para(tf, "•  " + line, size=12, color=MUTED, space_before=8)

    add_shot(slide, SHOTS / "02-development-form-top.png", Inches(6.1), Inches(3.0), Inches(3.4), Inches(3.5))
    caption(slide, Inches(6.1), Inches(6.55), Inches(3.4), "Add Development — Basics & Commercial")
    add_shot(slide, SHOTS / "03-development-ctas.png", Inches(9.7), Inches(3.0), Inches(3.2), Inches(3.5))
    caption(slide, Inches(9.7), Inches(6.55), Inches(3.2), "Save Development & Add Property")
    footer(slide, 2)


def slide_property(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg_cream(slide)
    header_band(
        slide,
        "2. Property flow — link or standalone",
        "A Property can link to a Development, or remain standalone (Development = None)",
    )

    left = rect(slide, Inches(0.45), Inches(1.25), Inches(4.0), Inches(2.35), fill=WHITE, line=LINE)
    tb = slide.shapes.add_textbox(Inches(0.65), Inches(1.4), Inches(3.6), Inches(2.0))
    tf = add_text(tb, "Linked to Development", size=14, bold=True, color=DARK)
    for line in [
        "Select Development in Identity",
        "Location fields filled from Development",
        "Content (highlights, amenities, location) copied — editable override",
        "CTA path: Save Development & Add Property prefills developmentId",
    ]:
        add_para(tf, "•  " + line, size=11, color=MUTED, space_before=6)

    right = rect(slide, Inches(4.65), Inches(1.25), Inches(4.0), Inches(2.35), fill=WHITE, line=LINE)
    tb2 = slide.shapes.add_textbox(Inches(4.85), Inches(1.4), Inches(3.6), Inches(2.0))
    tf2 = add_text(tb2, "Standalone Property", size=14, bold=True, color=DARK)
    for line in [
        "Development dropdown → None",
        "Enter location manually",
        "No automatic content inheritance",
        "Still hosts its own Units & plans",
    ]:
        add_para(tf2, "•  " + line, size=11, color=MUTED, space_before=6)

    note = rect(slide, Inches(8.85), Inches(1.25), Inches(4.0), Inches(2.35), fill=DARK, line=None)
    tb3 = slide.shapes.add_textbox(Inches(9.05), Inches(1.5), Inches(3.6), Inches(1.9))
    tf3 = add_text(tb3, "UI cue", size=14, bold=True, color=YELLOW)
    add_para(
        tf3,
        "Location: “Filled from the selected development. Choose None to clear and enter details manually.”",
        size=12,
        color=WHITE,
        space_before=10,
    )
    add_para(
        tf3,
        "Content: “Copied from the selected development. Edit to override.”",
        size=12,
        color=RGBColor(0xC8, 0xC8, 0xCC),
        space_before=10,
    )

    add_shot(slide, SHOTS / "05-property-identity-dev-link.png", Inches(0.45), Inches(3.85), Inches(6.1), Inches(2.85))
    caption(slide, Inches(0.45), Inches(6.75), Inches(6.1), "Property Identity — Development dropdown binds the parent")
    add_shot(slide, SHOTS / "01-developments-list.png", Inches(6.8), Inches(3.85), Inches(6.05), Inches(2.85))
    caption(slide, Inches(6.8), Inches(6.75), Inches(6.05), "Developments list — parent schemes available to link")
    footer(slide, 3)


def slide_units(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg_cream(slide)
    header_band(
        slide,
        "3. Units under Property",
        "Multiple Units can be added under one Property — each with specs, images, and financials",
    )

    steps = [
        ("1", "Open Property", "Edit / create Property form"),
        ("2", "Units section", "Add New for another unit type"),
        ("3", "Edit unit", "Type, beds, baths, size, floor, qty"),
        ("4", "Unit financials", "Price, rent, charges, yields"),
    ]
    x = Inches(0.4)
    for i, (n, t, b) in enumerate(steps):
        step_chip(slide, x, Inches(1.25), n, t, b, width=Inches(3.0))
        if i < 3:
            arrow_right(slide, x + Inches(3.05), Inches(1.85), width=Inches(0.28))
        x += Inches(3.25)

    add_shot(slide, SHOTS / "06b-multi-units.png", Inches(0.45), Inches(3.1), Inches(6.2), Inches(3.5))
    caption(slide, Inches(0.45), Inches(6.65), Inches(6.2), "Multi-unit UI — Unit 1 + Unit 2 under the same Property")
    add_shot(slide, SHOTS / "07-payment-plans.png", Inches(6.9), Inches(3.1), Inches(5.95), Inches(3.5))
    caption(slide, Inches(6.9), Inches(6.65), Inches(5.95), "Unit financials & payment plans live on each Unit")
    footer(slide, 4)


def slide_plans(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg_cream(slide)
    header_band(
        slide,
        "4. Financial plans — two distinct sections",
        "Mortgage plan and Customised / developer payment schedule are separate flows on each Unit",
    )

    # Two columns
    left = rect(slide, Inches(0.45), Inches(1.25), Inches(6.1), Inches(2.0), fill=WHITE, line=LINE)
    accent = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(0.45), Inches(1.25), Inches(0.12), Inches(2.0))
    fill_solid(accent, YELLOW)
    no_line(accent)
    tb = slide.shapes.add_textbox(Inches(0.75), Inches(1.4), Inches(5.6), Inches(1.7))
    tf = add_text(tb, "Mortgage plan", size=16, bold=True, color=DARK)
    for line in [
        "Deposit, loan amount, interest rate, monthly payment, term, LTV",
        "Repayment or Interest-only",
        "Persists with the Unit as the default mortgage option",
    ]:
        add_para(tf, "•  " + line, size=12, color=MUTED, space_before=6)

    right = rect(slide, Inches(6.8), Inches(1.25), Inches(6.05), Inches(2.0), fill=WHITE, line=LINE)
    accent2 = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(6.8), Inches(1.25), Inches(0.12), Inches(2.0))
    fill_solid(accent2, DARK)
    no_line(accent2)
    tb2 = slide.shapes.add_textbox(Inches(7.1), Inches(1.4), Inches(5.5), Inches(1.7))
    tf2 = add_text(tb2, "Customised payment plan", size=16, bold=True, color=DARK)
    for line in [
        "Developer staged schedule (label · amount · due timing)",
        "Example: Deposit on reservation → Balance on completion",
        "Separate from mortgage — can coexist on the same Unit",
    ]:
        add_para(tf2, "•  " + line, size=12, color=MUTED, space_before=6)

    add_shot(slide, SHOTS / "08-mortgage-plan.png", Inches(0.45), Inches(3.5), Inches(6.1), Inches(3.15))
    caption(slide, Inches(0.45), Inches(6.7), Inches(6.1), "Mortgage plan fields on the Unit")
    add_shot(slide, SHOTS / "07b-payment-schedule.png", Inches(6.8), Inches(3.5), Inches(6.05), Inches(3.15))
    caption(slide, Inches(6.8), Inches(6.7), Inches(6.05), "Payment schedule stages (customised / developer plan)")
    footer(slide, 5)


def slide_assign(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg_cream(slide)
    header_band(
        slide,
        "5. Investor assignment flow",
        "Assign a Property / Unit to an investor — portfolio view shows plan and financial association",
    )

    steps = [
        ("1", "Investor → Portfolio", "Add property / select Property"),
        ("2", "Choose Units", "Qty per unit type to assign"),
        ("3", "Choose plan", "Mortgage, staged plan, or cash"),
        ("4", "Confirm", "Holding appears on investor"),
    ]
    x = Inches(0.4)
    for i, (n, t, b) in enumerate(steps):
        step_chip(slide, x, Inches(1.2), n, t, b, width=Inches(3.0))
        if i < 3:
            arrow_right(slide, x + Inches(3.05), Inches(1.8), width=Inches(0.28))
        x += Inches(3.25)

    add_shot(slide, SHOTS / "12b-assign-mortgage-selected.png", Inches(0.4), Inches(2.95), Inches(4.15), Inches(3.55))
    caption(slide, Inches(0.4), Inches(6.55), Inches(4.15), "Step 2 — choose Mortgage vs staged payment plan")
    add_shot(slide, SHOTS / "13-assign-review.png", Inches(4.7), Inches(2.95), Inches(4.15), Inches(3.55))
    caption(slide, Inches(4.7), Inches(6.55), Inches(4.15), "Step 3 — review units + plan before confirm")
    add_shot(slide, SHOTS / "14-investor-holdings.png", Inches(9.0), Inches(2.95), Inches(3.9), Inches(3.55))
    caption(slide, Inches(9.0), Inches(6.55), Inches(3.9), "Investor portfolio — holding + metrics")
    footer(slide, 6)


def slide_visible(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg_cream(slide)
    header_band(
        slide,
        "What becomes visible on the investor",
        "After assignment, the investor portfolio surfaces the linked Property/Unit and plan data",
    )

    cards = [
        ("Associated inventory", "Property name, unit count, purchase & current value"),
        ("Selected plan", "Mortgage, customised payment schedule, or cash"),
        ("Financial snapshot", "Mortgage balance, equity, rent, net cash flow"),
        ("Ongoing management", "Remove / re-assign; Documents & Notes still on investor"),
    ]
    x = Inches(0.45)
    for title, body in cards:
        card = rect(slide, x, Inches(1.3), Inches(3.05), Inches(2.3), fill=WHITE, line=LINE)
        tb = slide.shapes.add_textbox(x + Inches(0.2), Inches(1.5), Inches(2.65), Inches(1.9))
        tf = add_text(tb, title, size=13, bold=True, color=DARK)
        tf.word_wrap = True
        add_para(tf, body, size=12, color=MUTED, space_before=8)
        x += Inches(3.2)

    # End-to-end chain
    chain = rect(slide, Inches(0.45), Inches(3.9), Inches(12.4), Inches(2.5), fill=DARK, line=None)
    tb = slide.shapes.add_textbox(Inches(0.75), Inches(4.15), Inches(11.8), Inches(2.0))
    tf = add_text(tb, "End-to-end chain", size=16, bold=True, color=YELLOW)
    add_para(
        tf,
        "Development (optional parent)  →  Property  →  Unit(s) + Mortgage / Payment plan  →  Investor portfolio holding",
        size=14,
        color=WHITE,
        space_before=12,
    )
    add_para(
        tf,
        "Standalone Properties skip the Development link but still support Units, plans, and investor assignment.",
        size=13,
        color=RGBColor(0xC8, 0xC8, 0xCC),
        space_before=10,
    )
    footer(slide, 7)


def main():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    slide_title(prs)
    slide_development(prs)
    slide_property(prs)
    slide_units(prs)
    slide_plans(prs)
    slide_assign(prs)
    slide_visible(prs)

    prs.save(OUT)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
