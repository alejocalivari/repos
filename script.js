// Constants / selectors
const API_BASE = "https://api.github.com/users";
const DEFAULT_USERNAME = "octocat";
const PAGE_SIZE = 12;

const STORAGE_KEYS = {
  username: "premium-gh-dashboard:last-username",
  sortMode: "premium-gh-dashboard:sort-mode",
  theme: "premium-gh-dashboard:theme",
};

const elements = {
  body: document.body,
  form: document.getElementById("search-form"),
  input: document.getElementById("username-input"),
  searchButton: document.getElementById("search-button"),
  sortSelect: document.getElementById("sort-select"),
  filterInput: document.getElementById("filter-input"),
  themeToggle: document.getElementById("theme-toggle"),
  themeLabel: document.querySelector(".theme-toggle__label"),
  profilePanel: document.getElementById("profile-panel"),
  insightGrid: document.getElementById("insight-grid"),
  repoSummary: document.getElementById("repo-summary"),
  repoState: document.getElementById("repo-state"),
  repoGrid: document.getElementById("repo-grid"),
  showMoreButton: document.getElementById("show-more-button"),
  announcer: document.getElementById("status-announcer"),
};

// State
const state = {
  username: "",
  profile: null,
  repos: [],
  visibleCount: PAGE_SIZE,
  sortMode: getStoredValue(STORAGE_KEYS.sortMode, "stars"),
  filterTerm: "",
  theme: getStoredValue(STORAGE_KEYS.theme, "dark"),
  loading: false,
};

// Utility helpers
function getStoredValue(key, fallbackValue) {
  try {
    return localStorage.getItem(key) || fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Storage can fail in some environments, so we silently continue.
  }
}

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return "soon";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function sanitizeUrl(url) {
  if (!url || !url.trim()) {
    return "";
  }

  return /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
}

function displayUrl(url) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function announce(message) {
  elements.announcer.textContent = message;
}

function getStaggerClass(index) {
  const step = (index % 12) + 1;
  return `stagger-${step}`;
}

function getTopLanguages(repos, limit = 3) {
  const counts = repos.reduce((map, repo) => {
    if (!repo.language) {
      return map;
    }

    map[repo.language] = (map[repo.language] || 0) + 1;
    return map;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([language]) => language);
}

function getRepoTotals(repos) {
  return repos.reduce(
    (totals, repo) => {
      totals.stars += repo.stargazers_count || 0;
      totals.forks += repo.forks_count || 0;
      return totals;
    },
    { stars: 0, forks: 0 }
  );
}

function getMostRecentUpdate(repos) {
  if (!repos.length) {
    return "No activity yet";
  }

  const latest = repos.reduce((newest, repo) => {
    return new Date(repo.updated_at) > new Date(newest.updated_at) ? repo : newest;
  }, repos[0]);

  return formatDate(latest.updated_at);
}

function getShowcaseRepos(repos) {
  const nonForks = repos.filter((repo) => !repo.fork);
  return nonForks.length ? nonForks : repos;
}

function getFilteredAndSortedRepos() {
  const query = state.filterTerm.trim().toLowerCase();

  const filteredRepos = query
    ? state.repos.filter((repo) => repo.name.toLowerCase().includes(query))
    : [...state.repos];

  return filteredRepos.sort((repoA, repoB) => {
    if (state.sortMode === "updated") {
      return new Date(repoB.updated_at) - new Date(repoA.updated_at);
    }

    return (
      repoB.stargazers_count - repoA.stargazers_count ||
      new Date(repoB.updated_at) - new Date(repoA.updated_at)
    );
  });
}

function setLoadingState(isLoading) {
  state.loading = isLoading;
  elements.profilePanel.setAttribute("aria-busy", String(isLoading));
  elements.searchButton.disabled = isLoading;
  elements.sortSelect.disabled = isLoading;
  elements.filterInput.disabled = isLoading;
  elements.showMoreButton.disabled = isLoading;
}

function setTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  elements.body.setAttribute("data-theme", state.theme);

  const nextTheme = state.theme === "dark" ? "light" : "dark";
  elements.themeToggle.setAttribute("aria-pressed", String(state.theme === "light"));
  elements.themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
  elements.themeLabel.textContent = nextTheme === "light" ? "Light Mode" : "Dark Mode";

  setStoredValue(STORAGE_KEYS.theme, state.theme);
}

