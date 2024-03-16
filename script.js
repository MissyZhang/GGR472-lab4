/*--------------------------------------------------------------------
INITIALIZE MAP
--------------------------------------------------------------------*/
mapboxgl.accessToken = 'pk.eyJ1IjoibWlzc3l6MjEiLCJhIjoiY2xyNW84dXNlMDh3cDJrcGIwMTJnbXp4NyJ9.iiAXKwL46ofLjtf_quFs-A'; 

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',  
    center: [-79.39, 43.65],  
    zoom: 12,
    pitch: 45, // Adjust pitch to tilt the map
    bearing: -17.6 // Adjust bearing for a better viewing angle
});

//Add search control to map overlay
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    countries: "ca"
});

document.getElementById('geocoder').appendChild(geocoder.onAdd(map));

//Add zoom and rotation controls to the map.
map.addControl(new mapboxgl.NavigationControl());
map.addControl(new mapboxgl.FullscreenControl());

/*--------------------------------------------------------------------
VIEW GEOJSON POINT DATA ON MAP
--------------------------------------------------------------------*/

// PREPARE DATA: STORE GEOJSON FROM URL AS VARIABLE
let collisgeojson;

// Fetch GeoJSON from URL and store response
fetch('https://raw.githubusercontent.com/MissyZhang/GGR472-lab4/main/data/pedcyc_collision_06-21.geojson')
    .then(response => response.json())
    .then(response => {
        console.log(response); //Check response in console
        collisgeojson = response; // Store geojson as variable using URL from fetch response
    });

// Load data on the map
map.on('load', () => {

    //Add datasource using GeoJSON variable
    map.addSource('toronto-collision', {
        type: 'geojson',
        data: collisgeojson
    });

    // add the points layer
    map.addLayer({
        'id': 'toronto-collision-pnts',
        'type': 'circle',
        'source': 'toronto-collision',
        'paint': {
            'circle-radius': 2,
            'circle-color': '#F26BB5'
        }
    }); 

});


/*--------------------------------------------------------------------
CREATE BOUNDING BOX AND HEXGRID & AGGREGATE COLLISIONS BY HEXGRID 
--------------------------------------------------------------------*/

map.on('load', () => {

    let bboxgeojson;
    let bbox = turf.envelope(collisgeojson);
    let bboxscaled = turf.transformScale(bbox, 1.10);

    // put the resulting envelpe in a geojson format featureCollection
    bboxgeojson = {
        "type": "FeatureCollection",
        "features": [bboxscaled]
    };

    // create a hex grid
    let bboxcoords =[bboxscaled.geometry.coordinates[0][0][0],
                    bboxscaled.geometry.coordinates[0][0][1],
                    bboxscaled.geometry.coordinates[0][2][0],
                    bboxscaled.geometry.coordinates[0][2][1]];
    let hexgeojson = turf.hexGrid(bboxcoords, 0.5, { units: "kilometers"});

    // use turf collect function to collect properties from the point layer by polygons
    let collishex = turf.collect(hexgeojson, collisgeojson, "_id", "values");

    // count the number of features inside each hexgon, and identidy the maximum value
    let maxcollis = 0;

    collishex.features.forEach((feature) => {
        feature.properties.COUNT = feature.properties.values.length
        if (feature.properties.COUNT > maxcollis) {
            console.log(feature);
            maxcollis = feature.properties.COUNT
        }
    });

   // Filter out hexagons with 0 points
   let filteredHexagons = turf.featureCollection(
    collishex.features.filter(feature => feature.properties.COUNT > 0)
    );

    map.addSource('collis-hex-filtered', {
        type: 'geojson',
        data: filteredHexagons
    });

    
});


/*--------------------------------------------------------------------
CREATE LEGEND
--------------------------------------------------------------------*/
//Declare array variables for labels and colours
const legendlabels = [
    '1-5',
    '6-15',
    '16-25',
    '>25'
];

const legendcolours = [
    '#D7D7D9',
    '#AFFFFF',
    '#038C8C',
    '#111D40'
];

//Declare legend variable using legend div tag
const legend = document.getElementById('legend');

//For each layer create a block to put the colour and label in
legendlabels.forEach((label, i) => {
    const colour = legendcolours[i];

    const item = document.createElement('div'); 
    const key = document.createElement('span'); 

    key.className = 'legend-key'; 
    key.style.backgroundColor = colour; 

    const value = document.createElement('span'); 
    value.innerHTML = `${label}`; 

    item.appendChild(key); //add the key (colour cirlce) to the legend row
    item.appendChild(value); //add the value to the legend row

    legend.appendChild(item); //add row to the legend
});


/*--------------------------------------------------------------------
ADD INTERACTIVITY
--------------------------------------------------------------------*/

// 1) Add event listener which returns map view to full screen on button click using flyTo method
document.getElementById('returnbutton').addEventListener('click', () => {
    map.flyTo({
        center: [-79.39, 43.65], // Coordinates of the center
        zoom: 12,
        essential: true
    });
});


// 2) Change display of layer and legend based on check box
let legendcheck = document.getElementById('legendcheck');
// Add event listener to the checkbox
legendcheck.addEventListener('click', () => {
    if (legendcheck.checked) {
        // Display the legend
        legend.style.display = 'block';
        // Add the hexgrid layer
        map.addLayer({
            'id': 'collis-hex-fill-filtered',
            'type': 'fill-extrusion', 
            'source': 'collis-hex-filtered',
            'paint': {
                'fill-extrusion-color': [
                    'step',
                    ['get', 'COUNT'],
                    '#D7D7D9',
                    5, '#AFFFFF',
                    15, '#038C8C',
                    25, '#111D40'
                ],
                'fill-extrusion-height': [
                    'interpolate', ['linear'], ['get', 'COUNT'],
                    0, 0, // Height at count 0
                    55, 8250 // Height at maximum count 
                ],
                'fill-extrusion-opacity': 0.8,
                'fill-extrusion-outline-color': 'white'
            }
        });
    } else {
        // Hide the legend
        legend.style.display = "none";
        // Remove the hexgrid layer
        map.removeLayer('collis-hex-fill-filtered');
    }
});

// 3) Add event listener to the map for hover events on the 'collis-hex-fill-filtered' layer
// 3.1) Return the count of collisions in the console
map.on('click', 'collis-hex-fill-filtered', (e) => {

    console.log(e);   
    let countofcoll = e.features[0].properties.COUNT; // Extract the count of collisions from the clicked feature's properties
    console.log(countofcoll); // Log the count of collisions to the console

});

// 3.2) Event listener for changing cursor on mouse enter
map.on('mouseenter', 'collis-hex-fill-filtered', () => {
    map.getCanvas().style.cursor = 'pointer'; //Switch cursor to pointer when mouse is over collis-hex-fill-filtered layer
});
// 3.3) Event listener for changing cursor on mouse leave
map.on('mouseleave', 'collis-hex-fill-filtered', () => {
    map.getCanvas().style.cursor = ''; //Switch cursor back when mouse leaves collis-hex-fill-filtered layer
});

// 3.4) Event listener for showing popup on click
map.on('click', 'collis-hex-fill-filtered', (e) => {
    new mapboxgl.Popup({ className: 'custom-popup' }) //Declare new popup object on each click
        .setLngLat(e.lngLat) //Use method to set coordinates of popup based on mouse click location
        .setHTML("<b>Count of collisions:</b> " + e.features[0].properties.COUNT + "<br>") //Use click event properties to write text for popup
        .addTo(map); //Show popup on map
});








