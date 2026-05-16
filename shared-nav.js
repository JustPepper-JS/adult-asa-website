const DEFAULT_ADULT_ASA_SITE_ICON = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%20512%20512%27%3E%0A%3Cdefs%3E%0A%3CradialGradient%20id%3D%27g%27%20cx%3D%2750%25%27%20cy%3D%2738%25%27%20r%3D%2770%25%27%3E%0A%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%231f3340%27/%3E%0A%3Cstop%20offset%3D%2755%25%27%20stop-color%3D%27%230b1118%27/%3E%0A%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%2305070b%27/%3E%0A%3C/radialGradient%3E%0A%3ClinearGradient%20id%3D%27r%27%20x1%3D%270%25%27%20y1%3D%270%25%27%20x2%3D%27100%25%27%20y2%3D%27100%25%27%3E%0A%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%2386c8da%27/%3E%0A%3Cstop%20offset%3D%2755%25%27%20stop-color%3D%27%231f8fa3%27/%3E%0A%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%23ff7a14%27/%3E%0A%3C/linearGradient%3E%0A%3C/defs%3E%0A%3Ccircle%20cx%3D%27256%27%20cy%3D%27256%27%20r%3D%27244%27%20fill%3D%27url%28%23g%29%27%20stroke%3D%27url%28%23r%29%27%20stroke-width%3D%2718%27/%3E%0A%3Ccircle%20cx%3D%27256%27%20cy%3D%27256%27%20r%3D%27198%27%20fill%3D%27none%27%20stroke%3D%27rgba%28126%2C201%2C222%2C.28%29%27%20stroke-width%3D%276%27/%3E%0A%3Cpath%20d%3D%27M127%20330c42-95%2081-154%20129-154s87%2059%20129%20154h-60l-23-54h-92l-23%2054h-60zm102-100h54l-27-62-27%2062z%27%20fill%3D%27%23dff8ff%27/%3E%0A%3Ctext%20x%3D%27256%27%20y%3D%27124%27%20text-anchor%3D%27middle%27%20font-family%3D%27Arial%2C%20Helvetica%2C%20sans-serif%27%20font-size%3D%2758%27%20font-weight%3D%27900%27%20fill%3D%27%2386c8da%27%3EADULT%20ASA%3C/text%3E%0A%3Ctext%20x%3D%27256%27%20y%3D%27405%27%20text-anchor%3D%27middle%27%20font-family%3D%27Arial%2C%20Helvetica%2C%20sans-serif%27%20font-size%3D%2746%27%20font-weight%3D%27900%27%20fill%3D%27%23ff9a4d%27%3EPVE%20CLUSTER%3C/text%3E%0A%3C/svg%3E";

function getAdultAsaSiteIcon() {
  try {
    const saved = localStorage.getItem("adultasa_site_icon");
    return saved && saved.startsWith("data:image/") ? saved : DEFAULT_ADULT_ASA_SITE_ICON;
  } catch (error) {
    return DEFAULT_ADULT_ASA_SITE_ICON;
  }
}

function applyAdultAsaSiteIcon() {
  const iconSrc = getAdultAsaSiteIcon();

  document.querySelectorAll("[data-adultasa-icon], .site-brand-logo").forEach((img) => {
    if (img && img.tagName === "IMG") {
      img.onerror = () => {
        img.onerror = null;
        img.src = DEFAULT_ADULT_ASA_SITE_ICON;
      };
      img.src = iconSrc;
    }
  });

  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    document.head.appendChild(favicon);
  }
  favicon.href = iconSrc;
}

function renderNav(activePage) {
  const navItems = [
    { key: "home", href: "./index.html", label: "Home", group: "core" },
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

  document.querySelectorAll('[data-shared-nav]').forEach((container) => {
    const page = container.dataset.page || activePage || "";
    const compact = container.dataset.navStyle === "compact";

    const links = navItems.map((item) => {
      const activeClass = page === item.key ? "primary" : "";
      const utilityClass = item.group === "utility" ? "utility-link" : "";
      const adminClass = item.key === "admin" ? "admin-link" : "";
      return `<a class="top-nav-btn ${activeClass} ${utilityClass} ${adminClass}" href="${item.href}">${item.label}</a>`;
    }).join("\n");

    const brand = page === "home" ? "" : `
      <a href="./index.html" class="site-brand" aria-label="Adult ASA Cluster Home">
        <img src="${getAdultAsaSiteIcon()}" class="site-brand-logo" data-adultasa-icon alt="Adult ASA Logo">
        <div class="site-brand-text">
          <div class="site-brand-title">Adult ASA Cluster</div>
          <div class="site-brand-sub">PvE Cluster Command Center</div>
        </div>
      </a>
    `;

    container.innerHTML = `
      ${brand}
      ${links}
      <a class="top-nav-btn discord" href="https://discord.gg/adultasa" target="_blank" rel="noopener">Join Our Discord</a>
    `;

    if (compact) container.classList.add("compact-nav");
  });

  applyAdultAsaSiteIcon();
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector('[data-shared-nav]');
  if (container) renderNav(container.dataset.page || "");
  applyAdultAsaSiteIcon();
});
