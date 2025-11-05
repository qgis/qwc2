import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import MapUtils from '../utils/MapUtils';
import ResizeableWindow from '../components/ResizeableWindow';
import Spinner from '../components/widgets/Spinner';
import CoordinatesUtils from '../utils/CoordinatesUtils';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LocaleUtils from '../utils/LocaleUtils';
import { Style, Icon, Stroke, Fill, RegularShape } from 'ol/style';
import { Translate } from 'ol/interaction';

class StreetView extends React.Component {
    static propTypes = {
        task: PropTypes.string,
        map: PropTypes.object
    };

    state = {
        streetViewReady: false
    };

    isUpdatingFromMap = false;
    isUpdatingFromStreetView = false;
    markerLayer = null;
    markerFeature = null;
    translateInteraction = null;


createMarkerLayer = () => {
    const olMap = MapUtils.getHook(MapUtils.GET_MAP);
    
    if (!olMap) {
        console.warn('OpenLayers map not available yet');
        setTimeout(() => this.createMarkerLayer(), 200);
        return;
    }

    // Create vector source and layer
    const vectorSource = new VectorSource();
    this.markerLayer = new VectorLayer({
        source: vectorSource,
        zIndex: 999
    });

    olMap.addLayer(this.markerLayer);

    // Create translate interaction for dragging
    this.translateInteraction = new Translate({
        layers: [this.markerLayer]
    });

    this.translateInteraction.on('translateend', (event) => {
        if (this.isUpdatingFromStreetView) return;

        const feature = event.features.getArray()[0];
        const coords = feature.getGeometry().getCoordinates();

        const mapCrs = this.props.map?.projection || 'EPSG:3857';
        const [lng, lat] = CoordinatesUtils.reproject(coords, mapCrs, 'EPSG:4326');

        this.updateStreetViewFromMarker(lat, lng);
    });

    olMap.addInteraction(this.translateInteraction);
};

removeMarkerLayer = () => {
    const olMap = MapUtils.getHook(MapUtils.GET_MAP);
    
    if (!olMap) return; 
    
    if (this.translateInteraction) {
        olMap.removeInteraction(this.translateInteraction);
        this.translateInteraction = null;
    }
    if (this.markerLayer) {
        olMap.removeLayer(this.markerLayer);
        this.markerLayer = null;
        this.markerFeature = null;
    }
};

    componentDidMount() {
        this.initializeStreetView();
    }

    componentDidUpdate(prevProps) {
        if (this.props.task === "StreetView" && prevProps.task !== "StreetView") {
            setTimeout(() => {
                this.initializeStreetView();
            }, 200);
        }

        if (prevProps.task === "StreetView" && this.props.task !== "StreetView") {
            this.removeMarkerLayer();
        }
    }

    componentWillUnmount() {
        this.removeMarkerLayer();
    }


    initializeStreetView = () => {
        setTimeout(() => {
            this.loadGoogleMaps();
        }, 100);
    };

