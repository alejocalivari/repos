// Constants / selectors
const API_BASE = "https://api.github.com/users";
const DEFAULT_USERNAME = "octocat";
const PAGE_SIZE = 12;
const UNKNOWN_LANGUAGE_VALUE = "__unknown";

const STORAGE_KEYS = {
  username: "premium-gh-dashboard:last-username",
  sortMode: "premium-gh-dashboard:sort-mode",
  theme: "premium-gh-dashboard:theme",
  locale: "premium-gh-dashboard:locale",
};

const SUPPORTED_LOCALES = ["en", "es"];
const SUPPORTED_SORTS = ["stars", "updated"];

const elements = {
  body: document.body,
  html: document.documentElement,
  skipLink: document.getElementById("skip-link"),
  form: document.getElementById("search-form"),
  input: document.getElementById("username-input"),
  searchButton: document.getElementById("search-button"),
  sortSelect: document.getElementById("sort-select"),
  languageSelect: document.getElementById("language-select"),
  filterInput: document.getElementById("filter-input"),
  clearFiltersButton: document.getElementById("clear-filters-button"),
  showMoreButton: document.getElementById("show-more-button"),
  themeToggle: document.getElementById("theme-toggle"),
  themeLabel: document.querySelector(".theme-toggle__label"),
  localeButtons: Array.from(document.querySelectorAll("[data-locale]")),
  localeGroup: document.querySelector(".toggle-group"),
  heroKicker: document.getElementById("hero-kicker"),
  heroLead: document.getElementById("hero-lead"),
  searchHelper: document.getElementById("search-helper"),
  heroPills: document.getElementById("hero-pills"),
  heroSummaryKicker: document.getElementById("hero-summary-kicker"),
  heroSummaryTitle: document.getElementById("hero-summary-title"),
  heroSummaryGrid: document.getElementById("hero-summary-grid"),
  insightsKicker: document.getElementById("insights-kicker"),
  insightsTitle: document.getElementById("insights-title"),
  highlightsKicker: document.getElementById("highlights-kicker"),
  highlightsTitle: document.getElementById("highlights-title"),
  highlightsCopy: document.getElementById("highlights-copy"),
  repositoriesKicker: document.getElementById("repositories-kicker"),
  repositoriesTitle: document.getElementById("repositories-title"),
  repositoriesCopy: document.getElementById("repositories-copy"),
  sortLabel: document.getElementById("sort-label"),
  languageLabel: document.getElementById("language-label"),
  repoSearchLabel: document.getElementById("repo-search-label"),
  profilePanel: document.getElementById("profile-panel"),
  insightGrid: document.getElementById("insight-grid"),
  highlightState: document.getElementById("highlight-state"),
  highlightGrid: document.getElementById("highlight-grid"),
  repoSummary: document.getElementById("repo-summary"),
  repoState: document.getElementById("repo-state"),
  repoGrid: document.getElementById("repo-grid"),
  announcer: document.getElementById("status-announcer"),
};

// State
const state = {
  username: "",
  profile: null,
  repos: [],
  visibleCount: PAGE_SIZE,
  sortMode: sanitizeSortMode(getStoredValue(STORAGE_KEYS.sortMode, "stars")),
  languageFilter: "all",
  searchTerm: "",
  theme: getStoredValue(STORAGE_KEYS.theme, "dark"),
  locale: sanitizeLocale(getStoredValue(STORAGE_KEYS.locale, "en")),
  loading: false,
  lastError: null,
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
    // Ignore storage failures in restricted browser contexts.
  }
}

function sanitizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : "en";
}

function sanitizeSortMode(value) {
  return SUPPORTED_SORTS.includes(value) ? value : "stars";
}

function isSpanish() {
  return state.locale === "es";
}

function tr(en, es) {
  return isSpanish() ? es : en;
}

function getLocaleCode() {
  return isSpanish() ? "es-ES" : "en-US";
}

