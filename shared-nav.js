function renderNav(activePage) {
  const navHTML = `
    <div class="top-nav">
      <a class="top-nav-btn ${activePage === 'status' ? 'primary' : ''}" href="./index.html">Live Status</a>
      <a class="top-nav-btn ${activePage === 'heatmap' ? 'primary' : ''}" href="./heatmap.html">Heat Map</a>
      <a class="top-nav-btn ${activePage === 'tracker' ? 'primary' : ''}" href="./tracker.html">Live Tracker</a>
      <a class="top-nav-btn ${activePage === 'movement' ? 'primary' : ''}" href="./movement.html">Movement History</a>
      <a class="top-nav-btn discord" href="https://discord.gg/adultasa" target="_blank">Join Our Discord</a>
    </div>
  `;

  const navContainer = document.getElementById("shared-nav");
  if (navContainer) {
    navContainer.innerHTML = navHTML;
  }
}
