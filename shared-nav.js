function renderNav(activePage) {
  const navItems = [
    { key: "home", href: "./index.html", label: "Home" },
    { key: "cluster", href: "./cluster-status.html", label: "Cluster Status" },
    { key: "heatmap", href: "./heatmap.html", label: "Heat Map" },
    { key: "tracker", href: "./tracker.html", label: "Cluster Activity" },
    { key: "movement", href: "./movement.html", label: "Movement History" },
    { key: "mods", href: "./mods.html", label: "Active Mods" },
    { key: "staff", href: "./staff.html", label: "Meet the Staff" },
    { key: "tribe", href: "./tribe.html", label: "Tribe Up" },
    { key: "link", href: "./link-survivor.html", label: "Link Survivor" },
    { key: "boss", href: "./boss-roles.html", label: "Claim Boss Roles" },
    { key: "stafflist", href: "./staff-whitelist.html", label: "Staff Whitelist" }
  ];

  document.querySelectorAll('[data-shared-nav]').forEach((container) => {
    const page = container.dataset.page || activePage || "";

    const links = navItems.map((item) => {
      const activeClass = page === item.key ? "primary" : "";
      return `<a class="top-nav-btn ${activeClass}" href="${item.href}">${item.label}</a>`;
    }).join("\n");

    container.innerHTML = `
      ${links}
      <a class="top-nav-btn discord" href="https://discord.gg/adultasa" target="_blank">Join Our Discord</a>
    `;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector('[data-shared-nav]');
  if (!container) return;
  renderNav(container.dataset.page || "");
});