function getErrorContent(error, username) {
  const message = error?.data?.message || error?.message || "An unexpected response came back from GitHub.";

  if (error?.status === 404) {
    return {
      variant: "warning",
      title: "GitHub user not found",
      description: `We could not find @${username}. Double-check the username and try another profile.`,
    };
  }

  if (error?.status === 403 && /rate limit/i.test(message)) {
    const resetAt = error.rateLimitReset
      ? formatDateTime(new Date(Number(error.rateLimitReset) * 1000))
      : "a little later";

    return {
      variant: "warning",
      title: "GitHub API rate limit reached",
      description: `GitHub has temporarily capped unauthenticated requests. Try again after ${resetAt}.`,
    };
  }

  if (error instanceof TypeError) {
    return {
      variant: "error",
      title: "Network connection issue",
      description: "The dashboard could not reach GitHub right now. Check your connection and retry.",
    };
  }

  return {
    variant: "error",
    title: "Something went wrong",
    description: message,
  };
}

function getIcon(name) {
  const icons = {
    spark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4L12 3Z"></path><path d="M5 18.5 6 21l1-2.5L9.5 17 7 16l-1-2.5L5 16l-2.5 1L5 18.5Z"></path><path d="M18.5 16 19.25 18l.75-2 2-1-.75-.25L18.5 13l-.75 1.75L15.75 15l2 .75.75 2.25Z"></path></svg>',
    alert:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z"></path></svg>',
    location:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>',
    company:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><path d="M9 9v.01"></path><path d="M9 12v.01"></path><path d="M9 15v.01"></path><path d="M9 18v.01"></path></svg>',
    link:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L10 5"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7.1 7.1L14 19"></path></svg>',
    calendar:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path></svg>',
    star:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z"></path></svg>',
    fork:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.5"></circle><circle cx="18" cy="5" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="M8.5 5h4a3.5 3.5 0 0 1 3.5 3.5V16.5"></path><path d="M16 8.5V11"></path><path d="M8.5 5v11a3 3 0 0 0 3 3H15.5"></path></svg>',
    code:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9-4 3 4 3"></path><path d="m16 9 4 3-4 3"></path><path d="m13 6-2 12"></path></svg>',
    arrow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg>',
    copy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  };

  return icons[name] || "";
}

// Fetch functions
async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const apiError = new Error(data?.message || "Request failed");
    apiError.status = response.status;
    apiError.data = data;
    apiError.rateLimitReset = response.headers.get("x-ratelimit-reset");
    throw apiError;
  }

  return data;
}

async function fetchUserDashboard(username) {
  const safeUsername = encodeURIComponent(username.trim());
  const profileUrl = `${API_BASE}/${safeUsername}`;
  const reposUrl = `${API_BASE}/${safeUsername}/repos?per_page=100&sort=updated`;

  const [profile, repos] = await Promise.all([fetchJSON(profileUrl), fetchJSON(reposUrl)]);

  return {
    profile,
    repos: getShowcaseRepos(repos),
  };
}

// Render loading state
function renderLoadingState() {
  setLoadingState(true);

  elements.profilePanel.innerHTML = `
    <div class="skeleton-card">
      <div class="profile-card__head">
        <div class="skeleton skeleton-avatar"></div>
        <div class="profile-card__identity">
          <div class="skeleton skeleton-line skeleton-line--sm"></div>
          <div class="skeleton skeleton-line skeleton-line--md space-top-sm"></div>
          <div class="skeleton skeleton-line skeleton-line--sm space-top-sm"></div>
        </div>
      </div>
      <div class="skeleton skeleton-line skeleton-line--lg"></div>
      <div class="skeleton skeleton-line skeleton-line--md"></div>
      <div class="skeleton-stat-grid">
        <div class="skeleton skeleton-stat"></div>
        <div class="skeleton skeleton-stat"></div>
        <div class="skeleton skeleton-stat"></div>
      </div>
      <div class="skeleton skeleton-line skeleton-line--lg"></div>
      <div class="skeleton skeleton-line skeleton-line--md"></div>
      <div class="skeleton skeleton-line skeleton-line--lg"></div>
    </div>
  `;

  elements.insightGrid.innerHTML = Array.from({ length: 3 }, () => {
    return `
      <article class="insight-card">
        <div class="skeleton skeleton-line skeleton-line--sm"></div>
        <div class="skeleton skeleton-line skeleton-line--md space-top-md"></div>
        <div class="skeleton skeleton-line skeleton-line--lg space-top-md"></div>
      </article>
    `;
  }).join("");

  elements.repoSummary.textContent = "Loading profile data, repository insights, and showcase cards...";
  elements.repoState.innerHTML = renderStateCard({
    title: "Gathering GitHub signals",
    description: "Fetching profile data, sorting repositories, and preparing a polished view.",
  });

  elements.repoGrid.innerHTML = Array.from({ length: 6 }, () => {
    return `
      <div class="skeleton-repo">
        <div class="skeleton skeleton-line skeleton-line--md"></div>
        <div class="skeleton skeleton-line skeleton-line--lg space-top-lg"></div>
        <div class="skeleton skeleton-line skeleton-line--md space-top-md"></div>
        <div class="skeleton skeleton-line skeleton-line--sm space-top-xl"></div>
        <div class="skeleton skeleton-line skeleton-line--lg space-top-xl"></div>
      </div>
    `;
  }).join("");

  elements.showMoreButton.hidden = true;
}

