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

    var $searchItems = $('.js-search-item');
    var $searchGroups = $('.js-search-group');
    var $searchCount = $('.js-search-count');
    var $searchEmpty = $('.js-search-empty');

    var normalizeText = function(value) {
        return (value || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
    };

    var getSearchText = function($element) {
        var dataText = $element.data('search');
        if (dataText) {
            return dataText;
        }
        return $element.text();
    };

    var entries = [];
    $searchItems.each(function() {
        var $item = $(this);
        entries.push({
            element: $item,
            container: $item.closest('[class*="col-"]'),
            text: normalizeText(getSearchText($item))
        });
    });

    var updateSearch = function() {
        var query = normalizeText($searchInput.val());
        var tokens = query ? query.split(' ') : [];
        var visibleCount = 0;

        $.each(entries, function(index, entry) {
            var match = true;
            if (tokens.length) {
                $.each(tokens, function(tokenIndex, token) {
                    if (!token) {
                        return;
                    }
                    if (entry.text.indexOf(token) === -1) {
                        match = false;
                        return false;
                    }
                });
            }

            entry.element.toggleClass('is-hidden', !match);
            if (entry.container.length) {
                entry.container.toggleClass('is-hidden', !match);
            }
            if (match) {
                visibleCount += 1;
            }
        });

        $searchGroups.each(function() {
            var $group = $(this);
            var hasVisibleItems = $group.find('.js-search-item').not('.is-hidden').length > 0;
            $group.toggleClass('is-hidden', !hasVisibleItems);
        });

        if (!query) {
            $searchCount.text('Showing all ' + visibleCount + ' items.');
            $searchEmpty.addClass('is-hidden');
            return;
        }

        $searchCount.text('Showing ' + visibleCount + ' match' + (visibleCount === 1 ? '' : 'es') + '.');
        $searchEmpty.toggleClass('is-hidden', visibleCount !== 0);
    };

    $searchInput.on('input', updateSearch);
    updateSearch();
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
