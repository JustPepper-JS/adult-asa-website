
const DEFAULT_ADULT_ASA_SITE_ICON = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%20512%20512%27%3E%3Cdefs%3E%3CradialGradient%20id%3D%27g%27%20cx%3D%2750%25%27%20cy%3D%2738%25%27%20r%3D%2770%25%27%3E%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%231f3340%27/%3E%3Cstop%20offset%3D%2755%25%27%20stop-color%3D%27%230b1118%27/%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%2305070b%27/%3E%3C/radialGradient%3E%3ClinearGradient%20id%3D%27r%27%20x1%3D%270%25%27%20y1%3D%270%25%27%20x2%3D%27100%25%27%20y2%3D%27100%25%27%3E%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%2386c8da%27/%3E%3Cstop%20offset%3D%2755%25%27%20stop-color%3D%27%231f8fa3%27/%3E%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%23ff7a14%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle%20cx%3D%27256%27%20cy%3D%27256%27%20r%3D%27244%27%20fill%3D%27url%28%23g%29%27%20stroke%3D%27url%28%23r%29%27%20stroke-width%3D%2718%27/%3E%3Cpath%20d%3D%27M127%20330c42-95%2081-154%20129-154s87%2059%20129%20154h-60l-23-54h-92l-23%2054h-60zm102-100h54l-27-62-27%2062z%27%20fill%3D%27%23dff8ff%27/%3E%3C/svg%3E";

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
  if (page === "players") return "players";
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

function adultAsaIconSource() {
  try {
    const saved = localStorage.getItem("adultasa_site_icon");
    return saved && saved.startsWith("data:image/") ? saved : DEFAULT_ADULT_ASA_SITE_ICON;
  } catch (error) {
    return DEFAULT_ADULT_ASA_SITE_ICON;
  }
}

function adultAsaApplyBrandIcon() {
  const icon = adultAsaIconSource();
  document.querySelectorAll("img[data-adultasa-icon]").forEach((img) => {
    if (!img.getAttribute("src")) img.src = icon;
    img.onerror = () => {
      img.onerror = null;
      img.src = DEFAULT_ADULT_ASA_SITE_ICON;
    };
  });

  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  favicon.href = icon;
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
      if (text === "home" || text.includes("adult asa cluster") || text.includes("pve cluster command center")) {
        child.remove();
      }
    });
  });
}

function adultAsaInitSharedNav() {
  document.querySelectorAll("[data-shared-nav]").forEach(adultAsaBuildNav);
  adultAsaApplyBrandIcon();
  adultAsaCleanOldNavTrash();
  setTimeout(adultAsaApplyBrandIcon, 250);
  setTimeout(adultAsaCleanOldNavTrash, 250);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", adultAsaInitSharedNav);
} else {
  adultAsaInitSharedNav();
}