function renderStateCard({ title, description, variant = "default" }) {
  const variantClass =
    variant === "error" ? "state-card--error" : variant === "warning" ? "state-card--warning" : "";

  return `
    <div class="state-card ${variantClass}">
      <div class="state-card__icon">${getIcon(variant === "error" || variant === "warning" ? "alert" : "spark")}</div>
      <div>
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(description)}</p>
      </div>
    </div>
  `;
}

// Render profile
function renderProfile(profile) {
  const blogUrl = sanitizeUrl(profile.blog);
  const websiteMarkup = blogUrl
    ? `<a href="${escapeHTML(blogUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(displayUrl(blogUrl))}</a>`
    : '<span class="muted">No website listed</span>';

  const location = profile.location || "Location not shared";
  const company = profile.company || "Independent / not listed";
  const bio = profile.bio || "No bio provided. This profile keeps the focus on the work itself.";

  elements.profilePanel.innerHTML = `
    <article class="profile-card">
      <div class="profile-card__top">
        <div class="profile-card__head">
          <div class="profile-avatar-wrap">
            <img src="${escapeHTML(profile.avatar_url)}" alt="${escapeHTML(profile.login)} avatar">
          </div>

          <div class="profile-card__identity">
            <span class="status-pill">${getIcon("spark")} Live GitHub Profile</span>
            <h2 class="profile-name">${escapeHTML(profile.name || profile.login)}</h2>
            <p class="profile-username">@${escapeHTML(profile.login)}</p>
          </div>
        </div>

        <p class="profile-bio">${escapeHTML(bio)}</p>
      </div>

      <div class="profile-stats">
        <article class="stat-card">
          <span class="stat-card__label">Followers</span>
          <strong>${formatCompactNumber(profile.followers)}</strong>
        </article>

        <article class="stat-card">
          <span class="stat-card__label">Following</span>
          <strong>${formatCompactNumber(profile.following)}</strong>
        </article>

        <article class="stat-card">
          <span class="stat-card__label">Public Repos</span>
          <strong>${formatCompactNumber(profile.public_repos)}</strong>
        </article>
      </div>

      <div class="meta-list">
        <div class="meta-row">
          ${getIcon("location")}
          <div>
            <span class="meta-label">Location</span>
            <p class="meta-value">${escapeHTML(location)}</p>
          </div>
        </div>

        <div class="meta-row">
          ${getIcon("company")}
          <div>
            <span class="meta-label">Company</span>
            <p class="meta-value">${escapeHTML(company)}</p>
          </div>
        </div>

        <div class="meta-row">
          ${getIcon("link")}
          <div>
            <span class="meta-label">Website</span>
            <p class="meta-value">${websiteMarkup}</p>
          </div>
        </div>

        <div class="meta-row">
          ${getIcon("calendar")}
          <div>
            <span class="meta-label">Joined GitHub</span>
            <p class="meta-value">${escapeHTML(formatDate(profile.created_at))}</p>
          </div>
        </div>
      </div>

      <div class="profile-actions">
        <a
          class="primary-button"
          href="${escapeHTML(profile.html_url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="button-icon">${getIcon("arrow")}</span>
          View GitHub Profile
        </a>

        <button
          class="secondary-button"
          type="button"
          data-copy-profile-url="${escapeHTML(profile.html_url)}"
        >
          <span class="button-icon">${getIcon("copy")}</span>
          Copy Profile URL
        </button>
      </div>
    </article>
  `;
}

