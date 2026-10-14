import pptxgen from "pptxgenjs";

const OUT = "C:/Users/Telfair/Desktop/lerobot-repo/docs/project-overview.pptx";
const W = 13.33, H = 7.5;
const px = (v) => v / 96; // original design was 1280x720 px

const C = {
  ink: "101820", muted: "50606F", pale: "EEF3F5", panel: "E3EBEF",
  rule: "B9C6CE", blue: "2186C4", blue2: "65B7E7", teal: "0C8C84",
  orange: "D86B3A", red: "C64444", white: "FFFFFF",
  cardBlue: "F2F8FB", cardGray: "F7FAFB", redTint: "FCECEB", redTint2: "FDF3F0",
  blueTint: "E8F5FB", pillBlue: "CAE7F6", pillTeal: "CBEFEA", pillOrange: "F9DECF", blueSide: "DCECF5",
};
const FONT = "Arial";
const SRC = "Source: this project's engineering journal, training configs, and reflection notes.";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Sun Haonan";
pres.title = "LeRobot x SO-ARM101 — From Low Loss to Generalization";

function card(s, x, y, w, h, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.08 });
}
function text(s, value, x, y, w, h, size = 16, color = C.ink, bold = false, align = "left") {
  s.addText(value, { x, y, w, h, fontSize: size, fontFace: FONT, color, bold, align, valign: "top", margin: 0 });
}
function rule(s, x, y, w, color = C.rule, weight = 1) {
  s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width: weight } });
}
function arrowRight(s, x, y, w, color = C.blue) {
  rule(s, x, y, w, color, 2.5);
  s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: x + w - 0.16, y: y - 0.10, w: 0.18, h: 0.20, fill: { color }, line: { color, width: 0 }, rotate: 90 });
}
function header(s, kicker, headline, n) {
  text(s, kicker.toUpperCase(), px(52), px(36), 7.5, 0.32, 12.5, C.blue, true);
  text(s, headline, px(52), px(72), px(1138), 0.62, 25, C.ink, true);
  text(s, `${String(n).padStart(2, "0")} / 10`, px(1140), px(40), px(90), 0.28, 11.5, C.muted, true, "right");
  rule(s, px(52), px(144), px(1176));
}
function notes(s, extra = "") {
  s.addNotes(`[Sources]\n${SRC}${extra ? "\n" + extra : ""}\n[/Sources]`);
}
function pill(s, value, x, y, w, fill) {
  card(s, x, y, w, 0.32, fill);
  text(s, value, x, y + 0.065, w, 0.2, 11.5, C.ink, true, "center");
}
function metric(s, value, label, x, y, w, accent = C.blue) {
  text(s, value, x, y, w, 0.85, 30, accent, true);
  text(s, label, x, y + 0.9, w, 0.55, 12.5, C.muted);
}

