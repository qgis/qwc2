import ol from 'openlayers';

export default class SnapInteraction extends ol.interaction.Snap {
    constructor(options) {
        super(options);
        this.layer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            style: new ol.style.Style({
                image: new ol.style.Circle({
                    stroke: new ol.style.Stroke({color: '#FF0000', width: 2}),
                    radius: 10
                })
            }),
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
            this.layer.getSource().addFeature(new ol.Feature({
                geometry: new ol.geom.Point(evt.coordinate)
            }));
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
