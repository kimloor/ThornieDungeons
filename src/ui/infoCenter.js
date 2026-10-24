// Player Information Center page (WAVE 1.5). Presentation only: all content lives in src/data/infoCenter.js.
function infoSeenVersion() {
  try { return window.localStorage?.getItem(INFO_CENTER_VERSION_SEEN_KEY) || ""; } catch (e) { return ""; }
}
function infoMarkSeen() {
  try { window.localStorage?.setItem(INFO_CENTER_VERSION_SEEN_KEY, infoLatestVersion()); } catch (e) {}
}
function infoHasNew() {
  return infoSeenVersion() !== infoLatestVersion();
}

function InfoAnnouncementEntry({ entry, latest }) {
  const e = React.createElement;
  return e("article", { className: "md-info-entry" + (latest ? " is-latest" : "") },
    e("div", { className: "md-info-entry-head" },
      e("span", { className: "md-info-ver" }, "Ver " + entry.version),
      e("span", { className: "md-info-date" }, entry.date)
    ),
    e("h4", { className: "md-info-entry-title" }, entry.title),
    e("ul", { className: "md-info-list" }, entry.items.map((item, index) => e("li", { key: index }, item)))
  );
}

function InfoAnnouncements() {
  const e = React.createElement;
  const [tab, setTab] = useState("latest");
  const data = INFO_CENTER.announcements;
  const tabs = [["latest", "อัปเดตล่าสุด"], ["history", "ประวัติเวอร์ชัน"], ["roadmap", "แผนงาน"]];
  return e("div", null,
    e("div", { className: "md-info-tabs", role: "tablist" }, tabs.map(([id, label]) =>
      e("button", { key: id, role: "tab", "aria-selected": tab === id, className: "md-info-tab" + (tab === id ? " is-active" : ""), onClick: () => setTab(id) }, label))),
    tab === "latest" && e(InfoAnnouncementEntry, { entry: data.latest, latest: true }),
    tab === "history" && data.history.map(entry => e(InfoAnnouncementEntry, { key: entry.version, entry })),
    tab === "roadmap" && e("div", { className: "md-info-roadmap" },
      ["in_progress", "planned", "completed"].map(status => {
        const rows = data.roadmap.filter(item => item.status === status);
        if (!rows.length) return null;
        return e("section", { key: status, className: "md-info-road-group" },
          e("h4", { className: "md-info-road-title status-" + status }, data.statusLabels[status]),
          rows.map((item, index) => e("div", { key: index, className: "md-info-road-row" },
            e("strong", null, item.title),
            item.note ? e("span", null, item.note) : null)));
      }),
      e("p", { className: "md-info-note" }, "แผนงานเป็นแนวทางเบื้องต้น อาจเปลี่ยนแปลงได้ และไม่ใช่การรับประกันวันที่ปล่อย"))
  );
}

function InfoDocument({ section }) {
  const e = React.createElement;
  return e("div", null,
    e("div", { className: "md-info-meta" },
      e("span", null, "เวอร์ชัน " + section.version),
      e("span", null, "มีผล " + section.effectiveDate),
      e("span", null, "แก้ไขล่าสุด " + section.lastUpdated)
    ),
    section.status === "draft" && e("p", { className: "md-info-draft" }, "ฉบับร่างสำหรับช่วงทดสอบ เนื้อหาอาจมีการปรับปรุง และจะทบทวนอีกครั้งก่อนเปิดให้บริการเชิงพาณิชย์"),
    section.blocks.map((block, index) => e("section", { key: index, className: "md-info-block" },
      e("h4", null, block.heading),
      block.body.map((text, i) => e("p", { key: i }, text))))
  );
}

function InfoReserved({ section }) {
  const e = React.createElement;
  return e("div", { className: "md-info-reserved" },
    e("div", { className: "md-info-reserved-icon", "aria-hidden": "true" }, section.icon),
    e("p", null, section.reservedText || "เร็ว ๆ นี้")
  );
}

