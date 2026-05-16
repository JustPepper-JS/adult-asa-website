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

    container.innerHTML = `
      ${links}
      <a class="top-nav-btn discord" href="https://discord.gg/adultasa" target="_blank" rel="noopener">Join Our Discord</a>
    `;

    if (compact) container.classList.add("compact-nav");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector('[data-shared-nav]');
  if (!container) return;
  renderNav(container.dataset.page || "");
});
