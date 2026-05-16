const DEFAULT_ADULT_ASA_SITE_ICON = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%20512%20512%27%3E%3Cdefs%3E%3CradialGradient%20id%3D%27g%27%20cx%3D%2750%25%27%20cy%3D%2738%25%27%20r%3D%2770%25%27%3E%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%231f3340%27/%3E%3Cstop%20offset%3D%2755%25%27%20stop-color%3D%27%230b1118%27/%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%2305070b%27/%3E%3C/radialGradient%3E%3ClinearGradient%20id%3D%27r%27%20x1%3D%270%25%27%20y1%3D%270%25%27%20x2%3D%27100%25%27%20y2%3D%27100%25%27%3E%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%2386c8da%27/%3E%3Cstop%20offset%3D%2755%25%27%20stop-color%3D%271f8fa3%27/%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%23ff7a14%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle%20cx%3D%27256%27%20cy%3D%27256%27%20r%3D%27244%27%20fill%3D%27url%28%23g%29%27%20stroke%3D%27url%28%23r%29%27%20stroke-width%3D%2718%27/%3E%3Cpath%20d%3D%27M127%20330c42-95%2081-154%20129-154s87%2059%20129%20154h-60l-23-54h-92l-23%2054h-60zm102-100h54l-27-62-27%2062z%27%20fill%3D%27%23dff8ff%27/%3E%3C/svg%3E";

const ADULT_ASA_NAV_ITEMS = [
  { key: "home", href: "./index.html", label: "Command Center", group: "core" },
  { key: "cluster", href: "./cluster-status.html", label: "Cluster Status", group: "core" },
  { key: "heatmap", href: "./heatmap.html", label: "Heat Map", group: "core" },
  { key: "tracker", href: "./tracker.html", label: "Cluster Activity", group: "core" },
  { key: "movement", href: "./movement.html", label: "Movement History", group: "core" },
  { key: "profile", href: "./profile.html", label: "Player Profile", group: "core" },
  { key: "staff", href: "./staff.html", label: "Meet the Staff", group: "community" },
  { key: "mods", href: "./mods.html", label: "Active Mods", group: "community" },
  { key: "tribe", href: "./tribe.html", label: "Tribe Up", group: "community" },
  { key: "boss", href: "./boss-roles.html", label: "Claim Boss Roles", group: "community" },
  { key: "link", href: "./link-survivor.html", label: "Link Survivor", group: "utility" },
  { key: "admin", href: "./admin.html", label: "Admin Panel", group: "utility" }
];

function isAdultAsaCommandCenterPage() {
  const path = String(location.pathname || "").toLowerCase();
  return path === "/" || path.endsWith("/index.html") || path.endsWith("/");
}

function getAdultAsaSiteIcon() {
  try {
    const saved = localStorage.getItem("adultasa_site_icon");
    return saved && saved.startsWith("data:image/") ? saved : DEFAULT_ADULT_ASA_SITE_ICON;
  } catch (error) {
    return DEFAULT_ADULT_ASA_SITE_ICON;
  }
}

function injectAdultAsaNavSafetyStyles() {
  if (document.getElementById("adultasa-nav-safety-styles")) return;

  const style = document.createElement("style");
  style.id = "adultasa-nav-safety-styles";
  style.textContent = `
    [data-shared-nav] img,
    [data-shared-nav] picture,
    [data-shared-nav] svg:not(.keep-shared-nav-svg),
    [data-shared-nav] .shared-nav-brand,
    [data-shared-nav] .brand-mark,
    [data-shared-nav] .brand-orb,
    [data-shared-nav] .brand-orb-img {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      max-width: 0 !important;
      max-height: 0 !important;
      overflow: hidden !important;
    }

    [data-shared-nav] {
      min-height: 0 !important;
    }

    .top-nav-btn.command-center-link {
      background: linear-gradient(90deg, rgba(154, 163, 255, 0.26), rgba(126, 201, 222, 0.16));
      border-color: rgba(154, 163, 255, 0.36);
      color: #f4fbff;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.025),
        0 12px 24px rgba(0,0,0,0.18),
        0 0 18px rgba(154, 163, 255, 0.12);
    }

    .top-nav-btn.command-center-link:hover {
      border-color: rgba(154, 163, 255, 0.58);
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.035),
        0 16px 30px rgba(0,0,0,0.24),
        0 0 22px rgba(154, 163, 255, 0.18);
    }

    body:not(.adultasa-command-center) img,
    body:not(.adultasa-command-center) picture,
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
      width: 0 !important;
      height: 0 !important;
      max-width: 0 !important;
      max-height: 0 !important;
      min-width: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    body:not(.adultasa-command-center) header {
      margin-top: 0 !important;
    }

    body:not(.adultasa-command-center) [style*="background-image"] {
      background-image: none !important;
    }
  `;
  document.head.appendChild(style);
}

