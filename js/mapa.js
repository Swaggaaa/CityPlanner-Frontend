var Mapa = function () {
    this.initialize();
    this.highlighted = null;
}

Mapa.prototype.initialize = function () {
    var self = this;
    $("<div id=\"map\" class=\"map\"></div>").appendTo("body");

    proj4.defs("EPSG:23031", "+proj=utm +zone=31 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs");
    ol.proj.proj4.register(proj4);

    this.layers = {};

    this.layers.BASE = new ol.layer.Tile({
        source: new ol.source.OSM(
            {
                "url": "http://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
            })
    });

    this.layers.CIRCLES = new ol.layer.Vector(
        {
            source: new ol.source.Vector({wrapX: false})
        }
    );

    var barris_style = new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(255, 255, 255, 0.1)'
        }),
        stroke: self.layers.CIRCLES.getStyle()()[0].getStroke(),
        text: self.layers.CIRCLES.getStyle()()[0].getText()
    });

    $.getJSON("https://cdn.rawgit.com/martgnz/bcn-geodata/master/barris/barris_geo.json", function (data) {
        var source = new ol.source.Vector(
            {
                "url": "https://cdn.rawgit.com/martgnz/bcn-geodata/master/barris/barris_geo.json",
                "format": new ol.format.GeoJSON()
            });

        self.layers.BARRIS = new ol.layer.Vector(
            {
                source: source,
                style: barris_style
            });

        var barris_geo = data;


        $.getJSON("./hoods.json", function (data) {
            var barris_heatmap_source = new ol.source.Vector();
            
            for (var i = 0; i < data.features.length; ++i) {
                var point = barris_geo.features.find(
                    feat => feat.properties["C_Barri"] === data.features[i].id);

                /* self.layers.BARRIS_HEATED.getSource().getFeatures().features.find(
                     f => f.properties["C_Barri"] === data.features[i].id).set('population', data.features[i].population);
                     */

                var feat = new ol.Feature(
                    {
                        name: data.features[i].id,
                        geometry: new ol.geom.Point(ol.proj.transform([point.properties["Coord_X"], point.properties["Coord_Y"]],
                            'EPSG:23031', 'EPSG:3857')),
                    });
                feat.set('population', data.features[i].population);

                barris_heatmap_source.addFeature(feat);
            }

            self.layers.BARRIS_HEATMAP = new ol.layer.Heatmap(
                {
                    source: barris_heatmap_source,
                    visible: false,
                    weight: function (feature) {
                        var weight = (feature.get('population') - (data.min_population - 1)) / (data.max_population - (data.min_population - 1));
                        return weight;
                    },
                    radius: 50,
                    blur: 50
                }
            );

            var barris_highlighted_style = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.4)'
                }),
                stroke: barris_style.getStroke(),
                text: barris_style.getText()
            });
            self.layers.BARRI_HIGHLIGHTED = new ol.layer.Vector(
                {
                    source: new ol.source.Vector(),
                    style: barris_highlighted_style
                }
            );

            var hospitals_style = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 0, 0, 0.4)'
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(255, 0, 0, 1)',
                    width: 2
                }),
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 0, 0, 0.4)'
                    })
                })
            });
            self.layers.HOSPITALS = new ol.layer.Vector(
                {
                    source: new ol.source.Vector(),
                    style: hospitals_style
                }
            );

            self.map = new ol.Map({
                target: 'map',
                layers: [self.layers.BASE, self.layers.CIRCLES, self.layers.BARRIS,
                    self.layers.BARRIS_HEATMAP, self.layers.BARRI_HIGHLIGHTED, self.layers.HOSPITALS
                ],
                view: new ol.View({
                    center: ol.proj.fromLonLat([2.154, 41.390]),
                    zoom: 14
                })
            });

            var hospitals = '[   {"name": "Hospital del Mar", "lat": "41.383622", "lon": "2.194286"},   {"name": "Hospital Plató", "lat": "41.401004", "lon": "2.142306"},   {"name": "Hospital de l\'Esperança", "lat": "41.410615", "lon": "2.154713"}   ]';
            self.loadPointsFromJSON(hospitals, "Hospital");

            $(document).ready(function () {
                $("#drawPopulation").on('click', function (event) {
                    self.drawPopulation(event);
                });

                self.map.on('pointermove', function (event) {
                    if (event.dragging)
                        return;

                    var pixel = self.map.getEventPixel(event.originalEvent);
                    self.highlightFeature(pixel);
                });

                $("#evolution").change(function () {
                    $('#evolution_output').text(this.value);
                });
            });
        });
    });
};

Mapa.prototype.highlightFeature = function (pixel) {
    var feature = this.map.forEachFeatureAtPixel(pixel, function (feat) {
        return feat;
    });

    if (this.highlighted !== feature) {
        if (this.highlighted)
            this.layers.BARRI_HIGHLIGHTED.getSource().removeFeature(this.highlighted);

        if (feature)
            this.layers.BARRI_HIGHLIGHTED.getSource().addFeature(feature);

        this.highlighted = feature;
    }
}

Mapa.prototype.drawPopulation = function (mouse_event) {
    this.layers.BARRIS_HEATMAP.setVisible(true);
};

Mapa.prototype.drawPoint = function (point, pointType) {
    var poly = new ol.geom.Polygon([[ol.proj.transform([parseFloat(point.lon) - 0.0002, parseFloat(point.lat) + 0.0002], 'EPSG:4326', 'EPSG:3857'),
        ol.proj.transform([parseFloat(point.lon) - 0.0002, parseFloat(point.lat) - 0.0002], 'EPSG:4326', 'EPSG:3857'),
        ol.proj.transform([parseFloat(point.lon) + 0.0002, parseFloat(point.lat) - 0.0002], 'EPSG:4326', 'EPSG:3857'),
        ol.proj.transform([parseFloat(point.lon) + 0.0002, parseFloat(point.lat) + 0.0002], 'EPSG:4326', 'EPSG:3857')]]);

    var feat = new ol.Feature(
        {
            name: point.name,
            geometry: poly
        }
    );

    var layer_name = Object.getOwnPropertyNames(this.layers).find(
        p => p.toUpperCase().indexOf(pointType.toUpperCase()) !== -1);

    this.layers[layer_name].getSource().addFeature(feat);
};

Mapa.prototype.loadPointsFromJSON = function (pointsJSON, pointType) {
    var points = JSON.parse(pointsJSON);

    for (var i = 0; i < points.length; ++i) {
        this.drawPoint(points[i], pointType);
    }
};

function hsl_col_perc(percent, start, end) {
    var a = percent,
        b = (end - start) * a,
        c = b + start;

    // Return a CSS HSL string
    return {c: c, b: 1, a: 0.5};
}

function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

mapa = new Mapa();