function interpolate(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    return values[key] ?? "";
  });
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
  return new Intl.NumberFormat(getLocaleCode(), {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat(getLocaleCode(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat(getLocaleCode(), {
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

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenizeSearch(value) {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function getStaggerClass(index) {
  return `stagger-${(index % 12) + 1}`;
}

function getStoredUsername() {
  return getStoredValue(STORAGE_KEYS.username, DEFAULT_USERNAME).trim() || DEFAULT_USERNAME;
}

function hasActiveFilters() {
  return state.languageFilter !== "all" || Boolean(state.searchTerm.trim());
}

function getUnknownLanguageLabel() {
  return tr("Unknown", "Desconocido");
}

function getLanguageLabel(languageValue) {
  return languageValue === UNKNOWN_LANGUAGE_VALUE ? getUnknownLanguageLabel() : languageValue;
}

function getSortLabel(sortMode) {
  return sortMode === "updated"
    ? tr("Recently updated", "Actualizados recientemente")
    : tr("Most starred", "Mas estrellas");
}

function getThemeName(theme) {
  return theme === "light" ? tr("light mode", "modo claro") : tr("dark mode", "modo oscuro");
}

function getThemeButtonLabel(theme) {
  return theme === "dark" ? tr("Light Mode", "Modo claro") : tr("Dark Mode", "Modo oscuro");
}

function getVisibilityLabel(value) {
  const normalized = String(value || "public").toLowerCase();

  if (normalized === "private") {
    return tr("private", "privado");
  }

  if (normalized === "internal") {
    return tr("internal", "interno");
  }

  return tr("public", "publico");
}

function getAvailableLanguages(repos) {
  const languages = Array.from(new Set(repos.map((repo) => repo.language).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

  if (repos.some((repo) => !repo.language)) {
    languages.push(UNKNOWN_LANGUAGE_VALUE);
  }

  return languages;
}

function getTopLanguages(repos, limit = 3) {
  const counts = repos.reduce((map, repo) => {
    const key = repo.language || UNKNOWN_LANGUAGE_VALUE;
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([language]) => getLanguageLabel(language));
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
    return tr("No activity yet", "Sin actividad");
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

function matchesLanguageFilter(repo) {
  if (state.languageFilter === "all") {
    return true;
  }

  if (state.languageFilter === UNKNOWN_LANGUAGE_VALUE) {
    return !repo.language;
  }

  return repo.language === state.languageFilter;
}

function getRepositorySearchText(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics.join(" ") : "";
  return normalizeText([repo.name, repo.description, repo.language, topics].filter(Boolean).join(" "));
}

function getSearchScore(repo, tokens) {
  if (!tokens.length) {
    return { matched: true, score: 0 };
  }

  const name = normalizeText(repo.name);
  const description = normalizeText(repo.description);
  const language = normalizeText(repo.language);
  const topics = Array.isArray(repo.topics) ? repo.topics.map((topic) => normalizeText(topic)) : [];
  const haystack = getRepositorySearchText(repo);

  if (!tokens.every((token) => haystack.includes(token))) {
    return { matched: false, score: 0 };
  }

  let score = 0;

  tokens.forEach((token) => {
    if (name === token) {
      score += 150;
    } else if (name.startsWith(token)) {
      score += 95;
    } else if (name.includes(token)) {
      score += 55;
    }

    if (description.includes(token)) {
      score += 24;
    }

    if (language === token) {
      score += 28;
    }

    if (topics.some((topic) => topic === token)) {
      score += 24;
    } else if (topics.some((topic) => topic.includes(token))) {
      score += 12;
    }
  });

  if (repo.description) {
    score += 8;
  }

  if (!repo.fork) {
    score += 6;
  }

  return { matched: true, score };
}

function compareRepos(repoA, repoB) {
  if (state.sortMode === "updated") {
    return new Date(repoB.updated_at) - new Date(repoA.updated_at);
  }

  return (
    repoB.stargazers_count - repoA.stargazers_count ||
    repoB.forks_count - repoA.forks_count ||
    new Date(repoB.updated_at) - new Date(repoA.updated_at)
  );
}

function getProcessedRepos() {
  const tokens = tokenizeSearch(state.searchTerm);

  return state.repos
    .filter(matchesLanguageFilter)
    .map((repo) => {
      const search = getSearchScore(repo, tokens);
      return { repo, matched: search.matched, score: search.score };
    })
    .filter((item) => item.matched)
    .sort((left, right) => {
      if (tokens.length && right.score !== left.score) {
        return right.score - left.score;
      }

      return compareRepos(left.repo, right.repo);
    })
    .map((item) => item.repo);
}

function getHighlightScore(repo) {
  const now = Date.now();
  const updatedAt = new Date(repo.updated_at).getTime();
  const daysSinceUpdate = Math.max(0, Math.floor((now - updatedAt) / 86400000));
  const recencyBonus = Math.max(0, 45 - Math.min(daysSinceUpdate, 45));

  return (
    (repo.stargazers_count || 0) * 8 +
    (repo.forks_count || 0) * 3 +
    recencyBonus +
    (repo.description ? 12 : 0) +
    (repo.homepage ? 6 : 0) +
    (!repo.fork ? 8 : 0)
  );
}

function getStrongestRepo(repos) {
  if (!repos.length) {
    return null;
  }

  return [...repos].sort((left, right) => getHighlightScore(right) - getHighlightScore(left))[0];
}

function getHighlightedRepos(repos) {
  const highlighted = [];
  const selectedIds = new Set();

  function pick(slot, reason, comparator) {
    const repo = [...repos].sort(comparator).find((item) => !selectedIds.has(item.id));

    if (!repo) {
      return;
    }

    highlighted.push({ slot, reason, repo });
    selectedIds.add(repo.id);
  }

  pick(
    tr("Top traction", "Mayor traccion"),
    tr("Highest public traction in this selection.", "Mayor traccion publica dentro de esta seleccion."),
    (left, right) =>
      right.stargazers_count - left.stargazers_count ||
      right.forks_count - left.forks_count ||
      new Date(right.updated_at) - new Date(left.updated_at)
  );

  pick(
    tr("Fresh activity", "Actividad fresca"),
    tr(
      "Most recently maintained repository in view.",
      "Repositorio con mantenimiento mas reciente dentro de la vista."
    ),
    (left, right) =>
      new Date(right.updated_at) - new Date(left.updated_at) ||
      getHighlightScore(right) - getHighlightScore(left)
  );

  pick(
    tr("Balanced pick", "Seleccion balanceada"),
    tr("Best blend of adoption, freshness, and presentation.", "Mejor mezcla de adopcion, frescura y presentacion."),
    (left, right) => getHighlightScore(right) - getHighlightScore(left)
  );

  return highlighted;
}

function getRateLimitResetLabel(rateLimitReset) {
  const resetAt = rateLimitReset ? new Date(Number(rateLimitReset) * 1000) : new Date(Date.now() + 3600000);
  return formatDateTime(resetAt);
}

function getErrorContent(error, username) {
  const message = error?.data?.message || error?.message || tr("Unexpected response.", "Respuesta inesperada.");

  if (error?.status === 404) {
    return {
      variant: "warning",
      title: tr("GitHub user not found", "Usuario de GitHub no encontrado"),
      description: interpolate(
        tr(
          "We could not find @{username}. Check the spelling and try again.",
          "No pudimos encontrar a @{username}. Revisa el nombre y vuelve a intentar."
        ),
        { username }
      ),
      detail: interpolate(tr("GitHub message: {message}", "Mensaje de GitHub: {message}"), { message }),
      actions: ["retry-search", "load-default"],
    };
  }

  if (error?.status === 403 && /rate limit/i.test(message)) {
    return {
      variant: "warning",
      title: tr("GitHub rate limit reached", "Se alcanzo el limite de GitHub"),
      description: interpolate(
        tr(
          "Unauthenticated requests are temporarily limited. Try again after {resetAt}.",
          "Las solicitudes sin autenticacion estan limitadas temporalmente. Intenta de nuevo despues de {resetAt}."
        ),
        { resetAt: getRateLimitResetLabel(error.rateLimitReset) }
      ),
      detail: tr(
        "GitHub reported 0 remaining requests for now.",
        "GitHub informo 0 solicitudes restantes por ahora."
      ),
      actions: ["retry-search"],
    };
  }

  if (error instanceof TypeError) {
    return {
      variant: "error",
      title: tr("Network connection issue", "Problema de conexion"),
      description: tr(
        "The dashboard could not reach GitHub. Check the connection and try again.",
        "El panel no pudo conectarse con GitHub. Revisa la conexion e intenta de nuevo."
      ),
      detail: interpolate(tr("GitHub message: {message}", "Mensaje de GitHub: {message}"), { message }),
      actions: ["retry-search"],
    };
  }

  return {
    variant: "error",
    title: tr("Something went wrong", "Algo salio mal"),
    description: tr("GitHub returned an unexpected response.", "GitHub devolvio una respuesta inesperada."),
    detail: interpolate(tr("GitHub message: {message}", "Mensaje de GitHub: {message}"), { message }),
    actions: ["retry-search"],
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
  const reposUrl = `${API_BASE}/${safeUsername}/repos?per_page=100&sort=updated&type=owner`;

  const [profile, repos] = await Promise.all([fetchJSON(profileUrl), fetchJSON(reposUrl)]);

  return {
    profile,
    repos: getShowcaseRepos(repos),
  };
}

// Render helpers
function renderStaticChrome() {
  elements.html.lang = state.locale;
  elements.skipLink.textContent = tr("Skip to dashboard", "Saltar al panel");
  elements.localeGroup.setAttribute("aria-label", tr("Language switcher", "Selector de idioma"));
  elements.form.setAttribute("aria-label", tr("GitHub profile search", "Busqueda de perfil de GitHub"));
  elements.heroPills.setAttribute("aria-label", tr("Dashboard capabilities", "Capacidades del panel"));
  elements.heroKicker.textContent = tr(
    "Recruiter-ready GitHub intelligence",
    "Inteligencia de GitHub lista para portfolio"
  );
  elements.heroLead.textContent = tr(
    "Search a GitHub profile and review standout repositories, stack choices, and recent activity in one polished dashboard.",
    "Busca un perfil de GitHub y revisa repositorios destacados, stack tecnico y actividad reciente en un panel pulido."
  );
  elements.input.placeholder = tr("Search GitHub username", "Buscar usuario de GitHub");
  elements.input.setAttribute("aria-label", tr("GitHub username", "Usuario de GitHub"));
  elements.searchButton.textContent = tr("Explore", "Explorar");
  elements.searchHelper.textContent = tr(
    "Search any public GitHub username. Press Enter to run the lookup.",
    "Busca cualquier usuario publico de GitHub. Presiona Enter para iniciar la consulta."
  );
  elements.heroSummaryKicker.textContent = tr("Product snapshot", "Resumen del producto");
  elements.heroSummaryTitle.textContent = tr("What this view optimizes", "Que optimiza esta vista");
  elements.insightsKicker.textContent = tr("Overview", "Vista general");
  elements.insightsTitle.textContent = tr("Repository Signals", "Senales del repositorio");
  elements.highlightsKicker.textContent = tr("Featured", "Destacados");
  elements.highlightsTitle.textContent = tr("Top Repository Highlights", "Top de repositorios destacados");
  elements.highlightsCopy.textContent = tr(
    "Three standout repositories selected for traction, freshness, and portfolio signal.",
    "Tres repositorios elegidos por traccion, frescura y senal de portfolio."
  );
  elements.repositoriesKicker.textContent = tr("Repository Index", "Indice de repositorios");
  elements.repositoriesTitle.textContent = tr("Repository Explorer", "Explorador de repositorios");
  elements.repositoriesCopy.textContent = tr(
    "Filter by language, search by keyword, and sort the curated repository showcase.",
    "Filtra por lenguaje, busca por palabra clave y ordena el showcase curado."
  );
  elements.sortLabel.textContent = tr("Sort", "Ordenar");
  elements.languageLabel.textContent = tr("Language", "Lenguaje");
  elements.repoSearchLabel.textContent = tr("Repo search", "Busqueda");
  elements.sortSelect.setAttribute("aria-label", tr("Sort repositories", "Ordenar repositorios"));
  elements.languageSelect.setAttribute(
    "aria-label",
    tr("Filter repositories by language", "Filtrar repositorios por lenguaje")
  );
  elements.filterInput.placeholder = tr(
    "Search name, description, or language",
    "Buscar por nombre, descripcion o lenguaje"
  );
  elements.filterInput.setAttribute("aria-label", tr("Search repositories", "Buscar repositorios"));
  elements.clearFiltersButton.textContent = tr("Reset filters", "Restablecer filtros");
  elements.showMoreButton.textContent = tr("Show more repositories", "Mostrar mas repositorios");

  renderHeroSummaryCards();
  renderHeroPills();
  renderSortOptions();
  renderLanguageOptions();
  updateLocaleToggle();
  updateThemeToggle();
}

function renderHeroSummaryCards() {
  const cards = [
    {
      eyebrow: tr("Fast scan", "Lectura rapida"),
      title: tr("Profile first", "Perfil primero"),
      copy: tr(
        "Core profile context, social proof, and repository signal stay visible side by side.",
        "El contexto del perfil, la prueba social y la senal tecnica quedan visibles al mismo tiempo."
      ),
    },
    {
      eyebrow: tr("Curated repos", "Repos curados"),
      title: tr("Fork-light showcase", "Showcase con menos forks"),
      copy: tr(
        "Original work is prioritized automatically so portfolio signal is easier to read.",
        "El trabajo original se prioriza automaticamente para que el portfolio sea mas claro."
      ),
    },
    {
      eyebrow: tr("Practical UX", "UX practica"),
      title: tr("Mobile ready", "Listo para mobile"),
      copy: tr(
        "Search, filters, and highlights stay usable on smaller screens without crowding.",
        "Busqueda, filtros y destacados siguen siendo comodos en pantallas pequenas."
      ),
    },
  ];

  elements.heroSummaryGrid.innerHTML = cards
    .map((card) => {
      return `
        <article class="hero-summary-card">
          <p class="hero-summary-card__eyebrow">${escapeHTML(card.eyebrow)}</p>
          <strong>${escapeHTML(card.title)}</strong>
          <p>${escapeHTML(card.copy)}</p>
        </article>
      `;
    })
    .join("");
}

function renderHeroPills() {
  const username = state.username || getStoredUsername();
  const topLanguage = getTopLanguages(state.repos, 1)[0] || tr("Ready to explore", "Listo para explorar");
  const pills = state.profile
    ? [
        `${tr("Saved search", "Busqueda guardada")}: @${username}`,
        `${tr("Curated repos", "Repos curados")}: ${formatCompactNumber(state.repos.length)}`,
        `${tr("Top stack", "Stack principal")}: ${topLanguage}`,
      ]
    : [
        `${tr("Saved search", "Busqueda guardada")}: @${username}`,
        tr("Fork-light showcase", "Showcase con menos forks"),
        tr("Preferences saved", "Preferencias guardadas"),
      ];

  elements.heroPills.innerHTML = pills
    .map((pill) => `<span class="hero-pill">${escapeHTML(pill)}</span>`)
    .join("");
}

function renderSortOptions() {
  elements.sortSelect.innerHTML = SUPPORTED_SORTS.map((sortMode) => {
    return `<option value="${sortMode}">${escapeHTML(getSortLabel(sortMode))}</option>`;
  }).join("");

  elements.sortSelect.value = state.sortMode;
}

function renderLanguageOptions() {
  const languages = getAvailableLanguages(state.repos);

  if (state.languageFilter !== "all" && !languages.includes(state.languageFilter)) {
    state.languageFilter = "all";
  }

  elements.languageSelect.innerHTML = [
    `<option value="all">${escapeHTML(tr("All languages", "Todos los lenguajes"))}</option>`,
    ...languages.map((language) => {
      return `<option value="${escapeHTML(language)}">${escapeHTML(getLanguageLabel(language))}</option>`;
    }),
  ].join("");

  elements.languageSelect.value = state.languageFilter;
}

function updateLocaleToggle() {
  elements.localeButtons.forEach((button) => {
    const isActive = button.dataset.locale === state.locale;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updateThemeToggle() {
  const label = getThemeButtonLabel(state.theme);
  elements.themeToggle.setAttribute("aria-pressed", String(state.theme === "light"));
  elements.themeToggle.setAttribute("aria-label", label);
  elements.themeLabel.textContent = label;
}

function renderActionButtons(actions = []) {
  const labels = {
    "retry-search": tr("Retry lookup", "Reintentar"),
    "load-default": tr("Load default profile", "Cargar perfil por defecto"),
    "clear-filters": tr("Clear filters", "Limpiar filtros"),
  };

  if (!actions.length) {
    return "";
  }

  return `
    <div class="state-card__actions">
      ${actions
        .map((action) => {
          return `
            <button class="ghost-button" type="button" data-dashboard-action="${escapeHTML(action)}">
              ${escapeHTML(labels[action])}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderStateCard({ title, description, detail = "", variant = "default", actions = [] }) {
  const variantClass =
    variant === "error" ? "state-card--error" : variant === "warning" ? "state-card--warning" : "";

  return `
    <div class="state-card ${variantClass}">
      <div class="state-card__icon">${getIcon(variant === "default" ? "spark" : "alert")}</div>
      <div>
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(description)}</p>
        ${detail ? `<p class="state-card__detail">${escapeHTML(detail)}</p>` : ""}
      </div>
      ${renderActionButtons(actions)}
    </div>
  `;
}

function setLoadingState(isLoading) {
  state.loading = isLoading;
  elements.profilePanel.setAttribute("aria-busy", String(isLoading));
  elements.input.disabled = isLoading;
  elements.searchButton.disabled = isLoading;
  elements.sortSelect.disabled = isLoading;
  elements.languageSelect.disabled = isLoading;
  elements.filterInput.disabled = isLoading;
  elements.clearFiltersButton.disabled = isLoading;
  elements.showMoreButton.disabled = isLoading;
}

function setTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  elements.body.setAttribute("data-theme", state.theme);
  setStoredValue(STORAGE_KEYS.theme, state.theme);
  updateThemeToggle();
}

function setLocale(locale) {
  const nextLocale = sanitizeLocale(locale);

  if (state.locale === nextLocale) {
    return;
  }

  state.locale = nextLocale;
  setStoredValue(STORAGE_KEYS.locale, state.locale);

  if (state.loading) {
    renderLoadingState();
  } else if (state.profile) {
    renderDashboard();
  } else if (state.lastError) {
    renderErrorState(state.lastError, state.username || getStoredUsername());
  } else {
    renderStaticChrome();
  }

  announce(tr("Language switched to English.", "Idioma cambiado a Espanol."));
}

function clearRepoFilters() {
  state.languageFilter = "all";
  state.searchTerm = "";
  state.visibleCount = PAGE_SIZE;
  elements.languageSelect.value = "all";
  elements.filterInput.value = "";

  if (state.profile) {
    const processedRepos = getProcessedRepos();
    renderHighlights(processedRepos);
    renderRepositories(processedRepos);
  }

  announce(tr("Repository filters reset.", "Los filtros de repositorio fueron restablecidos."));
}

function renderLoadingState() {
  setLoadingState(true);
  renderStaticChrome();

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

  elements.insightGrid.innerHTML = Array.from({ length: 4 }, () => {
    return `
      <article class="insight-card">
        <div class="skeleton skeleton-line skeleton-line--sm"></div>
        <div class="skeleton skeleton-line skeleton-line--md space-top-md"></div>
        <div class="skeleton skeleton-line skeleton-line--lg space-top-md"></div>
      </article>
    `;
  }).join("");

  elements.highlightState.innerHTML = renderStateCard({
    title: tr("Selecting highlighted repositories", "Seleccionando repos destacados"),
    description: tr(
      "Scoring the strongest repositories by traction, freshness, and presentation quality.",
      "Puntuando los repositorios mas fuertes por traccion, frescura y presentacion."
    ),
  });

  elements.highlightGrid.innerHTML = Array.from({ length: 3 }, (_, index) => {
    return `
      <li class="skeleton-highlight ${getStaggerClass(index)}">
        <div class="skeleton skeleton-line skeleton-line--sm"></div>
        <div class="skeleton skeleton-line skeleton-line--md space-top-lg"></div>
        <div class="skeleton skeleton-line skeleton-line--lg space-top-md"></div>
        <div class="skeleton skeleton-line skeleton-line--sm space-top-xl"></div>
      </li>
    `;
  }).join("");

  elements.repoSummary.textContent = tr(
    "Fetching profile data, featured repositories, and repository insights.",
    "Cargando perfil, repositorios destacados e insights del repositorio."
  );
  elements.repoState.innerHTML = renderStateCard({
    title: tr("Gathering GitHub signals", "Reuniendo senales de GitHub"),
    description: tr(
      "Fetching profile data, featured repositories, and repository insights.",
      "Cargando perfil, repositorios destacados e insights del repositorio."
    ),
  });

  elements.repoGrid.innerHTML = Array.from({ length: 6 }, (_, index) => {
    return `
      <li class="skeleton-repo ${getStaggerClass(index)}">
        <div class="skeleton skeleton-line skeleton-line--md"></div>
        <div class="skeleton skeleton-line skeleton-line--lg space-top-lg"></div>
        <div class="skeleton skeleton-line skeleton-line--md space-top-md"></div>
        <div class="skeleton skeleton-line skeleton-line--sm space-top-xl"></div>
        <div class="skeleton skeleton-line skeleton-line--lg space-top-xl"></div>
      </li>
    `;
  }).join("");

  elements.clearFiltersButton.hidden = true;
  elements.showMoreButton.hidden = true;
}

function renderProfile(profile) {
  const blogUrl = sanitizeUrl(profile.blog);
  const websiteMarkup = blogUrl
    ? `<a href="${escapeHTML(blogUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(displayUrl(blogUrl))}</a>`
    : `<span class="muted">${escapeHTML(tr("No website listed", "Sin sitio web"))}</span>`;

  elements.profilePanel.innerHTML = `
    <article class="profile-card">
      <div class="profile-card__top">
        <div class="profile-card__head">
          <div class="profile-avatar-wrap">
            <img src="${escapeHTML(profile.avatar_url)}" alt="${escapeHTML(profile.login)} avatar">
          </div>

          <div class="profile-card__identity">
            <span class="status-pill">${getIcon("spark")} ${escapeHTML(tr("Live GitHub profile", "Perfil activo de GitHub"))}</span>
            <h2 class="profile-name">${escapeHTML(profile.name || profile.login)}</h2>
            <p class="profile-username">@${escapeHTML(profile.login)}</p>
          </div>
        </div>

        <p class="profile-bio">${escapeHTML(profile.bio || tr("No bio provided.", "Sin bio publicada."))}</p>
      </div>

      <div class="profile-stats">
        <article class="stat-card">
          <span class="stat-card__label">${escapeHTML(tr("Followers", "Seguidores"))}</span>
          <strong>${formatCompactNumber(profile.followers)}</strong>
        </article>

        <article class="stat-card">
          <span class="stat-card__label">${escapeHTML(tr("Following", "Siguiendo"))}</span>
          <strong>${formatCompactNumber(profile.following)}</strong>
        </article>

        <article class="stat-card">
          <span class="stat-card__label">${escapeHTML(tr("Public repos", "Repos publicos"))}</span>
          <strong>${formatCompactNumber(profile.public_repos)}</strong>
        </article>
      </div>

      <div class="meta-list">
        <div class="meta-row">
          ${getIcon("location")}
          <div>
            <span class="meta-label">${escapeHTML(tr("Location", "Ubicacion"))}</span>
            <p class="meta-value">${escapeHTML(profile.location || tr("Location not shared", "Ubicacion no compartida"))}</p>
          </div>
        </div>

        <div class="meta-row">
          ${getIcon("company")}
          <div>
            <span class="meta-label">${escapeHTML(tr("Company", "Empresa"))}</span>
            <p class="meta-value">${escapeHTML(profile.company || tr("Independent / not listed", "Independiente / no indicado"))}</p>
          </div>
        </div>

        <div class="meta-row">
          ${getIcon("link")}
          <div>
            <span class="meta-label">${escapeHTML(tr("Website", "Sitio web"))}</span>
            <p class="meta-value">${websiteMarkup}</p>
          </div>
        </div>

        <div class="meta-row">
          ${getIcon("calendar")}
          <div>
            <span class="meta-label">${escapeHTML(tr("Joined GitHub", "En GitHub desde"))}</span>
            <p class="meta-value">${escapeHTML(formatDate(profile.created_at))}</p>
          </div>
        </div>
      </div>

      <div class="profile-actions">
        <a class="primary-button" href="${escapeHTML(profile.html_url)}" target="_blank" rel="noopener noreferrer">
          <span class="button-icon">${getIcon("arrow")}</span>
          ${escapeHTML(tr("Open GitHub profile", "Abrir perfil de GitHub"))}
        </a>

        <button class="secondary-button" type="button" data-copy-profile-url="${escapeHTML(profile.html_url)}">
          <span class="button-icon">${getIcon("copy")}</span>
          ${escapeHTML(tr("Copy profile URL", "Copiar URL del perfil"))}
        </button>
      </div>
    </article>
  `;
}

function renderInsights(profile, repos) {
  if (!profile) {
    elements.insightGrid.innerHTML = renderStateCard({
      title: tr("Insights unavailable", "Senales no disponibles"),
      description: tr(
        "Search for a GitHub profile to see language, activity, and portfolio signals.",
        "Busca un perfil de GitHub para ver lenguajes, actividad y senal de portfolio."
      ),
    });
    return;
  }

  const totals = getRepoTotals(repos);
  const topLanguages = getTopLanguages(repos);
  const strongestRepo = getStrongestRepo(repos);

  const cards = [
    {
      label: tr("Top languages", "Lenguajes top"),
      value: topLanguages.length ? topLanguages.join(" / ") : tr("No language data", "Sin datos de lenguaje"),
      description: tr(
        "Most common languages across the curated repository set.",
        "Lenguajes mas frecuentes dentro del set de repos curado."
      ),
    },
    {
      label: tr("Total stars", "Estrellas totales"),
      value: formatCompactNumber(totals.stars),
      description: tr(
        "Combined stars across the curated repositories in view.",
        "Suma de estrellas en los repositorios curados visibles."
      ),
    },
    {
      label: tr("Recent activity", "Actividad reciente"),
      value: getMostRecentUpdate(repos),
      description: tr(
        "Latest update across the current showcase repositories.",
        "Ultima actualizacion entre los repositorios del showcase actual."
      ),
    },
    {
      label: tr("Strongest repo", "Repo mas fuerte"),
      value: strongestRepo ? strongestRepo.name : tr("No highlight yet", "Sin destacado"),
      description: tr(
        "Best repository signal when stars, freshness, and completeness are combined.",
        "Mejor senal del repositorio al combinar estrellas, frescura y completitud."
      ),
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

function renderHighlights(processedRepos) {
  if (!state.repos.length) {
    elements.highlightState.innerHTML = renderStateCard({
      title: tr("No highlighted repositories yet", "Todavia no hay repos destacados"),
      description: tr(
        "Highlighted repositories will appear after a successful GitHub lookup.",
        "Los repositorios destacados apareceran despues de una consulta exitosa."
      ),
      variant: "warning",
    });
    elements.highlightGrid.innerHTML = "";
    return;
  }

  if (!processedRepos.length) {
    elements.highlightState.innerHTML = renderStateCard({
      title: tr("No featured repos for the current filters", "No hay destacados para los filtros actuales"),
      description: tr(
        "Try a broader keyword or clear the active language filter.",
        "Prueba una busqueda mas amplia o limpia el filtro de lenguaje."
      ),
      variant: "warning",
      actions: ["clear-filters"],
    });
    elements.highlightGrid.innerHTML = "";
    return;
  }

  const highlighted = getHighlightedRepos(processedRepos);
  const summaryPills = [
    interpolate(
      tr(
        "{count} featured repositories selected from the current result set.",
        "{count} repositorios destacados seleccionados del conjunto actual."
      ),
      { count: highlighted.length }
    ),
    interpolate(
      tr("Top stack: {value}", "Stack principal: {value}"),
      { value: getTopLanguages(processedRepos, 1)[0] || tr("Mixed repository stack", "Stack mixto de repositorios") }
    ),
  ];

  elements.highlightState.innerHTML = `
    <div class="repo-insights-bar">
      ${summaryPills.map((pill) => `<span class="subtle-pill">${escapeHTML(pill)}</span>`).join("")}
    </div>
  `;

  elements.highlightGrid.innerHTML = highlighted
    .map((item, index) => {
      const repo = item.repo;
      const description = repo.description || tr("No description provided.", "Sin descripcion publicada.");
      const language = repo.language || getUnknownLanguageLabel();

      return `
        <li class="highlight-card ${getStaggerClass(index)}">
          <div class="highlight-card__head">
            <div>
              <p class="highlight-card__eyebrow">${escapeHTML(item.slot)}</p>
              <h3 class="highlight-card__title">
                <a href="${escapeHTML(repo.html_url)}" target="_blank" rel="noopener noreferrer">
                  ${escapeHTML(repo.name)}
                </a>
              </h3>
            </div>
            <span class="badge badge--muted">${escapeHTML(getVisibilityLabel(repo.visibility))}</span>
          </div>

          <p class="highlight-card__description">${escapeHTML(description)}</p>

          <div class="highlight-card__badges">
            <span class="badge badge--language">${escapeHTML(language)}</span>
            <span class="badge badge--muted">${escapeHTML(repo.fork ? "Fork" : tr("Original", "Original"))}</span>
          </div>

          <div class="highlight-card__metrics">
            <span class="highlight-card__metric">${getIcon("star")} ${formatCompactNumber(repo.stargazers_count)}</span>
            <span class="highlight-card__metric">${getIcon("fork")} ${formatCompactNumber(repo.forks_count)}</span>
          </div>

          <div class="highlight-card__footer">
            <span class="highlight-card__reason">${escapeHTML(item.reason)}</span>
            <a class="repo-link" href="${escapeHTML(repo.html_url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHTML(tr("Open repo", "Abrir repo"))}
              <span class="button-icon">${getIcon("arrow")}</span>
            </a>
          </div>
        </li>
      `;
    })
    .join("");
}

function renderRepositories(processedRepos) {
  const visibleRepos = processedRepos.slice(0, state.visibleCount);
  const totalRepos = state.repos.length;
  const totals = getRepoTotals(processedRepos);
  const topLanguages = getTopLanguages(processedRepos);
  const pills = [
    interpolate(tr("{value} total stars", "{value} estrellas totales"), { value: formatCompactNumber(totals.stars) }),
    interpolate(tr("{value} total forks", "{value} forks totales"), { value: formatCompactNumber(totals.forks) }),
    topLanguages.length
      ? interpolate(tr("Top stack: {value}", "Stack principal: {value}"), { value: topLanguages.join(" / ") })
      : tr("Mixed repository stack", "Stack mixto de repositorios"),
    state.sortMode === "stars"
      ? tr("Sorted by popularity", "Ordenado por popularidad")
      : tr("Sorted by recent activity", "Ordenado por actividad reciente"),
  ];

  if (state.languageFilter !== "all") {
    pills.push(
      interpolate(tr("Language: {value}", "Lenguaje: {value}"), {
        value: getLanguageLabel(state.languageFilter),
      })
    );
  }

  if (state.searchTerm.trim()) {
    pills.push(tr("Search ranked by relevance", "Busqueda ordenada por relevancia"));
  }

  elements.clearFiltersButton.hidden = !hasActiveFilters();

  if (!totalRepos) {
    elements.repoSummary.textContent = tr(
      "This profile has no public repositories available to showcase yet.",
      "Este perfil no tiene repositorios publicos para mostrar por ahora."
    );
    elements.repoState.innerHTML = renderStateCard({
      title: tr("No repositories found", "No se encontraron repositorios"),
      description: tr(
        "There are no public repositories to display for this profile right now.",
        "No hay repositorios publicos para mostrar en este perfil en este momento."
      ),
      variant: "warning",
    });
    elements.repoGrid.innerHTML = "";
    elements.showMoreButton.hidden = true;
    return;
  }

  if (!processedRepos.length) {
    elements.repoSummary.textContent = tr(
      "Try a broader search or reset the active filters.",
      "Prueba una busqueda mas amplia o restablece los filtros activos."
    );
    elements.repoState.innerHTML = renderStateCard({
      title: tr("No matching repositories", "No hay repositorios coincidentes"),
      description: tr(
        "Try a broader search or reset the active filters.",
        "Prueba una busqueda mas amplia o restablece los filtros activos."
      ),
      variant: "warning",
      actions: ["clear-filters"],
    });
    elements.repoGrid.innerHTML = "";
    elements.showMoreButton.hidden = true;
    return;
  }

  elements.repoSummary.textContent = interpolate(
    hasActiveFilters()
      ? tr(
          "Showing {shown} of {total} matching repositories for @{username}.",
          "Mostrando {shown} de {total} repositorios coincidentes para @{username}."
        )
      : tr(
          "Showing {shown} of {total} curated repositories for @{username}.",
          "Mostrando {shown} de {total} repositorios curados para @{username}."
        ),
    {
      shown: visibleRepos.length,
      total: processedRepos.length,
      username: state.username,
    }
  );

  elements.repoState.innerHTML = `
    <div class="repo-insights-bar">
      ${pills.map((pill) => `<span class="subtle-pill">${escapeHTML(pill)}</span>`).join("")}
    </div>
  `;

  elements.repoGrid.innerHTML = visibleRepos
    .map((repo, index) => {
      const description = repo.description || tr("No description provided.", "Sin descripcion publicada.");
      const language = repo.language || getUnknownLanguageLabel();

      return `
        <li class="repo-card ${getStaggerClass(index)}">
          <div class="repo-card__header">
            <div>
              <h3 class="repo-card__title">
                <a href="${escapeHTML(repo.html_url)}" target="_blank" rel="noopener noreferrer">
                  ${escapeHTML(repo.name)}
                </a>
              </h3>
            </div>
            <span class="badge badge--muted">${escapeHTML(getVisibilityLabel(repo.visibility))}</span>
          </div>

          <p class="repo-card__description">${escapeHTML(description)}</p>

          <div class="repo-card__badges">
            <span class="badge badge--language">${escapeHTML(language)}</span>
            <span class="badge badge--muted">${escapeHTML(repo.fork ? "Fork" : tr("Original", "Original"))}</span>
          </div>

          <div class="repo-card__meta">
            <span class="repo-stat">${getIcon("star")} ${formatCompactNumber(repo.stargazers_count)}</span>
            <span class="repo-stat">${getIcon("fork")} ${formatCompactNumber(repo.forks_count)}</span>
          </div>

          <div class="repo-card__footer">
            <span class="repo-card__updated">${escapeHTML(interpolate(tr("Updated {date}", "Actualizado {date}"), { date: formatDate(repo.updated_at) }))}</span>
            <a class="repo-link" href="${escapeHTML(repo.html_url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHTML(tr("Open repo", "Abrir repo"))}
              <span class="button-icon">${getIcon("arrow")}</span>
            </a>
          </div>
        </li>
      `;
    })
    .join("");

  elements.showMoreButton.hidden = processedRepos.length <= visibleRepos.length;
}

function renderErrorState(error, username) {
  const content = getErrorContent(error, username);

  renderStaticChrome();

  elements.profilePanel.innerHTML = renderStateCard(content);
  elements.insightGrid.innerHTML = renderStateCard({
    title: tr("Signals unavailable", "Senales no disponibles"),
    description: tr(
      "Insights and repository sections will repopulate after a successful lookup.",
      "Las secciones de insights y repositorios volveran despues de una consulta exitosa."
    ),
    variant: content.variant,
  });
  elements.highlightState.innerHTML = renderStateCard(content);
  elements.highlightGrid.innerHTML = "";
  elements.repoSummary.textContent = content.description;
  elements.repoState.innerHTML = renderStateCard(content);
  elements.repoGrid.innerHTML = "";
  elements.clearFiltersButton.hidden = true;
  elements.showMoreButton.hidden = true;
  setLoadingState(false);
}

function renderDashboard() {
  renderStaticChrome();
  renderProfile(state.profile);
  renderInsights(state.profile, state.repos);

  const processedRepos = getProcessedRepos();
  renderHighlights(processedRepos);
  renderRepositories(processedRepos);

  setLoadingState(false);
}

// Main data loader
async function loadDashboard(username) {
  const normalizedUsername = username.trim();

  if (!normalizedUsername) {
    announce(tr("Enter a GitHub username to begin.", "Ingresa un usuario de GitHub para comenzar."));
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
    state.searchTerm = "";
    state.languageFilter = "all";
    state.lastError = null;

    elements.input.value = profile.login;
    elements.filterInput.value = "";
    setStoredValue(STORAGE_KEYS.username, profile.login);

    renderDashboard();
    announce(
      interpolate(
        tr(
          "Loaded {username} with {count} curated repositories.",
          "Se cargo {username} con {count} repositorios curados."
        ),
        { username: profile.login, count: repos.length }
      )
    );
  } catch (error) {
    state.username = normalizedUsername;
    state.profile = null;
    state.repos = [];
    state.visibleCount = PAGE_SIZE;
    state.searchTerm = "";
    state.languageFilter = "all";
    state.lastError = error;

    renderErrorState(error, normalizedUsername);
    announce(
      interpolate(
        tr("Unable to load data for {username}.", "No se pudo cargar la informacion de {username}."),
        { username: normalizedUsername }
      )
    );
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

    button.innerHTML = `${getIcon("spark")} ${escapeHTML(tr("Copied", "Copiado"))}`;
    announce(tr("GitHub profile URL copied to clipboard.", "La URL del perfil de GitHub fue copiada."));

    window.setTimeout(() => {
      button.innerHTML = originalMarkup;
    }, 1600);
  } catch (error) {
    announce(
      tr(
        "Copy failed. You can open the profile and copy the URL manually.",
        "No se pudo copiar. Puedes abrir el perfil y copiar la URL manualmente."
      )
    );
  }
}

function handleDashboardAction(action) {
  switch (action) {
    case "retry-search":
      loadDashboard(elements.input.value || state.username || DEFAULT_USERNAME);
      break;
    case "load-default":
      loadDashboard(DEFAULT_USERNAME);
      break;
    case "clear-filters":
      clearRepoFilters();
      break;
    default:
      break;
  }
}

// Event listeners
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadDashboard(elements.input.value);
});

elements.sortSelect.addEventListener("change", () => {
  state.sortMode = sanitizeSortMode(elements.sortSelect.value);
  state.visibleCount = PAGE_SIZE;
  setStoredValue(STORAGE_KEYS.sortMode, state.sortMode);

  if (state.profile) {
    const processedRepos = getProcessedRepos();
    renderHighlights(processedRepos);
    renderRepositories(processedRepos);
    announce(
      state.sortMode === "stars"
        ? tr("Repositories sorted by most starred.", "Repositorios ordenados por mas estrellas.")
        : tr("Repositories sorted by recently updated.", "Repositorios ordenados por actividad reciente.")
    );
  }
});

elements.languageSelect.addEventListener("change", () => {
  state.languageFilter = elements.languageSelect.value;
  state.visibleCount = PAGE_SIZE;

  if (state.profile) {
    const processedRepos = getProcessedRepos();
    renderHighlights(processedRepos);
    renderRepositories(processedRepos);
    announce(
      interpolate(tr("Language filter updated to {value}.", "Filtro de lenguaje actualizado a {value}."), {
        value:
          state.languageFilter === "all"
            ? tr("All languages", "Todos los lenguajes")
            : getLanguageLabel(state.languageFilter),
      })
    );
  }
});

elements.filterInput.addEventListener("input", (event) => {
  state.searchTerm = event.target.value;
  state.visibleCount = PAGE_SIZE;

  if (state.profile) {
    const processedRepos = getProcessedRepos();
    renderHighlights(processedRepos);
    renderRepositories(processedRepos);
  }
});

elements.clearFiltersButton.addEventListener("click", () => {
  clearRepoFilters();
});

elements.showMoreButton.addEventListener("click", () => {
  state.visibleCount += PAGE_SIZE;
  renderRepositories(getProcessedRepos());
  announce(
    interpolate(tr("Showing {count} repositories.", "Mostrando {count} repositorios."), {
      count: Math.min(state.visibleCount, getProcessedRepos().length),
    })
  );
});

elements.themeToggle.addEventListener("click", () => {
  setTheme(state.theme === "dark" ? "light" : "dark");
  announce(
    interpolate(tr("Theme updated to {theme}.", "Tema actualizado a {theme}."), {
      theme: getThemeName(state.theme),
    })
  );
});

document.addEventListener("click", (event) => {
  const localeButton = event.target.closest("[data-locale]");

  if (localeButton) {
    setLocale(localeButton.dataset.locale);
    return;
  }

  const copyButton = event.target.closest("[data-copy-profile-url]");

  if (copyButton) {
    copyProfileUrl(copyButton.getAttribute("data-copy-profile-url"), copyButton);
    return;
  }

  const actionButton = event.target.closest("[data-dashboard-action]");

  if (actionButton) {
    handleDashboardAction(actionButton.dataset.dashboardAction);
  }
});

// Initialization
function initialize() {
  state.theme = state.theme === "light" ? "light" : "dark";
  state.locale = sanitizeLocale(state.locale);

  setTheme(state.theme);
  renderStaticChrome();

  const storedUsername = getStoredUsername();
  elements.input.value = storedUsername;

  loadDashboard(storedUsername);
}

initialize();