function InfoGuide({ section, topicId, onOpenTopic }) {
  const e = React.createElement;
  const topic = topicId ? section.topics.find(item => item.id === topicId) : null;
  if (!topic) {
    return e("div", { className: "md-info-menu" },
      section.intro ? e("p", { className: "md-info-draft" }, section.intro) : null,
      section.topics.map(item =>
        e("button", { key: item.id, className: "md-info-card", onClick: () => onOpenTopic(item.id) },
          e("span", { className: "md-info-card-icon", "aria-hidden": "true" }, item.icon),
          e("span", { className: "md-info-card-copy" }, e("strong", null, item.title), e("small", null, item.subtitle)))));
  }
  return e("div", null, topic.blocks.map((block, index) => e("section", { key: index, className: "md-info-block" },
    e("h4", null, block.heading),
    (block.body || []).map((text, i) => e("p", { key: "p" + i }, text)),
    block.rows && block.rows.length ? e("dl", { className: "md-info-rows" }, block.rows.map((row, i) =>
      e("div", { key: i, className: "md-info-row" }, e("dt", null, row[0]), e("dd", null, row[1])))) : null)));
}

// route: "section" or "section/topic" (see infoResolveRoute). Unknown routes open the menu.
function InfoCenterScreen({ initialRoute, onClose }) {
  const e = React.createElement;
  const resolved = infoResolveRoute(initialRoute);
  const [sectionId, setSectionId] = useState(resolved ? resolved.sectionId : "");
  const [topicId, setTopicId] = useState(resolved ? resolved.topicId : "");
  const [seenTick, setSeenTick] = useState(0);
  const section = sectionId ? infoFindSection(sectionId) : null;
  const topic = section && section.kind === "guide" && topicId ? (section.topics.find(item => item.id === topicId) || null) : null;
  useEffect(() => {
    if (sectionId === "announcements") { infoMarkSeen(); setSeenTick(tick => tick + 1); }
  }, [sectionId]);
  const hasNew = infoHasNew();
  const back = () => (topic ? setTopicId("") : section ? setSectionId("") : onClose && onClose());
  const body = !section ? e("div", { className: "md-info-menu" }, INFO_CENTER.groups.map(group =>
      e("section", { key: group.id, className: "md-info-group" },
        e("h3", { className: "md-info-group-title" }, group.title),
        INFO_CENTER.sections.filter(item => item.group === group.id).map(item =>
          e("button", { key: item.id, className: "md-info-card", onClick: () => { setTopicId(""); setSectionId(item.id); } },
            e("span", { className: "md-info-card-icon", "aria-hidden": "true" }, item.icon),
            e("span", { className: "md-info-card-copy" },
              e("strong", null, item.title),
              e("small", null, item.subtitle)),
            item.id === "announcements" && hasNew ? e("span", { className: "md-info-badge is-new" }, "NEW") : null,
            item.kind === "reserved" ? e("span", { className: "md-info-badge" }, "เร็ว ๆ นี้") : null,
            item.status === "draft" ? e("span", { className: "md-info-badge" }, "ฉบับร่าง") : null)))))
    : section.kind === "announcements" ? e(InfoAnnouncements, null)
    : section.kind === "guide" ? e(InfoGuide, { section, topicId: topic ? topic.id : "", onOpenTopic: setTopicId })
    : section.kind === "document" ? e(InfoDocument, { section })
    : e(InfoReserved, { section });
  return ReactDOM.createPortal(e("div", { className: "md-info-page", role: "dialog", "aria-modal": "true", "aria-label": "ข้อมูลและนโยบาย", "data-seen": seenTick },
    e("header", { className: "md-info-header" },
      e("button", { className: "md-btn info small md-info-back", onClick: back, "aria-label": section ? "กลับไปเมนูข้อมูล" : "ปิด" }, section ? "\u2190" : "\u2715"),
      e("div", { className: "md-info-header-copy" },
        e("h2", { className: "md-title" }, topic ? topic.title : section ? section.title : "ข้อมูลและนโยบาย"),
        e("p", { className: "md-sub" }, topic ? topic.subtitle : section ? section.subtitle : "ประกาศ คู่มือ และนโยบายของเกม")),
      section ? e("button", { className: "md-btn flee small md-info-close", onClick: onClose, "aria-label": "ปิดหน้าข้อมูล" }, "\u2715") : null),
    e("main", { className: "md-info-body" }, body)
  ), document.body);
}
