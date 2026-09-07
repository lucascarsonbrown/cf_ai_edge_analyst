"""Renders docs/figure.png for the README.

Documentation tooling — a diagram of the workflow in src/workflows/
reportWorkflow.ts. The eight steps below are the eight step.do() checkpoints
in that file, in order.

    pip install matplotlib && python3 docs/render_figure.py
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle

BG, PANEL, FG, MUTED = "#14171c", "#1b1f26", "#e6e4e0", "#8b8f98"
CF, AI, DO, DIM = "#f6821f", "#c678dd", "#5fb3b3", "#3a4350"

plt.rcParams.update({"figure.facecolor": BG, "savefig.facecolor": BG,
                     "text.color": FG, "font.size": 9})

fig, ax = plt.subplots(figsize=(13, 7.4))
fig.subplots_adjust(left=0.02, right=0.98, top=0.88, bottom=0.10)
ax.set_xlim(0, 13); ax.set_ylim(0, 8.6); ax.axis("off")

STEPS = [
    ("initialize",      "mark running",             DIM),
    ("fetch-context",   "Alpha Vantage",            DIM),
    ("overview",        "model",                    AI),
    ("bull case",       "model",                    AI),
    ("bear case",       "model",                    AI),
    ("key risks",       "model",                    AI),
    ("conclusion",      "model",                    AI),
    ("synthesize",      "assemble memo",            DIM),
]

# the workflow strip
w, gap = 1.42, 0.13
x0 = 0.35
ytop = 5.5
for i, (name, sub, colour) in enumerate(STEPS):
    x = x0 + i * (w + gap)
    ax.add_patch(FancyBboxPatch((x, ytop), w, 1.25,
                                boxstyle="round,pad=0.02,rounding_size=0.1",
                                fc=PANEL, ec=colour, lw=1.5))
    ax.text(x + w / 2, ytop + 0.82, name, ha="center", fontsize=8.6,
            color=FG, weight="bold")
    ax.text(x + w / 2, ytop + 0.42, sub, ha="center", fontsize=7.6, color=colour)
    ax.text(x + 0.11, ytop + 1.08, str(i + 1), ha="left", fontsize=7.2,
            color="#5a6270")
    if i < len(STEPS) - 1:
        ax.add_patch(FancyArrowPatch((x + w, ytop + 0.62), (x + w + gap, ytop + 0.62),
                                     arrowstyle="-|>", mutation_scale=9,
                                     color="#3a4350", lw=1.1))
    # checkpoint tick down to the DO
    ax.add_patch(FancyArrowPatch((x + w / 2, ytop), (x + w / 2, 4.15),
                                 arrowstyle="-|>", mutation_scale=8,
                                 color=DO, lw=0.9, alpha=0.65))

ax.text(0.35, 7.35, "Cloudflare Workflow — each box is one step.do() checkpoint",
        fontsize=10.5, color=FG, weight="bold")
ax.text(0.35, 6.95, "A step that fails retries on its own. A workflow that dies "
        "resumes at the last checkpoint instead of regenerating the memo from scratch.",
        fontsize=8.5, color=MUTED)

# the durable object
ax.add_patch(FancyBboxPatch((0.35, 2.75), 12.3, 1.4,
                            boxstyle="round,pad=0.02,rounding_size=0.12",
                            fc="#171f24", ec=DO, lw=1.6))
ax.text(6.5, 3.72, "Durable Object — one instance per report", ha="center",
        fontsize=10, color=DO, weight="bold")
ax.text(6.5, 3.30, "sections · status · full chat history", ha="center",
        fontsize=8.6, color=MUTED)
ax.text(6.5, 2.98, "state is written after every step, which is what lets the "
        "frontend show which step is running rather than a spinner",
        ha="center", fontsize=8.2, color="#6b7078", style="italic")

# edges
ax.add_patch(FancyBboxPatch((0.35, 0.95), 3.4, 1.15,
                            boxstyle="round,pad=0.02,rounding_size=0.12",
                            fc=PANEL, ec=CF, lw=1.5))
ax.text(2.05, 1.72, "Pages — frontend", ha="center", fontsize=9.5, color=FG,
        weight="bold")
ax.text(2.05, 1.33, "polls state every 2s", ha="center", fontsize=8.2, color=MUTED)

ax.add_patch(FancyBboxPatch((4.55, 0.95), 3.9, 1.15,
                            boxstyle="round,pad=0.02,rounding_size=0.12",
                            fc=PANEL, ec=CF, lw=1.5))
ax.text(6.5, 1.72, "Workers — API layer", ha="center", fontsize=9.5, color=FG,
        weight="bold")
ax.text(6.5, 1.33, "routing, validation, chat", ha="center", fontsize=8.2, color=MUTED)

ax.add_patch(FancyBboxPatch((9.25, 0.95), 3.4, 1.15,
                            boxstyle="round,pad=0.02,rounding_size=0.12",
                            fc=PANEL, ec=AI, lw=1.5))
ax.text(10.95, 1.72, "Workers AI", ha="center", fontsize=9.5, color=FG, weight="bold")
ax.text(10.95, 1.33, "Llama 3.3 70B → 3.1 8B on failure", ha="center",
        fontsize=8.2, color=MUTED)

for x in (2.05, 6.5, 10.95):
    ax.add_patch(FancyArrowPatch((x, 2.10), (x, 2.75), arrowstyle="<|-|>",
                                 mutation_scale=9, color="#3a4350", lw=1.1))

ax.text(6.5, 0.42, "No origin server, no external database, no orchestration "
        "middleware — five Cloudflare primitives composing into the whole application.",
        ha="center", fontsize=8.6, color=CF, style="italic")

fig.suptitle("cf_ai_edge_analyst — a research process modelled as durable steps, "
             "not one LLM call", fontsize=12.5, y=0.955)

fig.savefig(os.path.join(os.path.dirname(os.path.abspath(__file__)), "figure.png"),
            dpi=140)
print("saved docs/figure.png")