    loadGoogleMaps = () => {
        if (!window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.props.googleMapsApiKey}`;
            script.async = true;
            script.onload = () => this.initStreetView();
            document.head.appendChild(script);
        } else {
            this.initStreetView();
        }
    };

    initStreetView = () => {
        const container = document.getElementById('streetview-container');

        if (!container) {
            console.warn('Street View container not found');
            return;
        }
        // Check if map is available
        if (!this.props.map || !this.props.map.center) {
            console.warn('Map not ready yet, retrying...');
            setTimeout(() => this.initStreetView(), 200);
            return;
        }
        const mapCenter = this.props.map.center;
        const mapCrs = this.props.map?.projection || 'EPSG:3857';
        const [lng, lat] = CoordinatesUtils.reproject(mapCenter, mapCrs, 'EPSG:4326');

        const panorama = new window.google.maps.StreetViewPanorama(
            container,
            {
                position: { lat: lat, lng: lng },
                pov: {
                    heading: 0,
                    pitch: 0
                },
                zoom: 1,
                addressControl: true,
                linksControl: true,
                panControl: true,
                enableCloseButton: false
            }
        );

        this.panorama = panorama;
        this.setState({ streetViewReady: true });

        panorama.addListener('position_changed', () => {
            if (!this.isUpdatingFromMap) {
                this.isUpdatingFromStreetView = true;
                this.updateMarkerFromStreetView();
                setTimeout(() => {
                    this.isUpdatingFromStreetView = false;
                }, 100);
            }
        });

        panorama.addListener('pov_changed', () => {
            if (!this.isUpdatingFromMap) {
                this.isUpdatingFromStreetView = true;
                this.updateMarkerFromStreetView();
                setTimeout(() => {
                    this.isUpdatingFromStreetView = false;
                }, 100);
            }
        });

        this.createMarkerLayer();
        this.updateMarkerFromStreetView();
    };
updateMarkerFromStreetView = () => {
    if (!this.panorama || !this.markerLayer) return;

    const position = this.panorama.getPosition();
    const pov = this.panorama.getPov();

    if (!position) return;

    const lat = position.lat();
    const lng = position.lng();
    const heading = pov.heading;

    const mapCrs = this.props.map?.projection || 'EPSG:3857';
    const coords = CoordinatesUtils.reproject([lng, lat], 'EPSG:4326', mapCrs);

    // Create or update feature
    if (!this.markerFeature) {
        this.markerFeature = new Feature({
            geometry: new Point(coords)
        });
        this.markerLayer.getSource().addFeature(this.markerFeature);
    } else {
        this.markerFeature.getGeometry().setCoordinates(coords);
    }

    // Create simple triangular delta arrow using Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    
    const centerX = 20;
    const centerY = 20;
    
    // Save context and rotate
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((heading * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
    
    // Draw white outline triangle (larger)
    ctx.beginPath();
    ctx.moveTo(centerX, 5);      // Top point
    ctx.lineTo(centerX - 10, 28); // Bottom left
    ctx.lineTo(centerX , 24); // Bottom center, and a bit up
    ctx.lineTo(centerX + 10, 28); // Bottom right
    ctx.closePath();
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Draw orange/yellow triangle (inner)
    ctx.beginPath();
    ctx.moveTo(centerX, 8);      // Top point
    ctx.lineTo(centerX - 8, 26);  // Bottom left
    ctx.lineTo(centerX , 22); // Bottom center, and a bit up
    ctx.lineTo(centerX + 8, 26);  // Bottom right
    ctx.closePath();
    ctx.fillStyle = '#FFA500';  // Orange
    ctx.fill();
    
    ctx.restore();
    
    // Create style with the canvas
    const arrowStyle = new Style({
        image: new Icon({
            img: canvas,
            imgSize: [40, 40],
            anchor: [0.5, 0.5]
        })
    });

    this.markerFeature.setStyle(arrowStyle);
};


    updateStreetViewFromMarker = (lat, lng) => {
        if (!this.panorama || this.isUpdatingFromStreetView) return;

        this.isUpdatingFromMap = true;

        this.panorama.setPosition({ lat, lng });

        setTimeout(() => {
            this.isUpdatingFromMap = false;
        }, 100);
    };

    render() {
        if (this.props.task === "StreetView") {
            return (
                <ResizeableWindow
                    title="Street View"
                    icon="street"
                    initialWidth={800}
                    initialHeight={350}
                    dockable="bottom"
                    initiallyDocked={true}
                    onClose={() => this.props.setCurrentTask(null)}
                >
                    <div
                        id="streetview-container"
                        role="body"
                        style={{
                            width: '100%',
                            height: '100%',
                            minHeight: '300px',
                            backgroundColor: '#e0e0e0'
                        }}
                    >
                        {!this.state.streetViewReady && (
                            <div style={{ padding: '20px', textAlign: 'center' }}>
                                <Spinner /><span>{LocaleUtils.tr("streetview.loading")}</span>
                            </div>
                        )}
                    </div>
                </ResizeableWindow>
            );
        }
        return null;
    }
}

export default connect((state) => ({
    task: state.task.id,
    map: state.map
}), {
    setCurrentTask: require('../actions/task').setCurrentTask
})(StreetView);
