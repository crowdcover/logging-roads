---
---
(function(){
  // helper functions
  function unique(collection){
    return collection.reduce(function(result, item){
      return result.indexOf(item) === -1 ? result.concat(item) : result;
    }, []);
  }

  function fuzzyMatch(query, term){
    // a very permissive fuzzyMatch algorithm a-la SublimeText
    // returns true if all values in 'query' array appear in the same order in 'term' array,
    // though not necessarily sequentially
    // i.e. allows for dropped letters, does not allow for incorrect letters
    if(query.length === 0){ return true; }

    var queryLetterIdx = term.indexOf(query[0]);
    return queryLetterIdx !== -1 && fuzzyMatch(query.slice(1), term.slice(queryLetterIdx +1));
  }

  // extend app w/ map module
  $.extend(app, {
    osmHistoryBaseURL: 'http://loggingroads.org:3030/',
    blacklist: ['JamesLC', 'Leo B', 'kriscarle', 'BKessler_GFW_import'],
    contributorGeoJSONLayer: null,
    loadingContributorGeoJSON: false,
    filterText: '',
    initLeaderboard: function(){
      // see mapoff sample site: http://mapgive.state.gov/events/mapoff/results/
      // user_list.json
        // nodes/ways/relations/changesets per user
      // ways_per_tag.json
        // ways per changeset
      // user.json
        // geojson of user's edits (malformed?)

      // nice to have
        // user contributions over time
        // total contributions over time

      // bind event handlers
      $('.tag-filter').on('keyup', this.filterLeaderboard);

      this.drawLeaderboard();
      this.drawStats();
      this.loadToFixTasks();
    },

    filterLeaderboard: function(e){
      var newFilterText = $(this).val();

      // abort if fitler text is unchanged
      if(app.filterText === newFilterText){
        return;
      }else{
        app.filterText = newFilterText;
      }

      function filterFn(editor){
        return editor.tags.reduce(function(bool, tag){
          return bool || fuzzyMatch(app.filterText, tag);
        }, false);
      }

      app.drawLeaderboard(filterFn);
    },

    drawLeaderboard: function(filterFn){
      filterFn = filterFn || function(){ return true; }

      var editorsContainer = $('#top-editors'),
          panelContainer = editorsContainer.find('.tabs-content'),
          editorsPanelTabs = editorsContainer.find('.tabs[data-tab]'),
          rowsPerPanel = 10;

      // delete existing leaderboard body, if exists
      panelContainer.empty();
      editorsPanelTabs.empty();

      $.getJSON(app.osmHistoryBaseURL + 'leaders', function(data){
        // sort by number of edits and filter out blacklisted users
        data = data.filter(function(editor){
          return app.blacklist.indexOf(editor.username) === -1 && filterFn(editor);
        });

        var panelCount = Math.ceil(data.length / rowsPerPanel);

        for(var panelIdx = 1; panelIdx <= panelCount; panelIdx++){
          var tabButton = $('<li class="tab-title">'),
              tabButtonLink = $('<a href="#panel' + panelIdx + '">' + panelIdx + '</a>');

          if(panelIdx === 1) tabButton.addClass('active');
          tabButton.append( tabButtonLink );
          editorsPanelTabs.append( tabButton );
        }

        panelContainer.appendTo(editorsContainer);
        editorsPanelTabs.appendTo(editorsContainer);

        // holy lord this is messy
        $.each(data, function(idx, editor){
          var panelNumber = Math.ceil(idx / rowsPerPanel);
          if(idx % rowsPerPanel === 0){
            // construct panels
            var panel = $('<div class="content" id="panel' + (panelNumber + 1) + '">');
            if(idx === 0) panel.addClass('active');
            app.addRowTo(panel, editor, idx + 1 );
            panel.appendTo( panelContainer );
          }else{
            // append to existing panel
            app.addRowTo( $('div#panel' + panelNumber), editor, idx + 1 );
          }
        });

        // silly to have to call this again, but must run at the end of the getJSON call
        $(document).foundation();
      });

    },

    drawStats: function(){
      $.getJSON(app.osmHistoryBaseURL + 'total', function(data){
        var total = parseInt(data.total);
        var totalChangesContainer = $('#total-changes');
        totalChangesContainer.append($('<span class="stats">').text(total.toLocaleString()));

      });
      $.getJSON(app.osmHistoryBaseURL + 'roads', function(data){

        var totalRoads = data.value;
        var totalRoadsContainer = $('#total-roads');
        totalRoadsContainer.append($('<span class="stats">').text(totalRoads.toLocaleString()));
        $.getJSON(app.osmHistoryBaseURL + 'roadswithstartdate', function(data){
          var totalRoadsWithStartDate = data.value;
          var pctTagged = (totalRoadsWithStartDate / totalRoads) * 100;
          var totalStartDateContainer = $('#total-startdate');
            totalStartDateContainer.append($('<span class="stats">').text(pctTagged.toPrecision(4).toLocaleString() + '%'));
        });
      });

    },

    loadToFixTasks: function(){
      //update to-fix task list
      $.getJSON('http://loggingroads.org:8000/tasks', function(data){

        var tasks = data.data;
        var tasksContainer = $('#tofix-tasks');
        tasks.forEach(function(task){
          var link = 'http://fix.loggingroads.org/#/task/' + task.task;
          tasksContainer.append($('<div class="task small-5">')

          .append($('<a class="button large round map-btn" href="'+ link +'">').text('Tag Logging Road Creation Dates')));
        });


      });
    },

    addRowTo: function(panel, editor, rank){
      var row = $('<li class="top-editor clearfix">').appendTo( panel ),
          userNameLink = $('<a href="http://www.openstreetmap.org/user/' + editor.username + '" target="_blank">')
                           .text(editor.username);

      row.append( $('<span class="small-1 columns text-center">').text(rank) );
      row.append( $('<span class="small-3 columns">').html(userNameLink) );
      row.append( $('<span class="small-3 columns text-right">').text(editor.changes) );

      //get unique tags
      var tags = [];
      editor.tags.forEach(function(tag){
        if($.inArray(tag, tags) == -1){
          tags.push(tag);
        }
      });


      row.append( $('<span class="small-5 columns text-right">').text(tags) );

      /*
      var changeSetLinks = '';
      editor.changesets.forEach(function(changesetID, i){
        var count = i + 1;
        changeSetLinks += '<a href="http://www.openstreetmap.org/changeset/' + changesetID + '" target="_blank">' + count + '</a>&nbsp;';
      });

      row.append( $('<span class="small-3 columns text-right" style="overflow-wrap: break-word;">').append(changeSetLinks));
      */
    },

  });

})()
