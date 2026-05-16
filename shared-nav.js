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

function adultAsaNormalizePage(value) {
  const page = String(value || "").trim().toLowerCase();

  if (page === "home" || page === "index" || page === "command-center") return "command-center";
  if (page === "cluster-status") return "cluster";
  if (page === "boss-roles") return "boss";
  if (page === "link-survivor") return "link";
  if (page === "staff-whitelist") return "stafflist";

  return page;
}

function adultAsaPageFromPath() {
  const path = String(window.location.pathname || "").toLowerCase();
  const last = (path.split("/").filter(Boolean).pop() || "index").replace(/\.html$/, "");

  if (!last || last === "index") return "command-center";
  return adultAsaNormalizePage(last);
}

function adultAsaIsCommandCenter(currentPage) {
  return adultAsaNormalizePage(currentPage || adultAsaPageFromPath()) === "command-center";
}

function adultAsaInjectNavStyles() {
  if (document.getElementById("adultasa-command-center-nav-styles")) return;

  const style = document.createElement("style");
  style.id = "adultasa-command-center-nav-styles";
  style.textContent = `
    [data-shared-nav] {
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 12px !important;
    }

    [data-shared-nav] > a:not(.top-nav-btn),
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
      min-width: 190px !important;
      background: linear-gradient(90deg, rgba(88, 101, 242, 0.32), rgba(126, 201, 222, 0.18)) !important;
      border-color: rgba(126, 201, 222, 0.42) !important;
      color: #f4fbff !important;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.03),
        0 12px 24px rgba(0,0,0,0.18),
        0 0 20px rgba(88,101,242,0.20) !important;
    }

    .top-nav-btn.command-center-link:hover,
    .top-links a.command-center-link:hover {
      border-color: rgba(126, 201, 222, 0.66) !important;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.04),
        0 16px 30px rgba(0,0,0,0.24),
        0 0 26px rgba(88,101,242,0.28) !important;
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

function adultAsaBuildNav(container) {
  const currentPage = adultAsaNormalizePage(container.dataset.page || adultAsaPageFromPath());
  const isCommandCenter = adultAsaIsCommandCenter(currentPage);

  document.body.classList.toggle("adultasa-command-center", isCommandCenter);

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
    const activeClass = adultAsaNormalizePage(item.key) === currentPage ? "primary" : "";
    const extraClass = item.extraClass || "";

    return `<a class="top-nav-btn ${activeClass} ${extraClass}" href="${item.href}">${item.label}</a>`;
  }).join("") + `<a class="top-nav-btn discord" href="https://discord.gg/adultasa" target="_blank" rel="noopener">Join Our Discord</a>`;
}

function adultAsaCleanOldNavTrash() {
  document.querySelectorAll("[data-shared-nav]").forEach((container) => {
    Array.from(container.children).forEach((child) => {
      const text = String(child.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (
        text === "home" ||
        text.includes("adult asa cluster") ||
        text.includes("pve cluster command center")
      ) {
        child.remove();
      }
    });
  });
}

function adultAsaInitSharedNav() {
  adultAsaInjectNavStyles();

  document.querySelectorAll("[data-shared-nav]").forEach(adultAsaBuildNav);

  adultAsaCleanOldNavTrash();
  setTimeout(adultAsaCleanOldNavTrash, 250);
  setTimeout(adultAsaCleanOldNavTrash, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", adultAsaInitSharedNav);
} else {
  adultAsaInitSharedNav();
}
