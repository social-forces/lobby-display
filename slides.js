const SLIDE_MS = 20_000;
const DATA_REFRESH_MS = 30 * 60 * 1000;
const BADGE_LABELS = {
  most_read: "Most Read",
  most_cited: "Most Cited",
};

const stage = document.getElementById("stage");
const progressBar = document.getElementById("progressBar");
const doiEl = document.querySelector('[data-slot="doi"]');
const qrBlock = document.getElementById("qrBlock");
const qrEl = document.getElementById("qr");

function renderQR(doiUrl) {
  if (!doiUrl || typeof qrcode !== "function") {
    qrBlock.classList.add("is-hidden");
    return;
  }
  const url = doiUrl.startsWith("http") ? doiUrl : `https://${doiUrl}`;
  // type 0 = auto, level "M" = ~15% error correction (good for camera scans)
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  // Render as SVG so it scales cleanly on any TV resolution
  qrEl.innerHTML = qr.createSvgTag({ scalable: true, margin: 0 });
  qrBlock.classList.remove("is-hidden");
}

let slides = [];
let idx = 0;
let paused = false;
let pausedUntil = 0;
let slideTimer = null;
let progressTimer = null;
let progressStart = 0;
let currentNode = null;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadData() {
  const res = await fetch(`./data.json?t=${Date.now()}`);
  const data = await res.json();
  slides = shuffle((data.slides || []).slice());
}

// Title fields can contain a small allowed set of HTML tags
// (italics for periodical / book / species names). Whitelist render only.
const RICH_TEXT_SLOTS = new Set(["title", "book_title", "hook", "snippet"]);
const ALLOWED_TAGS = new Set(["i", "em", "sup", "sub", "b", "strong"]);

