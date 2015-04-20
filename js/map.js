---
---
(function(){
  // extend app w/ map module
  $.extend(app, {
    projectGrids: {},
    satelliteUrlTemplate: 'https://wri-tiles.s3.amazonaws.com/umd_landsat/{year}/{z}/{y}/{x}.png',
    satLayers: {},
    roadReferenceLayer: null,
    tooltipIsOpen: false,

    initMap: function(){
      this.buildMap();
      $('#map-legend .satellite-controller a').on('click', this.switchSatLayer);
      $('#map-legend .task-grid a').on('click', this.switchProjectGrid);
      $('.fb-share').on('click', this.fbShareDialogue);
      $('.twitter-share').on('click', this.twitterShareDialogue);
      $('#map-tooltip').on('click', 'a.close', this.closeTooltip);

      app.tooltipTemplate = Handlebars.compile($('#tooltip-template').html());

      // load project area(s)
      this.loadProjectGrid();
      this.map.on('taskGrids-loaded', this.setVectorStrokeWidth);
      // this.map.on('taskGrids-loaded', this.fitMapBoundsToVector);

    },

    buildMap: function(){
      // set up map
      L.mapbox.accessToken = 'pk.eyJ1IjoiY3Jvd2Rjb3ZlciIsImEiOiI3akYtNERRIn0.uwBAdtR6Zk60Bp3vTKj-kg';
      this.map = L.mapbox.map('map', pageConfig.baseLayer, {
      // this.map = L.mapbox.map('map', undefined, {
        // layer: this.projectBase['dark'],
        center: pageConfig.center,
        zoom: pageConfig.zoom,
        minZoom: 4,
        maxZoom: 18,
        scrollWheelZoom: false,
        attributionControl: false
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

      L.control.scale({position: 'bottomleft', imperial: false }).addTo(this.map);

      // add page event listeners
      this.map.on('zoomend', this.setVectorStrokeWidth);
    },

    loadProjectGrid: function(){
      // load grid geojsons for all projects in pageConfig.tm_projects
      // and fire 'projectGrids-loaded' event when all have resolved
      var countryGridPromises = $.map(pageConfig.tm_projects, function(projectObj, projectKey){
        var countryGridPromise = $.Deferred(),
            project_id = projectObj['project_id'];

        // app.projectGrids[projectKey] = L.mapbox.featureLayer('http://tasks.hotosm.org/project/' + project_id + '/tasks.json')
        app.projectGrids[projectKey] = L.mapbox.featureLayer('{{site.baseurl}}/data/osm_tm_tasks_' + project_id + '.geojson')
          .on('ready', function(){
            this.setFilter(function(feature){
              return feature.properties['state'] !== -1;
            })
            .eachLayer(function(layer){
              app.onEachProjectGridCell(layer, project_id);
            })
            .addTo(app.map);

            app.map.fire('taskGrid-loaded');
            countryGridPromise.resolve();

          });

        return countryGridPromise;
      });

      // fire event when all grids have loaded [for reference, see: http://stackoverflow.com/questions/18424712/how-to-loop-through-ajax-requests-inside-a-jquery-when-then-statment]
      $.when.apply($, countryGridPromises)
        // .then(function(){
        //   console.log('taskGrids loaded');
        // }).fail(function(){
        //   console.log('taskGrids failed to load');
        // })
        .always(function(){
          app.map.fire('taskGrids-loaded');
        });

    },

    onEachProjectGridCell: function(layer, project_id){
      // function called on each project grid cell, defined here for organization
      // tranform each layers' properties into more recognizable terms
      var gridStrokeColor = '#999',
          gridStrokeClickColor = '#F8842E',
          feature = layer.feature,
          tooltip = $('#map-sidebar #map-tooltip');

      feature.properties['locked'] = feature.properties['locked'] ? 'locked' : 'unlocked';
      feature['project_id'] = project_id;

      switch(feature.properties['state']){
        case 0:
          feature.properties['state'] = 'ready'; break;
        case 1:
          feature.properties['state'] = 'invalidated'; break;
        case 2:
          feature.properties['state'] = 'done'; break;
        case 3:
          feature.properties['state'] = 'validated'; break;
        case -1:
          feature.properties['state'] = 'removed'; break;
      }

      layer.setStyle({ 
        className: ['project-grid', feature.properties['state'], feature.properties['locked']].join(' '), 
        color: gridStrokeColor
      });

      layer.on('mouseover', function(e){
        this.bringToFront();
        if(! app.tooltipIsOpen ){
          app.addTooltipContent({__teaser__ : feature});
          tooltip.addClass('hover');
        }
      });

      layer.on('mouseout', function(e){
        if(! app.tooltipIsOpen ){
          tooltip.removeClass('clicked');
          app.removeTooltipContent();
        }
        if(this.feature.id !== app.tooltipIsOpen){
          this.bringToBack();
        }
        tooltip.removeClass('hover');
      });

      layer.on('click', function(e){
        tooltip.addClass('clicked');
        app.setGridStrokeColor(gridStrokeColor);
        layer.setStyle({ color: gridStrokeClickColor });  // match color to $primary variable
        this.bringToFront();
        app.addTooltipContent({__full__ : feature});
        app.tooltipIsOpen = layer.feature['id'];

        app.map.fitBounds(this.getBounds(), {
          animate: true,
          padding: [20,20]
        })
      });
    },

    switchProjectGrid: function(e){
      e.preventDefault();
      e.stopPropagation();
      var listItem = $(this).parent('li');
      
      if(listItem.hasClass('active')) return false;
      if(listItem.data('id') === 'show'){
        listItem.addClass('active');
        app.showProjectGrid();
      }else{
        listItem.siblings('li.active').removeClass('active');
        app.hideProjectGrid();
      }
    },

    showProjectGrid: function(){
      $('path.project-grid').css({display: 'block'}).animate({opacity: 1}, 200);
    },

    hideProjectGrid: function(){
      $('path.project-grid').animate({opacity: 0}, 200, function(){
        $(this).css({display: 'none'});
      });
    },

    closeTooltip: function(e){
      e.preventDefault();
      e.stopPropagation();
      app.removeTooltipContent();
      app.tooltipIsOpen = false;
      $('#map-sidebar #map-tooltip').removeClass('clicked');
      app.resetMapView();
      app.setGridStrokeColor('#999')
    },

    addTooltipContent: function(content){
      var tooltipContainer = $('#map-tooltip');
      var tooltipCompiled = app.tooltipTemplate(content);
      tooltipContainer.html( tooltipCompiled );
    },

    removeTooltipContent: function(){
      $('#map-tooltip').html('');
    },

    switchSatLayer: function(e){
      e.preventDefault();
      e.stopPropagation();

      var $this = $(this),
          listItem = $this.parent('li')
          listItemSiblings = listItem.siblings('li'),
          layerId = listItem.data('id');

      if(layerId === 'terrain'){
        app.removeSatLayer();
        app.removeRoadReferenceLayer();
      }else{
        app.addSatLayer(layerId);
        app.addRoadReferenceLayer();
      }
      listItemSiblings.filter('.active').removeClass('active');
      listItem.addClass('active');
    },

    addSatLayer: function(id){
      // if layer hasn't yet been created, create and add to app.satLayers[id]
      if(! app.satLayers[id]){
        app.satLayers[id] = L.tileLayer(app.satelliteUrlTemplate.replace('{year}', id));
      }

      // short circuit if map already has layer
      if(app.map.hasLayer(app.satLayers[id])) return false;

      app.removeSatLayer();
      app.satLayers[id].setZIndex(1).addTo(app.map);

    },

    removeSatLayer: function(){
      for(var layerId in app.satLayers){
        var layer = app.satLayers[layerId];
        if(app.map.hasLayer(layer)){
          app.map.removeLayer(layer)
        }
      }
    },

    addRoadReferenceLayer: function(){
      if(! app.roadReferenceLayer ){
        app.roadReferenceLayer = L.mapbox.tileLayer('crowdcover.e8c210c5').setZIndex(2);
      }
      app.roadReferenceLayer.addTo(app.map);
    },

    removeRoadReferenceLayer: function(){
      if( app.roadReferenceLayer ){
        app.map.removeLayer(app.roadReferenceLayer);
      }
    },

    setGridStrokeColor: function(color){
      $.each(app.projectGrids, function(key, idx){
        app.projectGrids[key].eachLayer(function(layer){
          layer.setStyle({ color: color });
        });
      });
    },

    resetMapView: function(){
      app.map.setView(pageConfig.center, pageConfig.zoom,{animate: true});
    },

    setVectorStrokeWidth: function(){
      var zoomLevel = app.map.getZoom();
      $('.leaflet-objects-pane path.project-grid').css('stroke-width', function(){
        if(zoomLevel <= 6){
          return 0.5;
        }else if(zoomLevel <= 8){
          return 1.4;
        }else{
          return 2;
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
