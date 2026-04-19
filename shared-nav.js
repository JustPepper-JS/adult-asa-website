function renderNav(activePage) {
  const navHTML = `
    <a class="top-nav-btn ${activePage === 'index' ? 'primary' : ''}" href="./index.html">Live Status</a>
    <a class="top-nav-btn ${activePage === 'heatmap' ? 'primary' : ''}" href="./heatmap.html">Heat Map</a>
    <a class="top-nav-btn ${activePage === 'tracker' ? 'primary' : ''}" href="./tracker.html">Live Tracker</a>
    <a class="top-nav-btn ${activePage === 'movement' ? 'primary' : ''}" href="./movement.html">Movement History</a>
    <a class="top-nav-btn discord" href="https://discord.gg/adultasa" target="_blank">Join Our Discord</a>
  `;

  const containers = document.querySelectorAll('[data-shared-nav]');

  containers.forEach(container => {
    const page = container.dataset.page || activePage || "";
    container.innerHTML = navHTML.replace(
      new RegExp(`activePage === '${page}' \\? 'primary' : ''`, 'g'),
      'primary'
    );
  });
}

// AUTO RUN ON PAGE LOAD
document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector('[data-shared-nav]');
  if (!container) return;

  const activePage = container.dataset.page || "";
  renderNav(activePage);
});