// Render repository insights
function renderInsights(profile, repos) {
  if (!profile) {
    elements.insightGrid.innerHTML = renderStateCard({
      title: "Insights unavailable",
      description: "Search for a GitHub profile to see language, activity, and repository summaries.",
    });
    return;
  }

  const totals = getRepoTotals(repos);
  const topLanguages = getTopLanguages(repos);

  const cards = [
    {
      label: "Top Languages",
      value: topLanguages.length ? topLanguages.join(" / ") : "No language data",
      description: topLanguages.length
        ? "Most common languages across the curated repository set."
        : "Language badges will appear once repository data is available.",
    },
    {
      label: "Total Stars",
      value: formatCompactNumber(totals.stars),
      description: "Combined stars across the curated repositories currently shown.",
    },
    {
      label: "Recent Activity",
      value: getMostRecentUpdate(repos),
      description: "Latest repository update across the filtered showcase collection.",
    },
  ];

  elements.insightGrid.innerHTML = cards
    .map((card) => {
      return `
        <article class="insight-card">
          <p class="insight-card__label">${escapeHTML(card.label)}</p>
          <strong>${escapeHTML(card.value)}</strong>
          <p>${escapeHTML(card.description)}</p>
        </article>
      `;
    })
    .join("");
}

// Render repositories
function renderRepositories() {
  const processedRepos = getFilteredAndSortedRepos();
  const visibleRepos = processedRepos.slice(0, state.visibleCount);
  const totalRepos = state.repos.length;
  const topLanguages = getTopLanguages(state.repos);
  const totals = getRepoTotals(state.repos);

  if (!totalRepos) {
    elements.repoSummary.textContent = "This GitHub profile has no public repositories available to showcase yet.";
    elements.repoState.innerHTML = renderStateCard({
      title: "No repositories found",
      description: "There are no public repositories to display for this profile at the moment.",
      variant: "warning",
    });
    elements.repoGrid.innerHTML = "";
    elements.showMoreButton.hidden = true;
    return;
  }

  if (!processedRepos.length) {
    elements.repoSummary.textContent = `No repositories matched "${state.filterTerm}". Try another keyword.`;
    elements.repoState.innerHTML = renderStateCard({
      title: "No matching repositories",
      description: "Adjust the repository filter to widen the search across this profile.",
      variant: "warning",
    });
    elements.repoGrid.innerHTML = "";
    elements.showMoreButton.hidden = true;
    return;
  }

  const showingCount = Math.min(visibleRepos.length, processedRepos.length);
  elements.repoSummary.textContent = `Showing ${showingCount} of ${processedRepos.length} curated repositories for @${state.username}.`;

  elements.repoState.innerHTML = `
    <div class="repo-insights-bar">
      <span class="subtle-pill">${formatCompactNumber(totals.stars)} total stars</span>
      <span class="subtle-pill">${formatCompactNumber(totals.forks)} total forks</span>
      <span class="subtle-pill">${topLanguages.length ? `Top stack: ${topLanguages.join(" / ")}` : "Mixed repository stack"}</span>
      <span class="subtle-pill">${state.sortMode === "stars" ? "Sorted by popularity" : "Sorted by recent activity"}</span>
    </div>
  `;

  elements.repoGrid.innerHTML = visibleRepos
    .map((repo, index) => {
      const description = repo.description || "No description provided. The repository itself tells the story.";
      const language = repo.language || "Unknown";
      const visibility = repo.visibility || (repo.private ? "private" : "public");

      return `
        <article class="repo-card ${getStaggerClass(index)}">
          <div class="repo-card__header">
            <div>
              <h3 class="repo-card__title">
                <a href="${escapeHTML(repo.html_url)}" target="_blank" rel="noopener noreferrer">
                  ${escapeHTML(repo.name)}
                </a>
              </h3>
            </div>

            <span class="badge badge--muted">${escapeHTML(visibility)}</span>
          </div>

          <p class="repo-card__description">${escapeHTML(description)}</p>

          <div class="repo-card__badges">
            <span class="badge badge--language">${escapeHTML(language)}</span>
            ${repo.fork ? '<span class="badge badge--muted">Fork</span>' : '<span class="badge badge--muted">Original</span>'}
          </div>

          <div class="repo-card__meta">
            <span class="repo-stat">${getIcon("star")} ${formatCompactNumber(repo.stargazers_count)}</span>
            <span class="repo-stat">${getIcon("fork")} ${formatCompactNumber(repo.forks_count)}</span>
            <span class="repo-meta">${getIcon("code")} ${formatCompactNumber(repo.size)} KB</span>
          </div>

          <div class="repo-card__footer">
            <span class="repo-card__updated">Updated ${escapeHTML(formatDate(repo.updated_at))}</span>
            <a class="repo-link" href="${escapeHTML(repo.html_url)}" target="_blank" rel="noopener noreferrer">
              Open Repo
              <span class="button-icon">${getIcon("arrow")}</span>
            </a>
          </div>
        </article>
      `;
    })
    .join("");

  elements.showMoreButton.hidden = processedRepos.length <= visibleRepos.length;
}

