$(function() {
    $('a.page-scroll').bind('click', function(event) {
        var $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top
        }, 1500, 'easeInOutExpo');
        event.preventDefault();
    });
});

$(function() {
    var $searchInput = $('.js-knowledge-search');
    if (!$searchInput.length) {
        return;
    }

    var $searchCount = $('.js-search-count');
    var $searchEmpty = $('.js-search-empty');
    var $searchError = $('.js-search-error');
    var $searchPanel = $('.js-search-panel');
    var $searchResultsList = $('.js-search-results-list');
    var $searchFilters = $('.js-search-filter');

    var baseUrl = 'https://systemhalted.in';
    var substackDocsUrl = 'js/substack-docs.js';
    var systemSourceLabel = 'System Halted';
    var substackSourceLabel = 'Substack';
    var substackBaseUrl = 'https://palakmathur.substack.com';
    var indexReady = false;
    var indexPromise = null;
    var siteIndex = null;
    var siteDocs = [];
    var docsById = {};
    var indexLoadedAt = 0;
    var substackReady = false;
    var substackPromise = null;
    var substackIndex = null;
    var substackDocs = [];
    var substackDocsById = {};
    var substackLoadedAt = 0;
    var lastQuery = '';
    var lastFilter = 'all';
    var debounceTimer = null;
    var maxResults = 12;
    var maxLoadAttempts = 3;
    var retryDelayMs = 800;
    var maxIndexAgeMs = 15 * 60 * 1000;

    var normalizeText = function(value) {
        return (value || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
    };

    var getActiveFilter = function() {
        var $active = $searchFilters.filter(':checked');
        if (!$active.length) {
            return 'all';
        }
        var value = normalizeText($active.val());
        if (value === 'system' || value === 'substack' || value === 'all') {
            return value;
        }
        return 'all';
    };

    var loadScript = function(src) {
        var deferred = $.Deferred();
        var script = document.createElement('script');
        script.async = true;
        script.src = src;
        script.onload = function() {
            deferred.resolve();
        };
        script.onerror = function() {
            deferred.reject();
        };
        document.head.appendChild(script);
        return deferred.promise();
    };

    var setLoadingMessage = function(message) {
        $searchCount.text(message).removeClass('is-hidden');
    };

    var isIndexStale = function() {
        if (!indexLoadedAt) {
            return false;
        }
        return (Date.now() - indexLoadedAt) > maxIndexAgeMs;
    };

    var resetIndex = function() {
        indexReady = false;
        indexPromise = null;
        siteIndex = null;
        siteDocs = [];
        docsById = {};
        indexLoadedAt = 0;
    };

    var isSubstackIndexStale = function() {
        if (!substackLoadedAt) {
            return false;
        }
        return (Date.now() - substackLoadedAt) > maxIndexAgeMs;
    };

    var resetSubstackIndex = function() {
        substackReady = false;
        substackPromise = null;
        substackIndex = null;
        substackDocs = [];
        substackDocsById = {};
        substackLoadedAt = 0;
    };

    var buildSubstackIndex = function(docs) {
        var index = window.elasticlunr(function() {
            this.setRef('id');
            this.addField('title');
            this.addField('content');
        });
        $.each(docs, function(entryIndex, doc) {
            if (doc && doc.id) {
                index.addDoc(doc);
            }
        });
        return index;
    };

    var resolveIndex = function() {
        if (indexReady && siteIndex && siteDocs.length) {
            if (isIndexStale()) {
                resetIndex();
            } else {
                return $.Deferred().resolve().promise();
            }
        }
        if (indexPromise) {
            return indexPromise;
        }

        var deferred = $.Deferred();
        indexPromise = deferred.promise();

        if (typeof window.elasticlunr === 'undefined') {
            deferred.reject();
            return indexPromise;
        }

        var attemptLoad = function() {};

        var handleFailure = function(attempt) {
            if (attempt < maxLoadAttempts) {
                var nextAttempt = attempt + 1;
                setLoadingMessage('Retrying to load the ' + systemSourceLabel + ' index (' + nextAttempt + ' of ' + maxLoadAttempts + ')...');
                setTimeout(function() {
                    attemptLoad(nextAttempt);
                }, retryDelayMs * attempt);
                return;
            }
            indexPromise = null;
            deferred.reject();
        };

        var finalizeIndex = function(attempt) {
            try {
                if (typeof window.ensureSiteIndex === 'function') {
                    window.ensureSiteIndex();
                }
                siteIndex = window.siteIndex;
                siteDocs = window.siteStore || window.siteDocs || [];
                if (!siteIndex || !siteDocs.length) {
                    throw new Error('index missing');
                }
                docsById = {};
                $.each(siteDocs, function(index, doc) {
                    if (doc && doc.id !== null && doc.id !== undefined) {
                        docsById[String(doc.id)] = doc;
                    }
                });
                indexReady = true;
                indexLoadedAt = Date.now();
                deferred.resolve();
            } catch (err) {
                handleFailure(attempt);
            }
        };

        attemptLoad = function(attempt) {
            var cacheBuster = '?retry=' + attempt + '-' + Date.now();
            loadScript(baseUrl + '/assets/js/webcmd.js' + cacheBuster)
                .done(function() {
                    finalizeIndex(attempt);
                })
                .fail(function() {
                    handleFailure(attempt);
                });
        };

        if (window.siteDocs && window.siteDocs.length) {
            finalizeIndex(1);
            return indexPromise;
        }

        attemptLoad(1);

        return indexPromise;
    };

    var resolveSubstackIndex = function() {
        if (substackReady && substackIndex && substackDocs.length) {
            if (isSubstackIndexStale()) {
                resetSubstackIndex();
            } else {
                return $.Deferred().resolve().promise();
            }
        }
        if (substackPromise) {
            return substackPromise;
        }

        var deferred = $.Deferred();
        substackPromise = deferred.promise();

        if (typeof window.elasticlunr === 'undefined') {
            deferred.reject();
            return substackPromise;
        }

        var attemptLoad = function() {};

        var handleFailure = function(attempt) {
            if (attempt < maxLoadAttempts) {
                var nextAttempt = attempt + 1;
                setLoadingMessage('Retrying to load the ' + substackSourceLabel + ' feed (' + nextAttempt + ' of ' + maxLoadAttempts + ')...');
                setTimeout(function() {
                    attemptLoad(nextAttempt);
                }, retryDelayMs * attempt);
                return;
            }
            substackPromise = null;
            deferred.reject();
        };

        var finalizeSubstack = function(attempt) {
            try {
                substackDocs = window.substackDocs || [];
                if (!substackDocs.length) {
                    throw new Error('substack docs missing');
                }
                substackDocsById = {};
                $.each(substackDocs, function(index, doc) {
                    if (doc && doc.id !== null && doc.id !== undefined) {
                        substackDocsById[String(doc.id)] = doc;
                    }
                });
                substackIndex = buildSubstackIndex(substackDocs);
                substackReady = true;
                substackLoadedAt = Date.now();
                deferred.resolve();
            } catch (err) {
                handleFailure(attempt);
            }
        };

        attemptLoad = function(attempt) {
            var cacheBuster = '?retry=' + attempt + '-' + Date.now();
            loadScript(substackDocsUrl + cacheBuster)
                .done(function() {
                    finalizeSubstack(attempt);
                })
                .fail(function() {
                    handleFailure(attempt);
                });
        };

        if (window.substackDocs && window.substackDocs.length) {
            finalizeSubstack(1);
            return substackPromise;
        }

        attemptLoad(1);

        return substackPromise;
    };

    var normalizeLink = function(link, base) {
        if (!link) {
            return '';
        }
        if (link.indexOf('http://') === 0 || link.indexOf('https://') === 0) {
            return link;
        }
        if (link.charAt(0) !== '/') {
            link = '/' + link;
        }
        return (base || baseUrl) + link;
    };

    var formatDisplayLink = function(link) {
        if (!link) {
            return '';
        }
        return link.replace(/^https?:\/\//, '');
    };

    var isSearchable = function(doc) {
        if (!doc) {
            return false;
        }
        if (!doc.title || !doc.link) {
            return false;
        }
        return true;
    };

    var extractSnippet = function(doc) {
        if (!doc) {
            return '';
        }
        if (doc.snippet) {
            return doc.snippet;
        }
        if (!doc.content) {
            return '';
        }
        var text = doc.content.replace(/<[^>]*>/g, ' ');
        text = text.replace(/\s+/g, ' ').trim();
        if (text.length > 180) {
            text = text.substring(0, 180) + '...';
        }
        return text;
    };

    var resolveDoc = function(ref, docsByIdLookup, docsList) {
        var doc = docsByIdLookup[String(ref)] || docsList[ref];
        if (!doc && docsList.length) {
            doc = docsList.filter(function(item) {
                return item && String(item.id) === String(ref);
            })[0];
        }
        return doc || null;
    };

    var buildResults = function(rawResults, docsByIdLookup, docsList, sourceLabel, sourceBase) {
        var mapped = [];
        var i;
        for (i = 0; i < rawResults.length; i++) {
            var result = rawResults[i];
            var doc = resolveDoc(result.ref, docsByIdLookup, docsList);
            if (!doc || !isSearchable(doc)) {
                continue;
            }
            mapped.push({
                doc: doc,
                score: result.score,
                sourceLabel: sourceLabel,
                sourceBase: sourceBase
            });
        }
        return mapped;
    };

    var buildCombinedResults = function(query, wantsSystem, wantsSubstack) {
        var combined = [];
        if (wantsSystem && indexReady && siteIndex) {
            combined = combined.concat(buildResults(siteIndex.search(query, { expand: true }), docsById, siteDocs, systemSourceLabel, baseUrl));
        }
        if (wantsSubstack && substackReady && substackIndex) {
            combined = combined.concat(buildResults(substackIndex.search(query, { expand: true }), substackDocsById, substackDocs, substackSourceLabel, substackBaseUrl));
        }
        combined.sort(function(a, b) {
            return b.score - a.score;
        });
        return combined;
    };

    var buildSourceLabel = function(items) {
        var labels = [];
        var i;
        var sources = {};
        for (i = 0; i < items.length; i++) {
            var label = (typeof items[i] === 'string') ? items[i] : items[i].sourceLabel;
            if (label) {
                sources[label] = true;
            }
        }
        if (sources[systemSourceLabel]) {
            labels.push(systemSourceLabel);
        }
        if (sources[substackSourceLabel]) {
            labels.push(substackSourceLabel);
        }
        if (!labels.length) {
            return 'the archive';
        }
        if (labels.length === 2) {
            return labels[0] + ' and ' + labels[1];
        }
        return labels[0];
    };

    var buildPendingLabel = function(pending) {
        var hasSystem = pending.indexOf(systemSourceLabel) !== -1;
        var hasSubstack = pending.indexOf(substackSourceLabel) !== -1;
        if (hasSystem && hasSubstack) {
            return systemSourceLabel + ' index and ' + substackSourceLabel + ' feed';
        }
        if (hasSubstack) {
            return substackSourceLabel + ' feed';
        }
        if (hasSystem) {
            return systemSourceLabel + ' index';
        }
        return 'archive sources';
    };

    var renderResults = function(results, pendingSources) {
        var i;
        var filtered = results || [];
        var pending = pendingSources || [];
        $searchResultsList.empty();

        if (!filtered.length) {
            if (pending.length) {
                $searchCount.text('Loading the ' + buildPendingLabel(pending) + '...');
                $searchEmpty.addClass('is-hidden');
                $searchPanel.addClass('is-hidden');
                return;
            }
            $searchCount.text('No matches found.');
            $searchEmpty.removeClass('is-hidden');
            $searchPanel.addClass('is-hidden');
            return;
        }

        var total = filtered.length;
        var shown = Math.min(total, maxResults);
        var sourceLabel = buildSourceLabel(filtered);
        $searchPanel.removeClass('is-hidden');

        for (i = 0; i < shown; i++) {
            var item = filtered[i];
            var doc = item.doc;
            var url = normalizeLink(doc.link, item.sourceBase);
            var title = doc.title || 'Untitled';
            var snippet = extractSnippet(doc);
            var displayLink = formatDisplayLink(url);
            var metaLine = displayLink;

            if (item.sourceLabel) {
                metaLine = metaLine ? (metaLine + ' · ' + item.sourceLabel) : item.sourceLabel;
            }

            var $result = $('<article class="search-result"></article>');
            var $title = $('<h3 class="search-title"></h3>');
            $title.append($('<a></a>').attr('href', url).text(title));
            $result.append($title);
            if (snippet) {
                $result.append($('<p class="search-snippet"></p>').text(snippet));
            }
            if (metaLine) {
                $result.append($('<p class="search-link"></p>').text(metaLine));
            }
            $searchResultsList.append($result);
        }

        var message;
        if (total > shown) {
            message = 'Showing ' + shown + ' of ' + total + ' results from ' + sourceLabel + '.';
        } else {
            message = 'Showing ' + total + ' result' + (total === 1 ? '' : 's') + ' from ' + sourceLabel + '.';
        }
        if (pending.length) {
            message += ' Loading the ' + buildPendingLabel(pending) + '...';
        }
        $searchCount.text(message);
    };

    var showError = function(message) {
        $searchError.text(message);
        $searchError.removeClass('is-hidden');
    };

    var updateSearch = function() {
        var query = normalizeText($searchInput.val());
        var filter = getActiveFilter();
        lastQuery = query;
        lastFilter = filter;

        $searchEmpty.addClass('is-hidden');
        $searchError.addClass('is-hidden');
        $searchCount.removeClass('is-hidden');
        $searchPanel.addClass('is-hidden');

        if (!query) {
            $searchResultsList.empty();
            $searchCount.text('');
            $searchCount.addClass('is-hidden');
            $searchPanel.addClass('is-hidden');
            return;
        }

        var systemFailed = false;
        var substackFailed = false;
        var wantsSystem = (filter === 'all' || filter === 'system');
        var wantsSubstack = (filter === 'all' || filter === 'substack');

        if (wantsSystem && indexReady && isIndexStale()) {
            resetIndex();
        }
        if (wantsSubstack && substackReady && isSubstackIndexStale()) {
            resetSubstackIndex();
        }

        var pendingSources = [];
        if (wantsSystem && !indexReady) {
            pendingSources.push(systemSourceLabel);
        }
        if (wantsSubstack && !substackReady) {
            pendingSources.push(substackSourceLabel);
        }
        if (pendingSources.length) {
            setLoadingMessage('Loading the ' + buildPendingLabel(pendingSources) + '...');
        } else {
            $searchCount.text('Searching the archive...');
        }

        var runSearch = function() {
            if (lastQuery !== query || lastFilter !== filter) {
                return;
            }

            var pending = [];
            var desiredCount = 0;
            var failedCount = 0;
            var hasReadySource = false;

            if (wantsSystem) {
                desiredCount += 1;
                if (indexReady) {
                    hasReadySource = true;
                } else if (!systemFailed) {
                    pending.push(systemSourceLabel);
                } else {
                    failedCount += 1;
                }
            }
            if (wantsSubstack) {
                desiredCount += 1;
                if (substackReady) {
                    hasReadySource = true;
                } else if (!substackFailed) {
                    pending.push(substackSourceLabel);
                } else {
                    failedCount += 1;
                }
            }

            if (!hasReadySource) {
                if (desiredCount && failedCount === desiredCount) {
                    $searchCount.text('Search unavailable.');
                    $searchPanel.addClass('is-hidden');
                    showError('Search could not load the selected sources. Please try again in a moment.');
                } else if (pending.length) {
                    setLoadingMessage('Loading the ' + buildPendingLabel(pending) + '...');
                }
                return;
            }

            renderResults(buildCombinedResults(query, wantsSystem, wantsSubstack), pending);

            if (failedCount && hasReadySource) {
                if (wantsSystem && systemFailed) {
                    showError(systemSourceLabel + ' index could not load. Results may be incomplete.');
                } else if (wantsSubstack && substackFailed) {
                    showError(substackSourceLabel + ' feed could not load. Results may be incomplete.');
                }
            }
        };

        if (wantsSystem) {
            resolveIndex()
                .done(runSearch)
                .fail(function() {
                    systemFailed = true;
                    runSearch();
                });
        }

        if (wantsSubstack) {
            resolveSubstackIndex()
                .done(runSearch)
                .fail(function() {
                    substackFailed = true;
                    runSearch();
                });
        }
    };

    $searchInput.on('input', function() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(updateSearch, 200);
    });

    $searchFilters.on('change', function() {
        updateSearch();
    });
});

$(function() {
    var $toggle = $('.js-theme-toggle');
    if (!$toggle.length) {
        return;
    }

    var storageKey = 'theme';
    var root = document.documentElement;
    var $label = $toggle.find('.theme-toggle-text');
    var mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    var getStoredTheme = function() {
        var value = null;
        try {
            value = window.localStorage.getItem(storageKey);
        } catch (err) {
            value = null;
        }
        if (value === 'light' || value === 'dark') {
            return value;
        }
        return '';
    };

    var getSystemTheme = function() {
        if (mediaQuery && mediaQuery.matches) {
            return 'dark';
        }
        return 'light';
    };

    var updateToggle = function(theme) {
        var isDark = theme === 'dark';
        $toggle.attr('aria-pressed', isDark);
        if ($label.length) {
            $label.text(isDark ? 'Light mode' : 'Dark mode');
        }
    };

    var applyTheme = function(theme, persist) {
        if (persist) {
            root.setAttribute('data-theme', theme);
        } else {
            root.removeAttribute('data-theme');
        }
        updateToggle(theme);
    };

    var storedTheme = getStoredTheme();
    if (storedTheme) {
        applyTheme(storedTheme, true);
    } else {
        applyTheme(getSystemTheme(), false);
    }

    $toggle.on('click', function() {
        var currentTheme = getStoredTheme() || getSystemTheme();
        var nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        try {
            window.localStorage.setItem(storageKey, nextTheme);
        } catch (err) {
        }
        applyTheme(nextTheme, true);
    });

    if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', function(event) {
            if (!getStoredTheme()) {
                applyTheme(event.matches ? 'dark' : 'light', false);
            }
        });
    }
});

$('body').scrollspy({
    target: '.navbar-fixed-top'
})

$('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
});

$('div.modal').on('show.bs.modal', function() {
	var modal = this;
	var hash = modal.id;
	window.location.hash = hash;
	window.onhashchange = function() {
		if (!location.hash){
			$(modal).modal('hide');
		}
	}
});
