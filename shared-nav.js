const DEFAULT_ADULT_ASA_SITE_ICON = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%20512%20512%27%3E%3Cdefs%3E%3CradialGradient%20id%3D%27g%27%20cx%3D%2750%25%27%20cy%3D%2738%25%27%20r%3D%2770%25%27%3E%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%231f3340%27/%3E%3Cstop%20offset%3D%2755%25%27%20stop-color%3D%27%230b1118%27/%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%2305070b%27/%3E%3C/radialGradient%3E%3ClinearGradient%20id%3D%27r%27%20x1%3D%270%25%27%20y1%3D%270%25%27%20x2%3D%27100%25%27%20y2%3D%27100%25%27%3E%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%2386c8da%27/%3E%3Cstop%20offset%3D%2755%25%27%20stop-color%3D%271f8fa3%27/%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%23ff7a14%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle%20cx%3D%27256%27%20cy%3D%27256%27%20r%3D%27244%27%20fill%3D%27url%28%23g%29%27%20stroke%3D%27url%28%23r%29%27%20stroke-width%3D%2718%27/%3E%3Cpath%20d%3D%27M127%20330c42-95%2081-154%20129-154s87%2059%20129%20154h-60l-23-54h-92l-23%2054h-60zm102-100h54l-27-62-27%2062z%27%20fill%3D%27%23dff8ff%27/%3E%3C/svg%3E";

const ADULT_ASA_NAV_ITEMS = [
  { key: "cluster", href: "./cluster-status.html", label: "Cluster Status" },
  { key: "heatmap", href: "./heatmap.html", label: "Heat Map" },
  { key: "tracker", href: "./tracker.html", label: "Cluster Activity" },
  { key: "movement", href: "./movement.html", label: "Movement History" },
  { key: "profile", href: "./profile.html", label: "Player Profile" },
  { key: "staff", href: "./staff.html", label: "Meet the Staff" },
  { key: "mods", href: "./mods.html", label: "Active Mods" },
  { key: "tribe", href: "./tribe.html", label: "Tribe Up" },
  { key: "boss", href: "./boss-roles.html", label: "Claim Boss Roles" },
  { key: "link", href: "./link-survivor.html", label: "Link Survivor" },
  { key: "admin", href: "./admin.html", label: "Admin Panel", extraClass: "admin-link" }
];

function isAdultAsaCommandCenterPage() {
  const path = String(location.pathname || "").toLowerCase();
  return path === "/" || path.endsWith("/") || path.endsWith("/index.html");
}

function normalizeAdultAsaPage(page) {
  const value = String(page || "").trim().toLowerCase();
  if (value === "home" || value === "index" || value === "command-center") return "command-center";
  if (value === "cluster-status") return "cluster";
  if (value === "boss-roles") return "boss";
  return value;
}

function getAdultAsaSiteIcon() {
  try {
    const saved = localStorage.getItem("adultasa_site_icon");
    return saved && saved.startsWith("data:image/") ? saved : DEFAULT_ADULT_ASA_SITE_ICON;
  } catch (error) {
    return DEFAULT_ADULT_ASA_SITE_ICON;
  }
}

function injectAdultAsaNavStyles() {
  if (document.getElementById("adultasa-nav-fixed-styles")) return;

  const style = document.createElement("style");
  style.id = "adultasa-nav-fixed-styles";
  style.textContent = `
    [data-shared-nav] .shared-nav-brand,
    [data-shared-nav] .brand-mark,
    [data-shared-nav] .brand-orb,
    [data-shared-nav] .brand-orb-img,
    [data-shared-nav] img,
    [data-shared-nav] picture {
      display: none !important;
    }

    .top-nav-btn.command-center-link,
    .top-links a.command-center-link {
      background: linear-gradient(90deg, rgba(88, 101, 242, 0.34), rgba(126, 201, 222, 0.18)) !important;
      border-color: rgba(126, 201, 222, 0.38) !important;
      color: #f4fbff !important;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.03),
        0 12px 24px rgba(0,0,0,0.18),
        0 0 18px rgba(88,101,242,0.18) !important;
    }

    .top-nav-btn.command-center-link:hover,
    .top-links a.command-center-link:hover {
      border-color: rgba(126, 201, 222, 0.58) !important;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.04),
        0 16px 30px rgba(0,0,0,0.24),
        0 0 22px rgba(88,101,242,0.24) !important;
    }

    body:not(.adultasa-command-center) .top-command,
    body:not(.adultasa-command-center) .brand-mark,
    body:not(.adultasa-command-center) .brand-orb,
    body:not(.adultasa-command-center) .brand-orb-img,
    body:not(.adultasa-command-center) .site-logo,
    body:not(.adultasa-command-center) .logo,
    body:not(.adultasa-command-center) .logo-wrap,
    body:not(.adultasa-command-center) .hero-logo,
    body:not(.adultasa-command-center) .page-logo,
    body:not(.adultasa-command-center) .cluster-logo {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function applyAdultAsaSiteIcon() {
  const iconSrc = getAdultAsaSiteIcon();

  if (isAdultAsaCommandCenterPage()) {
    document.querySelectorAll("img[data-adultasa-icon]").forEach((img) => {
      img.onerror = () => {
        img.onerror = null;
        img.src = DEFAULT_ADULT_ASA_SITE_ICON;
      };
      img.src = iconSrc;
    });
  }

  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    document.head.appendChild(favicon);
  }
  favicon.href = iconSrc;
}

function removeBadBrandLinks() {
  if (isAdultAsaCommandCenterPage()) return;

  document.querySelectorAll("[data-shared-nav]").forEach((container) => {
    Array.from(container.children).forEach((child) => {
      const text = String(child.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (
        text.includes("adult asa cluster") ||
        text.includes("pve cluster command center") ||
        text === "home"
      ) {
        child.remove();
      }
    });
  });
}

function renderAdultAsaNav(activePage = "") {
  const isCommandCenter = isAdultAsaCommandCenterPage();
  document.body.classList.toggle("adultasa-command-center", isCommandCenter);

  injectAdultAsaNavStyles();
  applyAdultAsaSiteIcon();

  document.querySelectorAll("[data-shared-nav]").forEach((container) => {
    const page = normalizeAdultAsaPage(container.dataset.page || activePage || "");
    const items = [];

    if (!isCommandCenter) {
      items.push({
        key: "command-center",
        href: "./index.html",
        label: "Command Center",
        extraClass: "command-center-link"
      });
    }

    items.push(...ADULT_ASA_NAV_ITEMS);

    container.innerHTML = items.map((item) => {
      const active = normalizeAdultAsaPage(item.key) === page ? "primary" : "";
      const extra = item.extraClass || "";
      return `<a class="top-nav-btn ${active} ${extra}" href="${item.href}">${item.label}</a>`;
    }).join("") + `
      <a class="top-nav-btn discord" href="https://discord.gg/adultasa" target="_blank" rel="noopener">Join Our Discord</a>
    `;
  });

  removeBadBrandLinks();
}

function initAdultAsaNav() {
  renderAdultAsaNav();
  setTimeout(removeBadBrandLinks, 250);
  setTimeout(removeBadBrandLinks, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdultAsaNav);
} else {
  initAdultAsaNav();
}
