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
    var $searchLoading = $('.js-search-loading');
    var $searchPlaceholder = $('.js-search-placeholder');
    var $searchResultsList = $('.js-search-results-list');

    var baseUrl = 'https://systemhalted.in';
    var indexReady = false;
    var indexPromise = null;
    var siteIndex = null;
    var siteDocs = [];
    var lastQuery = '';
    var debounceTimer = null;
    var maxResults = 12;
    var maxLoadAttempts = 3;
    var retryDelayMs = 800;

    var normalizeText = function(value) {
        return (value || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
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
        if ($searchLoading.length) {
            $searchLoading.text(message);
        }
    };

    var resolveIndex = function() {
        if (indexReady && siteIndex && siteDocs.length) {
            return $.Deferred().resolve().promise();
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
                setLoadingMessage('Retrying to load the System Halted index (' + nextAttempt + ' of ' + maxLoadAttempts + ')...');
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
                indexReady = true;
                deferred.resolve();
            } catch (err) {
                handleFailure(attempt);
            }
        };

        attemptLoad = function(attempt) {
            var cacheBuster = '?retry=' + attempt + '-' + Date.now();
            loadScript(baseUrl + '/public/js/webcmd.js' + cacheBuster)
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

        setLoadingMessage('Loading the System Halted index... this can take a few seconds.');
        attemptLoad(1);

        return indexPromise;
    };

    var normalizeLink = function(link) {
        if (!link) {
            return '';
        }
        if (link.indexOf('http://') === 0 || link.indexOf('https://') === 0) {
            return link;
        }
        if (link.charAt(0) !== '/') {
            link = '/' + link;
        }
        return baseUrl + link;
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

    var renderResults = function(results) {
        var filtered = [];
        var i;
        $searchResultsList.empty();
        $searchLoading.addClass('is-hidden');

        for (i = 0; i < results.length; i++) {
            var ref = results[i].ref;
            var doc = siteDocs[ref];
            if (!doc || !isSearchable(doc)) {
                continue;
            }
            filtered.push(doc);
        }

        if (!filtered.length) {
            $searchCount.text('No matches found.');
            $searchEmpty.removeClass('is-hidden');
            return;
        }

        var total = filtered.length;
        var shown = Math.min(total, maxResults);
        for (i = 0; i < shown; i++) {
            var item = filtered[i];
            var url = normalizeLink(item.link);
            var title = item.title || 'Untitled';
            var snippet = extractSnippet(item);
            var displayLink = formatDisplayLink(url);

            var $result = $('<article class="search-result"></article>');
            var $title = $('<h3 class="search-title"></h3>');
            $title.append($('<a></a>').attr('href', url).text(title));
            $result.append($title);
            if (snippet) {
                $result.append($('<p class="search-snippet"></p>').text(snippet));
            }
            if (displayLink) {
                $result.append($('<p class="search-link"></p>').text(displayLink));
            }
            $searchResultsList.append($result);
        }

        if (total > shown) {
            $searchCount.text('Showing ' + shown + ' of ' + total + ' results from System Halted.');
        } else {
            $searchCount.text('Showing ' + total + ' result' + (total === 1 ? '' : 's') + ' from System Halted.');
        }
    };

    var showError = function(message) {
        $searchError.text(message);
        $searchError.removeClass('is-hidden');
    };

    var updateSearch = function() {
        var query = normalizeText($searchInput.val());
        lastQuery = query;

        $searchEmpty.addClass('is-hidden');
        $searchError.addClass('is-hidden');

        if (!query) {
            $searchLoading.addClass('is-hidden');
            $searchResultsList.empty();
            $searchPlaceholder.removeClass('is-hidden');
            $searchCount.text('Type to search the archive.');
            return;
        }

        $searchPlaceholder.addClass('is-hidden');
        $searchCount.text('Searching the archive...');
        if (!indexReady) {
            $searchLoading.removeClass('is-hidden');
        } else {
            $searchLoading.addClass('is-hidden');
        }

        resolveIndex()
            .done(function() {
                if (lastQuery !== query) {
                    return;
                }
                var results = siteIndex.search(query, { expand: true });
                renderResults(results);
            })
            .fail(function() {
                if (lastQuery !== query) {
                    return;
                }
                $searchLoading.addClass('is-hidden');
                $searchCount.text('Search unavailable.');
                showError('Search could not load the archive index. Please try again in a moment.');
            });
    };

    $searchInput.on('input', function() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(updateSearch, 200);
    });
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