function applyAdultAsaSiteIcon() {
  const iconSrc = getAdultAsaSiteIcon();
  const isCommandCenter = isAdultAsaCommandCenterPage();

  if (isCommandCenter) {
    document.querySelectorAll("img[data-adultasa-icon]").forEach((img) => {
      const isCommandCenterLogo = img.closest(".top-command") || img.closest(".brand-orb");
      if (!isCommandCenterLogo) return;

      img.onerror = () => {
        img.onerror = null;
        img.src = DEFAULT_ADULT_ASA_SITE_ICON;
      };
      img.src = iconSrc;
    });
  } else {
    document.querySelectorAll("img, picture").forEach((el) => {
      el.remove();
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

function removeSecondaryPageBranding() {
  if (isAdultAsaCommandCenterPage()) return;

  const selectors = [
    ".top-command",
    ".brand-mark",
    ".brand-orb",
    ".brand-orb-img",
    ".site-logo",
    ".logo",
    ".logo-wrap",
    ".hero-logo",
    ".page-logo",
    ".cluster-logo",
    "img",
    "picture"
  ];

  document.querySelectorAll(selectors.join(",")).forEach((el) => {
    if (el.closest(".panel") && !el.matches("img, picture")) return;
    el.remove();
  });

  document.querySelectorAll("[style]").forEach((el) => {
    const style = String(el.getAttribute("style") || "");
    if (/background-image|url\(/i.test(style)) {
      el.style.backgroundImage = "none";
    }
  });
}

function renderNav(activePage = "") {
  injectAdultAsaNavSafetyStyles();
  removeSecondaryPageBranding();

  document.querySelectorAll("[data-shared-nav]").forEach((container) => {
    const page = container.dataset.page || activePage || "";
    const compact = container.dataset.navStyle === "compact";

    container.innerHTML = ADULT_ASA_NAV_ITEMS.map((item) => {
      const activeClass = page === item.key ? "primary" : "";
      const utilityClass = item.group === "utility" ? "utility-link" : "";
      const adminClass = item.key === "admin" ? "admin-link" : "";
      const commandClass = item.key === "home" ? "command-center-link" : "";
      return `<a class="top-nav-btn ${activeClass} ${utilityClass} ${adminClass} ${commandClass}" href="${item.href}">${item.label}</a>`;
    }).join("\n") + `\n<a class="top-nav-btn discord" href="https://discord.gg/adultasa" target="_blank" rel="noopener">Join Our Discord</a>`;

    container.classList.toggle("compact-nav", compact);
  });

  applyAdultAsaSiteIcon();
  removeSecondaryPageBranding();
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.toggle("adultasa-command-center", isAdultAsaCommandCenterPage());
  injectAdultAsaNavSafetyStyles();
  removeSecondaryPageBranding();

  const firstNav = document.querySelector("[data-shared-nav]");
  renderNav(firstNav ? firstNav.dataset.page || "" : "");

  setTimeout(removeSecondaryPageBranding, 250);
  setTimeout(removeSecondaryPageBranding, 1000);
});