function renderRich(el, value) {
  el.textContent = "";
  if (!value) return;
  // Parse the value in a detached document; copy over only allowed tags as text.
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${value}</root>`, "text/html");
  const root = doc.querySelector("root");
  if (!root) {
    el.textContent = value;
    return;
  }
  const walk = (src, dst) => {
    src.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        dst.appendChild(document.createTextNode(n.nodeValue));
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const tag = n.tagName.toLowerCase();
        if (ALLOWED_TAGS.has(tag)) {
          const child = document.createElement(tag);
          walk(n, child);
          dst.appendChild(child);
        } else {
          walk(n, dst); // strip the tag, keep its children
        }
      }
    });
  };
  walk(root, el);
}

function renderSlide(slide) {
  const tpl = document.getElementById(`t-${slide.type}`);
  if (!tpl) return null;
  const node = tpl.content.firstElementChild.cloneNode(true);

  if (slide.type === "book_review" && slide.cover) {
    node.classList.add("has-cover");
  }

  node.querySelectorAll("[data-slot]").forEach((el) => {
    const key = el.dataset.slot;
    let val = slide[key] ?? "";
    if (slide.type === "classic" && key === "badge") {
      val = BADGE_LABELS[slide.source] || "Classic";
    }
    if (slide.type === "classic" && key === "rank") {
      val = val ? `№ ${val}` : "";
    }
    if (slide.type === "book_review" && key === "reviewer") {
      val = val ? `Reviewed by ${val}` : "";
    }
    if (slide.type === "book_review" && key === "dot") {
      val = slide.book_year ? "·" : "";
    }
    if (key === "cover") {
      if (val) {
        el.src = val;
      } else {
        el.removeAttribute("src");
      }
      return;
    }
    if (key === "cover_wrap") {
      return;
    }
    if (RICH_TEXT_SLOTS.has(key)) {
      renderRich(el, val);
    } else {
      el.textContent = val;
    }
    if (!val) el.style.display = "none";
  });

  return node;
}

function fitSlide(node) {
  // Auto-shrink slide content if it would overflow the stage.
  // Measures natural content height by temporarily aligning content to the
  // top (instead of centered) so the last child's bounding box reflects the
  // true content extent, regardless of grid centering.
  node.style.transform = "";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const cs = getComputedStyle(node);
    const padTop = parseFloat(cs.paddingTop);
    const padBot = parseFloat(cs.paddingBottom);
    const availH = node.clientHeight - padTop - padBot;

    const orig = node.style.alignContent;
    node.style.alignContent = "start";
    // Force reflow.
    void node.offsetHeight;

    const slideRect = node.getBoundingClientRect();
    let bottom = slideRect.top + padTop;
    for (const c of node.children) {
      const r = c.getBoundingClientRect();
      if (r.height > 0 && r.bottom > bottom) bottom = r.bottom;
    }
    const contentH = bottom - (slideRect.top + padTop);

    node.style.alignContent = orig;

    if (contentH > availH) {
      const scale = Math.max(0.4, (availH / contentH) * 0.96);
      node.style.transform = `scale(${scale})`;
      node.style.transformOrigin = "50% 50%";
    }
  }));
}

function show(slide) {
  doiEl.textContent = slide.doi_url || "";
  renderQR(slide.doi_url);

  const next = renderSlide(slide);
  if (!next) return;

  const old = currentNode;
  stage.appendChild(next);

  requestAnimationFrame(() => {
    next.classList.add("is-active");
    fitSlide(next);
  });

  if (old) {
    old.classList.remove("is-active");
    setTimeout(() => old.remove(), 800);
  }
  currentNode = next;

  startProgress();
}

window.addEventListener("resize", () => {
  if (currentNode) fitSlide(currentNode);
});

function startProgress() {
  progressStart = performance.now();
  progressBar.style.width = "0%";
  if (progressTimer) cancelAnimationFrame(progressTimer);
  const tick = () => {
    if (paused) {
      progressTimer = requestAnimationFrame(tick);
      return;
    }
    const elapsed = performance.now() - progressStart;
    const pct = Math.min(100, (elapsed / SLIDE_MS) * 100);
    progressBar.style.width = `${pct}%`;
    if (elapsed < SLIDE_MS) progressTimer = requestAnimationFrame(tick);
  };
  progressTimer = requestAnimationFrame(tick);
}

function next() {
  if (!slides.length) return;
  idx = (idx + 1) % slides.length;
  show(slides[idx]);
}

function prev() {
  if (!slides.length) return;
  idx = (idx - 1 + slides.length) % slides.length;
  show(slides[idx]);
}

function loop() {
  slideTimer = setTimeout(() => {
    if (paused && performance.now() < pausedUntil) {
      loop();
      return;
    }
    if (paused) paused = false;
    next();
    loop();
  }, SLIDE_MS);
}

function pauseTemporarily(ms = 60_000) {
  paused = true;
  pausedUntil = performance.now() + ms;
}

// Keyboard controls (testing convenience)
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") {
    clearTimeout(slideTimer);
    next();
    loop();
  } else if (e.key === "ArrowLeft") {
    clearTimeout(slideTimer);
    prev();
    loop();
  } else if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    if (paused) {
      paused = false;
      progressStart = performance.now();
    } else {
      pauseTemporarily(10 * 60 * 1000);
    }
  } else if (e.key.toLowerCase() === "f") {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      document.body.classList.remove("fullscreen-mode");
    } else {
      document.documentElement.requestFullscreen();
      document.body.classList.add("fullscreen-mode");
    }
  }
});

async function refreshDataPeriodically() {
  setInterval(async () => {
    try {
      const prevLen = slides.length;
      await loadData();
      if (slides.length !== prevLen) idx = idx % Math.max(slides.length, 1);
    } catch (e) {
      console.warn("Data refresh failed:", e);
    }
  }, DATA_REFRESH_MS);
}

async function boot() {
  await loadData();
  if (!slides.length) {
    stage.innerHTML = '<div style="font-family:Lora,serif;font-size:2vw;color:#999">No slides yet — run displays/build_data.py</div>';
    return;
  }
  show(slides[idx]);
  loop();
  refreshDataPeriodically();
}

boot().catch((e) => {
  stage.innerHTML = `<div style="font-family:Inter;font-size:1.4vw;color:#b00">Failed to load: ${e.message}</div>`;
  console.error(e);
});
