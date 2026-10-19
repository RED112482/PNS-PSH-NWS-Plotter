# Mobile reference outlines

NOAA NWS reference maps, downloaded 2026-10-19. CWA: layer 1; counties: layer 2, where cwa=MOB, outSR=4326. Both CWA and county geometry use maxAllowableOffset=0.002 degrees for display.

MOB-cwa.geojson: https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer/1/query?where=cwa%3D%27MOB%27&outFields=cwa&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&f=geojson

MOB-counties.geojson: https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer/2/query?where=cwa%3D%27MOB%27&outFields=countyname,state,fips&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&f=geojson

These reference files are served with the app so Mobile outlines remain available when the live GIS service is unavailable. They do not contain uploaded observations or survey data.
