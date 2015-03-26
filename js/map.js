---
---
(function(){
  // extend app w/ map module
  $.extend(app, {
    projectAreas: {},
    projectGrids: {},
    initMap: function(){
      // set up map
      L.mapbox.accessToken = 'pk.eyJ1IjoiY3Jvd2Rjb3ZlciIsImEiOiI3akYtNERRIn0.uwBAdtR6Zk60Bp3vTKj-kg';
      this.map = L.mapbox.map('map', pageConfig.baseLayer, {
        center: pageConfig.center,
        zoom: pageConfig.zoom,
        minZoom: 4,
        maxZoom: 18,
        scrollWheelZoom: false
      });

      // build leaflet share and scale controls
      var shareControl = L.control({position: 'topleft'});
      shareControl.onAdd = function(){
        var controlHTML = $('<div>', {
          class: 'leaflet-bar leaflet-control',
        });
        var fbButton = $('<a>',{
          class: 'fb-share mapbox-icon mapbox-icon-facebook',
          href: '#'
        });
        var twitterButton = $('<a>',{
          class: 'twitter-share mapbox-icon mapbox-icon-twitter',
          href: '#'
        });
        controlHTML.append(fbButton, twitterButton);
        return controlHTML[0];
      }
      shareControl.addTo(this.map);

      L.control.scale({position: 'bottomleft', imperial: false }).addTo(this.map)

      // add page event listeners
      this.map.on('zoomend', this.setVectorStrokeWidth);
      $('.toggle-full-screen').on('click', this.toggleFullScreen);
      $('.fb-share').on('click', this.fbShareDialogue);
      $('.twitter-share').on('click', this.twitterShareDialogue);

      // load project area(s) and task grid(s)
      this.loadTMProjectAreas();
      this.map.on('projectAreas-loaded', this.loadTMProjectGrid);
      this.map.on('taskGrid-loaded', this.setVectorStrokeWidth);
      // this.map.on('taskGrids-loaded', this.fitMapBoundsToVector);

    },

    toggleFullScreen: function(e){
      e.preventDefault();
      e.stopPropagation();
      var $this = $(this);

      if($this.hasClass('has-full-screen')){
        app.setMapContainerHeight(520);
        $this.removeClass('has-full-screen');
        $this.html('<em>enlarge map</em>');
      }else{
        app.setMapContainerHeight(window.innerHeight);
        $this.addClass('has-full-screen');
        $this.html('<em>shrink map</em>');
      }
    },

    loadTMProjectAreas: function(){
      // sketchy way to determine last country in loop
      var final_country;
      for(var country in pageConfig.tm_projects){
        final_country = country;
      }

      // define clojure for project area callback
      var projectAreaCallback = function(country){
        return function(){
          this.setStyle({ className: 'project-area'})
              .addTo(app.map);

          if(country === final_country){ app.map.fire('projectAreas-loaded'); }
        }
      };

      for(var country in pageConfig.tm_projects){
        // check if last iteraiton of loop
        var is_last = (country === final_country);

        // L.mapbox.featureLayer('http://tasks.hotosm.org/project/' + pageConfig.project_areas + '.json')
        app.projectAreas[country] = L.mapbox.featureLayer('{{site.baseurl}}/data/' + pageConfig.tm_projects[country]['project_area'])
                            .on('ready', projectAreaCallback(country));
      }

    },

    loadTMProjectGrid: function(){
      // sketchy way to determine last country in loop
      // var final_country;
      // for(var country in pageConfig.tm_projects){
      //   final_country = country;
      // }

      // define clojure for project grid callback
      var projectGridCallback = function(country){
        return function(){
          var task_number = pageConfig.tm_projects[country]['task_number'],
              map_tooltip = $('#map-tooltip');

          this.setFilter(function(feature){
            // filter out all removed cells
            return feature.properties['state'] !== -1;
          })
          .eachLayer(function(layer){
            window.layer = layer;

            var cell_state,
                locked_state,
                popupContent;

            switch(layer.feature.properties['state']){
              case 0:
                cell_state = 'ready'; break;
              case 1:
                cell_state = 'invalidated'; break;
              case 2:
                cell_state = 'done'; break;
              case 3:
                cell_state = 'validated'; break;
              case -1:
                cell_state = 'removed'; break;
            }

            locked_state = layer.feature.properties['locked'] ? 'locked' : 'unlocked';

            popupContent = {% include project-grid-popup.js %}

            layer.setStyle({ className: 'project-grid state-' + cell_state + ' ' + locked_state });

            layer.on('mouseover', function(e){
              this.bringToFront();
              map_tooltip.html(popupContent);
            });

            layer.on('mouseout', function(e){
              map_tooltip.html('');
            });

            layer.on('click', function(e){
              // navigate to tasking manager.  url template: http://tasks.hotosm.org/project/{project_id}#task/{task_number}
              window.open('http://tasks.hotosm.org/project/' + task_number + '#task/' + layer.feature['id']);
            });
          })
          .addTo(app.map)

          // if(country === final_country){ app.map.fire('taskGrids-loaded'); }
          // TODO: fire 'taskGrids-loaded' when all grids are loaded:
            // http://stackoverflow.com/questions/18424712/how-to-loop-through-ajax-requests-inside-a-jquery-when-then-statment
          app.map.fire('taskGrid-loaded');
        }
      }

      for(var country in pageConfig.tm_projects){
        // L.mapbox.featureLayer('http://tasks.hotosm.org/project/' + pageConfig.task_number + '/tasks.json')
        app.projectGrids[country] = L.mapbox.featureLayer('{{site.baseurl}}/data/osmtm_tasks_' + pageConfig.tm_projects[country]['task_number'] + '.geojson')
                                     .on('ready', projectGridCallback(country));
      }

    },

    setVectorStrokeWidth: function(){
      var zoomLevel = app.map.getZoom();
      $('.leaflet-objects-pane path.project-area').css('stroke-width', function(){
        if(zoomLevel <= 6){
          return 0.4;
        }else if(zoomLevel <= 8){
          return 1;
        }else{
          return 2;
        }
      });

      $('.leaflet-objects-pane path.project-grid').css('stroke-width', function(){
        if(zoomLevel <= 6){
          return 0.8;
        }else if(zoomLevel <= 8){
          return 2;
        }else{
          return 4;
        }
      });
    },

    fitMapBoundsToVector: function(){
      // build L.latLngBounds object out of all countries' bounds
      var boundsArray = $.map(app.projectGrids, function(value, index){
        return value.getBounds();
      });

      var totalBounds = boundsArray[0];
      for(var i = 1; i<boundsArray.length; i++){
        totalBounds.extend(boundsArray[i]);
      }

      // var totalBounds = boundsArray.reduce(function(a,b){
      //   return a.extend(b);
      // }, boundsArray[0]);

      app.map.fitBounds(totalBounds);
    },

    setMapContainerHeight: function(height){
      $('.map-container').height(height);
      app.map.invalidateSize({animate: true});
      // // transition time must match .map-container { transition: height <time>; } in map.css
      // window.setTimeout( function(){
      //   app.map.invalidateSize({animate: true});
      // }, 200);
    },

    fbShareDialogue: function(){
      // https://developers.facebook.com/docs/sharing/reference/share-dialog
      var url = 'https://www.facebook.com/sharer/sharer.php?u=';
      url += encodeURIComponent(location.href);
      // url += '&p[title]=Moabi';
      window.open(url, 'fbshare', 'width=640,height=320');
    },

    twitterShareDialogue: function(){
      var url = 'http://twitter.com/share?'
      url += 'text=@MoabiMaps @globalforests Mapping the spread of logging roads in the Congo Basin:';
      url += '&url=' + encodeURIComponent(location.href);
      url += '&hashtags=LoggingRoads';
      window.open(url, 'twittershare', 'width=640,height=320');
    },

  });

})()
