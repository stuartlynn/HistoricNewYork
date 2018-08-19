import React from 'react';
import * as turf from '@turf/turf';
import {LeafletConsumer} from 'react-leaflet';
import createHistory from "history/createBrowserHistory"

const history = createHistory({basename:process.env.PUBLIC_URL+'/'})

const LayersContext = React.createContext();
const position = [40.71248, -74.007994];

export default class LayersProvider extends React.Component {
  state = {
    maps: null,
    selectedMaps: [],
    fetchedMaps: [],
    locationFilter: null,
    dateFilter: [1800, 1900],
    sizeFilter: [],
    editable: true,
    shareModalVisible: false,
    viewport: {
      center: position,
      zoom: 12,
    },
    filteredMaps: [],
    textFilter: '',
    toggleMap: this.toggleMap.bind(this),
    updateOpacity: this.updateOpacity.bind(this),
    setLocationFliter: this.setLocationFliter.bind(this),
    setDateFilter: this.setDateFilter.bind(this),
    setTextFilter: this.setTextFilter.bind(this),
    setSizeFilter: this.setSizeFilter.bind(this),
    setMapViewport: this.setMapViewport.bind(this),
    makeMapEditable: this.makeMapEditable.bind(this),
    blankSlate: this.blankSlate.bind(this),
    zoomToMap: this.zoomToMap.bind(this),
    showShareModal: this.showShareModal.bind(this),
    closeShareModal: this.closeShareModal.bind(this),
    getSelectedMapsWithDetails: this.getSelectedMapsWithDetails.bind(this),
    encodeShareStateToHash: this.encodeShareStateToHash.bind(this),
    //getShortURL : this.getShortURL.bind(this),
    offset: 0,
    limit: 20,
  };

  // This is a crappy hack... fix it at some point to use the map reference

  componentWillMount() {
    fetch('maps.geojson')
      .then(m => m.json())
      .then(r => {
        this.setState({maps: r}, () => {
          this.extractStateFromHash();
          this.filterMaps();
        });
      });
    this.unlisten = history.listen(this.locationChanged.bind(this));

  }

  locationChanged(location,action){
    this.extractStateFromHash()
  }

  makeMapEditable() {
    this.setState(
      {
        editable: true,
      },
      this.encodeStateToHash.bind(this),
    );
  }

  blankSlate() {
    this.setState(
      {
        editable: true,
        selectedMaps: [],
      },
      this.encodeStateToHash.bind(this),
    );
  }

  encodeShareStateToHash() {
    const serializableState = {
      viewport: this.state.viewport,
      editable: false,
      selectedMaps: this.state.selectedMaps.map(map => ({
        opacity: map.opacity,
        uuid: map.uuid,
      })),
    };
    const hashFrag = btoa(JSON.stringify(serializableState));
    return `${window.location.href.split('#')[0]}#${hashFrag}`;
  }
  //getShortURL(){
  //const url = this.encodeShareStateToHash()
  //return fetch(`http://tinyurl.com/api-create.php?url=${url}`).then(r=>r.text())
  //}
  encodeStateToHash() {
    const serializableState = {
      viewport: this.state.viewport,
      editable: this.state.editable,
      selectedMaps: this.state.selectedMaps.map(map => ({
        opacity: map.opacity,
        uuid: map.uuid,
      })),
    };

    const hashFrag = btoa(JSON.stringify(serializableState));
    history.push(hashFrag);
  }

  extractStateFromHash() {
    const hash = history.location.pathname.slice(1);
    console.log(hash)
    try {
      const serializableState = JSON.parse(atob(hash));
      this.setState({
        ...serializableState,
      });
    } catch (e) {
      window.location.hash = '';
    }
  }

  render() {
    return (
      <LayersContext.Provider value={this.state}>
        {this.props.children}
      </LayersContext.Provider>
    );
  }

  zoomToMap(uuid) {
    const map = this.state.maps.features.filter(
      map => map.properties.uuid === uuid,
    )[0];
    const boundingBox = turf.bbox(map.geometry);
    console.log(this.props)
    console.log(this.props.leaflet.map._getBoundsCenterZoom(boundingBox, {}));
  }

  setMapViewport(viewport) {
    this.setState({viewport}, this.encodeStateToHash.bind(this));
  }

  setTextFilter(val) {
    this.setState(
      {
        textFilter: val,
      },
      this.filterMaps,
    );
  }

  setSizeFilter(val) {
    this.setState({
      sizeFilter: val,
    });
  }

  showShareModal() {
    this.setState({
      shareModalVisible: true,
    });
  }
  closeShareModal() {
    this.setState({
      shareModalVisible: false,
    });
  }

  setLocationFliter(latlng) {
    let newFilter = null;

    if (latlng) {
      newFilter = [latlng.lng, latlng.lat];
    }
    this.setState(
      {
        locationFilter: newFilter,
      },
      this.filterMaps,
    );
  }

  setDateFilter(range) {
    this.setState(
      {
        dateFilter: range,
      },
      this.filterMaps,
    );
  }

  filterMaps() {
    console.log('RUNNING FILTER');
    if (this.state.maps === null) {
      return [];
    }
    let result = this.state.maps.features;
    result = this.filterGometries(result);
    result = this.filterDates(result);
    result = this.filterText(result);
    this.setState({
      filteredMaps: result
        .map(f => f.properties)
        .slice(this.state.offset, this.state.offset + this.state.limit),
    });
  }

  filterDates(maps) {
    return maps.filter(map => {
      return (
        map.properties.validSince > this.state.dateFilter[0] &&
        map.properties.validUntil < this.state.dateFilter[1]
      );
    });
  }

  filterText(maps) {
    if (this.state.textFilter.length == 0) {
      return maps;
    }
    return maps.filter(map => {
      return map.properties.name.indexOf(this.state.textFilter) > -1;
    });
  }

  filterGometries(maps) {
    let result = maps;
    if (this.state.locationFilter) {
      result = result.filter(map =>
        turf.booleanContains(map, turf.point(this.state.locationFilter)),
      );
    }
    return result;
  }

  updateOpacity(mapid, opacity) {
    this.setState({
      selectedMaps: this.state.selectedMaps.map(
        m => (m.uuid === mapid ? {...m, opacity: opacity} : m),
      ),
    });
  }

  getSelectedMapsWithDetails() {
    const result = this.state.selectedMaps.map(details => {
      const map = this.state.maps.features.filter(
        m => m.properties.uuid === details.uuid,
      )[0];
      return {...map.properties, opacity: details.opacity};
    });
    return result;
  }

  toggleMap(uuid) {
    if (this.state.selectedMaps.map(m => m.uuid).includes(uuid)) {
      this.setState(
        {
          selectedMaps: this.state.selectedMaps.filter(m => m.uuid !== uuid),
        },
        this.encodeStateToHash.bind(this),
      );
    } else {
      this.setState(
        {
          selectedMaps: [...this.state.selectedMaps, {uuid, opacity: 50}],
        },
        this.encodeStateToHash.bind(this),
      );
    }
  }
}

export const LayersConsumer = LayersContext.Consumer;