/* ---------- Slide 1 · Cover ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  card(s, px(1), px(1), px(662), px(718), C.pale);
  card(s, px(664), px(1), px(615), px(718), C.blueSide);
  text(s, "LeRobot × SO-ARM101", px(58), px(58), 5.2, 0.3, 13, C.blue, true);
  s.addText([
    { text: "From Low Loss", options: { breakLine: true } },
    { text: "to Generalization", options: {} },
  ], { x: px(58), y: px(130), w: 5.73, h: 2.0, fontSize: 40, fontFace: FONT, color: C.ink, bold: true, valign: "top", margin: 0 });
  text(s, "A complete engineering loop of a robotic-arm behavior-cloning experiment — and its key finding", px(58), px(305), px(534), 0.85, 15, C.muted);
  rule(s, px(58), px(412), px(490), C.rule, 1.5);
  text(s, "Project overview | Data collection · Cloud training · Local deployment · Reflection", px(58), px(436), 6.4, 0.35, 12.5, C.ink);
  text(s, "2026.05–06", px(58), px(625), 2.3, 0.25, 11, C.muted);
  // abstract robotics motif
  text(s, "Behavior-cloning baseline", px(724), px(70), 4.3, 0.3, 14, C.ink, true);
  card(s, px(724), px(150), px(400), px(385), C.white);
  rule(s, px(766), px(455), px(302), C.ink, 5);
  rule(s, px(795), px(436), px(70), C.blue, 16);
  rule(s, px(860), px(370), px(44), C.blue, 14);
  rule(s, px(900), px(315), px(88), C.blue, 13);
  rule(s, px(980), px(280), px(48), C.teal, 11);
  [[786, 437, 24, C.orange], [858, 370, 24, C.orange], [897, 315, 24, C.orange], [977, 280, 22, C.orange]].forEach(([x, y, d, col]) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px(x), y: px(y), w: px(d), h: px(d), fill: { color: col }, line: { color: col, width: 0 }, rectRadius: 0.05 });
  });
  card(s, px(1020), px(262), px(55), px(36), C.ink);
  s.addText([
    { text: "RGB", options: { breakLine: true } },
    { text: "vision", options: {} },
  ], { x: px(1006), y: px(325), w: px(86), h: 0.75, fontSize: 12, fontFace: FONT, color: C.muted, bold: true, align: "center", valign: "top", margin: 0 });
  pill(s, "49 demos", px(724), px(575), px(112), C.pillBlue);
  pill(s, "50k steps", px(850), px(575), px(112), C.pillTeal);
  pill(s, "ACT", px(976), px(575), px(72), C.pillOrange);
  notes(s);
}

/* ---------- Slide 2 · Thesis ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "Project thesis", "Low loss is not the goal — generalization is", 2);
  text(s, "We built an end-to-end imitation-learning pipeline, then held \u201ctraining convergence\u201d up against real deployment.", px(52), px(176), px(880), 0.6, 16, C.muted);
  metric(s, "6.793 \u2192 0.110", "training loss, a 98.4% reduction", px(52), px(290), 3.2, C.blue);
  metric(s, "49", "cleaned demonstration episodes", px(392), px(290), 2.6, C.teal);
  metric(s, "51.7M", "ACT policy parameters", px(702), px(290), 2.7, C.orange);
  card(s, px(975), px(258), px(242), px(212), C.redTint);
  s.addText([
    { text: "No generalization", options: { breakLine: true } },
    { text: "at deployment", options: {} },
  ], { x: px(990), y: px(292), w: px(212), h: 1.1, fontSize: 19, fontFace: FONT, color: C.red, bold: true, align: "center", valign: "top", margin: 0 });
  text(s, "the arm kept reaching toward the most frequent grasp position in training", px(990), px(390), px(212), 0.9, 12.5, C.muted, false, "center");
  rule(s, px(52), px(570), px(1168));
  text(s, "Core conclusion: a low training loss proves the fit succeeded — by itself it does not prove the vision-to-action policy generalizes.", px(52), px(598), px(1085), 0.7, 16.5, C.ink, true);
  notes(s);
}

/* ---------- Slide 3 · Pipeline ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "System loop", "From human demonstration to robot action, end to end", 3);
  const steps = [
    ["Teleoperated collection", "Leader \u2192 Follower\nRGB video + joint states", C.blue],
    ["Data governance", "anomalous-episode cleanup\nv2.1 \u2192 v3.0 conversion", C.teal],
    ["Cloud training", "AutoDL RTX 4090\nACT / 50,000 steps", C.orange],
    ["Local deployment", "RTX 3060 Ti\ncamera + Follower execution", C.red],
  ];
  steps.forEach(([t, b, col], i) => {
    const x = px(52 + i * 292);
    card(s, x, px(255), px(224), px(230), C.cardGray);
    text(s, `0${i + 1}`, x + 0.23, px(300), 0.75, 0.55, 24, col, true);
    text(s, t, x + 0.23, px(352), px(176), 0.42, 15.5, C.ink, true);
    s.addText(b.split("\n").map((line, j, arr) => ({ text: line, options: { breakLine: j < arr.length - 1 } })),
      { x: x + 0.23, y: px(400), w: px(176), h: 1.0, fontSize: 12.5, fontFace: FONT, color: C.muted, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });
    if (i < 3) arrowRight(s, x + px(228), px(368), px(46), C.rule);
  });
  text(s, "The engineering work went far beyond the training script: 18 problems spanning hardware, versions, data formats, and offline environments were each diagnosed and solved.", px(52), px(545), px(1100), 0.75, 16, C.ink, true);
  notes(s);
}

/* ---------- Slide 4 · Dataset ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "Dataset", "The data let the model converge — and set its limits", 4);
  card(s, px(52), px(185), px(425), px(365), C.cardBlue);
  text(s, "Usable training data", px(82), px(212), 3.0, 0.32, 14, C.blue, true);
  metric(s, "49", "valid demonstrations (50 planned; 1 anomalous episode removed)", px(82), px(258), 3.4, C.blue);
  metric(s, "12,625", "frames after v3.0 conversion", px(82), px(402), 3.1, C.blue);
  card(s, px(512), px(185), px(716), px(365), C.cardGray);
  text(s, "Observations & actions", px(544), px(212), 3.4, 0.32, 14, C.teal, true);
  text(s, "Input", px(544), px(264), 1.5, 0.32, 14, C.ink, true);
  s.addText([
    { text: "front-view RGB 640\u00d7480 \u00b7 30 FPS", options: { breakLine: true } },
    { text: "6-DoF arm joint state", options: {} },
  ], { x: px(544), y: px(300), w: px(290), h: 0.95, fontSize: 12.5, fontFace: FONT, color: C.muted, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });
  text(s, "Output", px(892), px(264), 1.5, 0.32, 14, C.ink, true);
  s.addText([
    { text: "6-DoF actions", options: { breakLine: true } },
    { text: "100-step action chunks", options: {} },
  ], { x: px(892), y: px(300), w: px(280), h: 0.95, fontSize: 12.5, fontFace: FONT, color: C.muted, valign: "top", margin: 0, lineSpacingMultiple: 1.15 });
  rule(s, px(544), px(400), px(638));
  text(s, "Key limitation", px(544), px(424), 2.2, 0.32, 14, C.red, true);
  text(s, "One object type \u00b7 limited position & container variation \u00b7 no language annotations.\nThese gaps mapped directly into the generalization failure.", px(544), px(462), px(605), 0.85, 13.5, C.ink, true);
  text(s, "Note: the raw ZIP preserves the pre-cleanup count of 50 episodes / 12,883 frames; experimental conclusions use the cleaned, converted set of 49 / 12,625.", px(52), px(596), px(1128), 0.55, 11, C.muted);
  notes(s, "The episode/frame-count discrepancy is stated explicitly to avoid reading archival metadata as final experimental data.");
}

/* ---------- Slide 5 · Model & training ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "Model & training", "ACT encodes vision and arm state into action chunks", 5);
  const cols = [
    ["Vision encoding", "ResNet-18\nImageNet-pretrained", C.blue],
    ["Temporal decision", "Transformer\n4-layer encoder / 1-layer decoder", C.teal],
    ["Action generation", "VAE + 100-step\naction chunks", C.orange],
  ];
  cols.forEach(([t, b, col], i) => {
    const x = px(52 + i * 390);
    card(s, x, px(200), px(330), px(250), C.cardGray);
    text(s, t, x + 0.29, px(240), px(265), 0.42, 16, C.ink, true);
    s.addText(b.split("\n").map((line, j, arr) => ({ text: line, options: { breakLine: j < arr.length - 1 } })),
      { x: x + 0.29, y: px(300), w: px(265), h: 1.0, fontSize: 13, fontFace: FONT, color: C.muted, valign: "top", margin: 0, lineSpacingMultiple: 1.2 });
    text(s, `0${i + 1}`, x + 0.29, px(392), 0.6, 0.35, 13, col, true);
    if (i < 2) arrowRight(s, x + px(336), px(320), px(44), C.rule);
  });
  rule(s, px(52), px(516), px(1176));
  text(s, "Training setup", px(52), px(540), 1.9, 0.32, 14, C.blue, true);
  text(s, "AdamW \u00b7 lr 1e-5 \u00b7 batch size 8 \u00b7 dropout 0.1 \u00b7 50,000 steps \u00b7 ~78 minutes", px(222), px(540), px(940), 0.35, 14, C.ink, true);
  text(s, "Capacity: 51,668,614 parameters (~207 MB FP32); ~6 GB of VRAM in practice \u2014 trained on a cloud RTX 4090, inferred on a local RTX 3060 Ti.", px(52), px(596), px(1120), 0.4, 12.5, C.muted);
  notes(s);
}

/* ---------- Slide 6 · Training evidence ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "Training evidence", "Smooth convergence — but not the finish line", 6);
  s.addChart(pres.charts.LINE, [{
    name: "Training loss",
    labels: ["0", "3k", "10k", "20k", "40k", "50k"],
    values: [6.793, 0.902, 0.35, 0.18, 0.12, 0.11],
  }], {
    x: px(52), y: px(185), w: px(750), h: px(400),
    chartColors: [C.blue], lineSize: 3, lineSmooth: false,
    lineDataSymbol: "circle", lineDataSymbolSize: 8,
    chartArea: { fill: { color: C.white } },
    showLegend: false, showTitle: false,
    catAxisLabelColor: C.muted, catAxisLabelFontSize: 11, catAxisLabelFontFace: FONT,
    valAxisLabelColor: C.muted, valAxisLabelFontSize: 11, valAxisLabelFontFace: FONT,
    valAxisMinVal: 0, valAxisMaxVal: 7, valAxisMajorUnit: 1,
    valGridLine: { color: "E7EDF0", size: 0.5 }, catGridLine: { style: "none" },
    showCatAxisTitle: true, catAxisTitle: "training steps", catAxisTitleColor: C.muted, catAxisTitleFontSize: 11, catAxisTitleFontFace: FONT,
    showValAxisTitle: true, valAxisTitle: "loss", valAxisTitleColor: C.muted, valAxisTitleFontSize: 11, valAxisTitleFontFace: FONT,
  });
  card(s, px(860), px(200), px(320), px(138), C.blueTint);
  text(s, "98.4%", px(890), px(228), 2.8, 0.7, 27, C.blue, true);
  text(s, "loss reduction", px(890), px(288), 2.6, 0.3, 12.5, C.muted);
  card(s, px(860), px(362), px(320), px(175), C.redTint);
  text(s, "Deployment is mandatory", px(890), px(388), 3.0, 0.4, 15.5, C.red, true);
  text(s, "Only a real deployment can tell whether the model learned the rule — or a shortcut.", px(890), px(430), px(262), 0.85, 12.5, C.ink);
  text(s, "Training logs confirm 50,000 / 50,000 steps completed; the trailing network error came from the automatic push_to_hub upload failing and did not affect the checkpoint.", px(52), px(618), px(1100), 0.4, 11, C.muted);
  notes(s);
}

/* ---------- Slide 7 · Deployment ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "Real-world deployment", "Confident actions, memorized answers", 7);
  card(s, px(52), px(185), px(488), px(375), C.cardGray);
  text(s, "During training", px(82), px(214), 2.2, 0.36, 15, C.blue, true);
  s.addText([
    { text: "Overhead Orbbec Astra Pro Plus", options: { breakLine: true } },
    { text: "Limited position variation", options: { breakLine: true } },
    { text: "Expert trajectories stay near \u201ccorrect\u201d states", options: {} },
  ], { x: px(82), y: px(264), w: px(360), h: 1.55, fontSize: 15.5, fontFace: FONT, color: C.ink, bold: true, valign: "top", margin: 0, lineSpacingMultiple: 1.25 });
  text(s, "training distribution: fairly narrow", px(82), px(438), 4.2, 0.35, 13, C.muted);
  arrowRight(s, px(552), px(368), px(122), C.red);
  card(s, px(708), px(185), px(488), px(375), C.redTint2);
  text(s, "During inference", px(738), px(214), 2.2, 0.36, 15, C.red, true);
  s.addText([
    { text: "Side-view webcam", options: { breakLine: true } },
    { text: "Object positions changed", options: { breakLine: true } },
    { text: "Action errors enter unseen states", options: {} },
  ], { x: px(738), y: px(264), w: px(370), h: 1.55, fontSize: 15.5, fontFace: FONT, color: C.ink, bold: true, valign: "top", margin: 0, lineSpacingMultiple: 1.25 });
  text(s, "test distribution: shifted", px(738), px(438), 4.2, 0.35, 13, C.muted);
  text(s, "Observed behavior", px(52), px(598), 2.4, 0.35, 14, C.red, true);
  text(s, "Wherever the object was placed, the arm reached toward the most frequent grasp position from training — and kept repeating it.", px(240), px(598), px(924), 0.5, 14, C.ink, true);
  notes(s, "Deployment observations come from the engineering journal; the distribution-shift / compounding-error explanation comes from the local reflection notes.");
}

/* ---------- Slide 8 · Key insight ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "Key finding", "Overfitting can disguise itself as confident action", 8);
  card(s, px(52), px(205), px(520), px(320), C.cardGray);
  text(s, "The textbook picture", px(82), px(238), 3.0, 0.36, 14, C.blue, true);
  s.addText([
    { text: "low training loss,", options: { breakLine: true } },
    { text: "worse test metrics", options: {} },
  ], { x: px(82), y: px(292), w: px(380), h: 1.25, fontSize: 20, fontFace: FONT, color: C.ink, bold: true, valign: "top", margin: 0, lineSpacingMultiple: 1.1 });
  text(s, "the model memorized samples and fails to generalize", px(82), px(400), px(380), 0.6, 12.5, C.muted);
  card(s, px(704), px(205), px(524), px(320), C.redTint);
  text(s, "What this project showed", px(734), px(238), 3.5, 0.36, 14, C.red, true);
  s.addText([
    { text: "extremely low training loss,", options: { breakLine: true } },
    { text: "yet a \u201cfixed grasp\u201d in the real scene", options: {} },
  ], { x: px(734), y: px(292), w: px(420), h: 1.25, fontSize: 20, fontFace: FONT, color: C.ink, bold: true, valign: "top", margin: 0, lineSpacingMultiple: 1.1 });
  text(s, "it chose the cheapest prediction on the training set — not an understanding of the scene in front of it", px(734), px(400), px(420), 0.75, 12.5, C.muted);
  arrowRight(s, px(586), px(360), px(100), C.rule);
  text(s, "Why it matters", px(52), px(580), 1.9, 0.35, 14, C.teal, true);
  text(s, "This turns \u201clow loss \u2260 a reliable policy\u201d from a theoretical claim into reproducible evidence from a real robot deployment.", px(222), px(580), px(965), 0.5, 15, C.ink, true);
  notes(s);
}

/* ---------- Slide 9 · Root causes ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "Root-cause analysis", "A joint mismatch across data, model, and deployment", 9);
  const rows = [
    ["Insufficient data diversity", "one object type, unsystematic position variation", C.red],
    ["Model\u2013data scale mismatch", "51.7M parameters facing ~12.6k frames", C.orange],
    ["Missing task intent", "pure vision \u2192 action, no language conditioning", C.teal],
    ["Train / inference vision mismatch", "overhead Astra vs. side-view webcam", C.blue],
  ];
  rows.forEach(([t, b, col], i) => {
    const y = px(185 + i * 92);
    card(s, px(52), y, px(1128), px(70), C.cardGray);
    s.addShape(pres.shapes.OVAL, { x: px(78), y: y + px(23), w: 0.26, h: 0.26, fill: { color: col }, line: { color: col, width: 0 } });
    text(s, t, px(118), y + px(16), px(300), 0.42, 14.5, C.ink, true);
    text(s, b, px(435), y + px(19), px(700), 0.4, 13.5, C.muted);
  });
  text(s, "Reflection: errors compound in sequential decision-making — one small deviation can carry the arm into states the expert demonstrations never covered.", px(52), px(580), px(1100), 0.6, 14.5, C.ink, true);
  notes(s, "Contributions and the distribution-shift account come from the local engineering notes and reflection record; the reflection also proposes augmentation and DAgger-style expert labeling as correctives.");
}

/* ---------- Slide 10 · Roadmap ---------- */
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  header(s, "Next steps", "Turning this failure into the VLA experimental design", 10);
  const phases = [
    ["01 \u00b7 A robust baseline first", "\u2265 5 objects \u00d7 6 initial positions\nSame camera for training and inference\nTest whether diversity alone fixes generalization", C.blue],
    ["02 \u00b7 Close the loop on data", "Perturbations and augmentation\nLet the policy run, collect off-track states\nAdd expert corrections, DAgger-style", C.teal],
    ["03 \u00b7 Bring in task intent", "A language instruction bound to every episode\nACT + CLIP text encoder, or fine-tune a VLA\n\u201cWhich one to grasp\u201d no longer depends on position", C.orange],
  ];
  phases.forEach(([t, b, col], i) => {
    const x = px(52 + i * 390);
    card(s, x, px(198), px(344), px(330), C.cardGray);
    text(s, t, x + 0.27, px(236), px(300), 0.6, 15, C.ink, true);
    text(s, `phase ${i + 1}`, x + 0.27, px(284), 1.2, 0.28, 11, col, true);
    s.addText(b.split("\n").map((line, j, arr) => ({ text: line, options: { bullet: { code: "2013", indent: 10 }, breakLine: j < arr.length - 1 } })),
      { x: x + 0.27, y: px(320), w: px(296), h: 1.8, fontSize: 12.5, fontFace: FONT, color: C.muted, valign: "top", margin: 0, paraSpaceAfter: 6 });
  });
  text(s, "The end goal is not a smaller loss — it is an arm that still completes the task when facing new objects, new positions, and natural-language instructions.", px(52), px(588), px(1120), 0.6, 15, C.ink, true);
  notes(s, "The roadmap comes from the project journal and reflection notes; the VLA direction is a next-stage plan, not a result achieved in this stage.");
}

pres.writeFile({ fileName: OUT }).then(() => console.log("WROTE " + OUT));
