import ol from 'openlayers';

export default class SnapInteraction extends ol.interaction.Snap {
    constructor(options) {
        super(options);
        this.layer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            zIndex: Infinity
        });
        this.currentMap = null;
    }
    handleEvent(evt) {
        const result = this.snapTo(evt.pixel, evt.coordinate, evt.map);
        this.layer.getSource().clear();
        if (result) {
            evt.coordinate = result.vertex.slice(0, 2);
            evt.pixel = result.vertexPixel;
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(evt.coordinate)
            });
            if (result.segment) {
                feature.setStyle(new ol.style.Style({
                    image: new ol.style.RegularShape({
                        stroke: new ol.style.Stroke({color: '#FF0000', width: 3}),
                        points: 4,
                        radius: 14,
                        angle: Math.PI / 4
                    })
                }));
            } else {
                feature.setStyle(new ol.style.Style({
                    image: new ol.style.Circle({
                        stroke: new ol.style.Stroke({color: '#FF0000', width: 3}),
                        radius: 10
                    })
                }));
            }
            this.layer.getSource().addFeature(feature);
        }
        return ol.interaction.Pointer.prototype.handleEvent.call(this, evt);
    }
    setMap(map) {
        if (map) {
            map.addLayer(this.layer);
            this.currentMap = map;
        } else if (this.currentMap) {
            this.currentMap.removeLayer(this.layer);
            this.currentMap = null;
        }
        super.setMap(map);
    }
    setActive(active) {
        if (this.layer) {
            this.layer.setVisible(active);
        }
        super.setActive(active);
    }
    setSnapEdge(snap) {
        this.edge_ = snap;
    }
    setSnapVertex(snap) {
        this.vertex_ = snap;
    }
}