// Render errors
function renderErrorState(error, username) {
  const content = getErrorContent(error, username);

  elements.profilePanel.innerHTML = renderStateCard(content);
  elements.insightGrid.innerHTML = renderStateCard({
    title: "Signals unavailable",
    description: "Insights will appear here after a successful profile lookup.",
    variant: content.variant,
  });
  elements.repoSummary.textContent = content.description;
  elements.repoState.innerHTML = renderStateCard(content);
  elements.repoGrid.innerHTML = "";
  elements.showMoreButton.hidden = true;
}

function renderDashboard() {
  renderProfile(state.profile);
  renderInsights(state.profile, state.repos);
  renderRepositories();
  setLoadingState(false);
}

// Main data loader
async function loadDashboard(username) {
  const normalizedUsername = username.trim();

  if (!normalizedUsername) {
    announce("Enter a GitHub username to begin.");
    elements.input.focus();
    return;
  }

  renderLoadingState();

  try {
    const { profile, repos } = await fetchUserDashboard(normalizedUsername);

    state.username = profile.login;
    state.profile = profile;
    state.repos = repos;
    state.visibleCount = PAGE_SIZE;
    state.filterTerm = "";

    elements.input.value = profile.login;
    elements.filterInput.value = "";
    setStoredValue(STORAGE_KEYS.username, profile.login);

    renderDashboard();
    announce(`Loaded ${profile.login} with ${repos.length} curated repositories.`);
  } catch (error) {
    state.username = normalizedUsername;
    state.profile = null;
    state.repos = [];
    state.visibleCount = PAGE_SIZE;

    renderErrorState(error, normalizedUsername);
    setLoadingState(false);
    announce(`Unable to load data for ${normalizedUsername}.`);
  }
}

async function copyProfileUrl(url, button) {
  const originalMarkup = button.innerHTML;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const tempInput = document.createElement("textarea");
      tempInput.value = url;
      tempInput.setAttribute("readonly", "");
      tempInput.className = "sr-only";
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
    }

    button.innerHTML = `${getIcon("spark")} Copied`;
    announce("GitHub profile URL copied to clipboard.");

    window.setTimeout(() => {
      button.innerHTML = originalMarkup;
    }, 1600);
  } catch (error) {
    announce("Copy failed. You can open the profile and copy the URL manually.");
  }
}

// Event listeners
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadDashboard(elements.input.value);
});

elements.sortSelect.addEventListener("change", () => {
  state.sortMode = elements.sortSelect.value;
  state.visibleCount = PAGE_SIZE;
  setStoredValue(STORAGE_KEYS.sortMode, state.sortMode);

  if (state.profile) {
    renderRepositories();
    announce(`Repositories sorted by ${state.sortMode === "stars" ? "most starred" : "recently updated"}.`);
  }
});

elements.filterInput.addEventListener("input", (event) => {
  state.filterTerm = event.target.value;
  state.visibleCount = PAGE_SIZE;

  if (state.profile) {
    renderRepositories();
  }
});

elements.showMoreButton.addEventListener("click", () => {
  state.visibleCount += PAGE_SIZE;
  renderRepositories();
  announce(`Showing ${Math.min(state.visibleCount, getFilteredAndSortedRepos().length)} repositories.`);
});

elements.themeToggle.addEventListener("click", () => {
  setTheme(state.theme === "dark" ? "light" : "dark");
});

elements.profilePanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-copy-profile-url]");

  if (!button) {
    return;
  }

  copyProfileUrl(button.getAttribute("data-copy-profile-url"), button);
});

// Initialization
function initialize() {
  setTheme(state.theme);
  elements.sortSelect.value = state.sortMode;

  const storedUsername = getStoredValue(STORAGE_KEYS.username, DEFAULT_USERNAME).trim() || DEFAULT_USERNAME;
  elements.input.value = storedUsername;

  loadDashboard(storedUsername);
}

initialize();
